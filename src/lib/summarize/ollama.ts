import type {
  ArticleInput,
  ArticleSummary,
  ProviderHealth,
  StoryCluster,
  SummaryProvider,
} from "./types";

/**
 * Networked LLM summariser.
 *
 * Assumes Ollama is reachable over the LAN (OLLAMA_BASE_URL). Every call is
 * bounded by a timeout and retried once, because a home-server model host is
 * allowed to be slow, busy, or switched off. Callers are expected to fall back
 * to the rules provider when `health()` reports unreachable.
 */

const DEFAULT_BASE = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";

function baseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
}

function modelName(): string {
  return process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
}

function timeoutMs(): number {
  const raw = Number(process.env.OLLAMA_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
}

/** Number of characters of article body sent to the model. */
function contextChars(): number {
  const raw = Number(process.env.OLLAMA_CONTEXT_CHARS);
  return Number.isFinite(raw) && raw > 0 ? raw : 6000;
}

async function callOllama(prompt: string, system: string, attempt = 0): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const res = await fetch(`${baseUrl()}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName(),
        prompt,
        system,
        stream: false,
        format: "json",
        options: {
          // Low temperature: this is reporting, not creative writing.
          temperature: 0.2,
          top_p: 0.9,
          num_predict: 700,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { response?: string };
    return data.response ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // One retry covers a model still loading into memory, which is common on
    // the first request after the host has been idle.
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return callOllama(prompt, system, attempt + 1);
    }
    throw new Error(`Ollama request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Models wrap JSON in prose or fences even when asked not to, so pull out the
 * first balanced object rather than trusting the whole response.
 */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    const direct = JSON.parse(trimmed) as unknown;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
  } catch {
    // Fall through to brace scanning.
  }

  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === "{") depth++;
    else if (trimmed[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+\n/g, "\n").trim();
  return cleaned.length > 0 ? cleaned : null;
}

const ANALYST_SYSTEM = [
  "You are an intelligence analyst writing for a UK all-source watchfloor.",
  "Write plainly and factually. Never invent detail that is not in the source text.",
  "Do not hedge with phrases like 'it appears that'. Do not mention being an AI.",
  "Always reply with a single JSON object and nothing else.",
].join(" ");

export const ollamaProvider: SummaryProvider = {
  id: "ollama",
  label: "Ollama (local LLM)",
  get model() {
    return modelName();
  },

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    const base: Omit<ProviderHealth, "reachable" | "detail" | "latencyMs"> = {
      id: "ollama",
      label: "Ollama (local LLM)",
      model: modelName(),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${baseUrl()}/api/tags`, { signal: controller.signal });
      if (!res.ok) {
        return {
          ...base,
          reachable: false,
          detail: `Host answered HTTP ${res.status}`,
          latencyMs: Date.now() - started,
        };
      }

      const data = (await res.json()) as { models?: { name?: string }[] };
      const installed = (data.models ?? []).map((m) => m.name ?? "");
      const wanted = modelName();
      // Ollama reports "llama3.1:8b"; accept a bare family name as a match.
      const present = installed.some((n) => n === wanted || n.split(":")[0] === wanted.split(":")[0]);

      return {
        ...base,
        reachable: present,
        detail: present
          ? null
          : `Model "${wanted}" not pulled on host. Available: ${
              installed.length > 0 ? installed.join(", ") : "none"
            }`,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...base,
        reachable: false,
        detail: `${baseUrl()} unreachable (${message})`,
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  },

  async summariseArticle(input: ArticleInput): Promise<ArticleSummary> {
    const source = (input.bodyText ?? input.summary ?? "").slice(0, contextChars());
    if (source.trim().length < 120) {
      return { analysis: input.summary?.trim() ?? null, implication: null };
    }

    const prompt = [
      "Summarise the article below for an intelligence brief.",
      "",
      'Return JSON with exactly two keys: "analysis" and "implication".',
      '"analysis": 3-4 sentences of factual reporting — who did what, where, when, and the numbers that matter.',
      '"implication": 1-2 sentences on why a UK analyst should care and what to watch next.',
      "",
      `Headline: ${input.title}`,
      `Source: ${input.sourceName}`,
      input.placeLabel ? `Location: ${input.placeLabel}` : "",
      input.tags.length > 0 ? `Assigned tags: ${input.tags.join(", ")}` : "",
      "",
      "Article:",
      source,
    ]
      .filter(Boolean)
      .join("\n");

    const parsed = parseJsonObject(await callOllama(prompt, ANALYST_SYSTEM));
    if (!parsed) {
      throw new Error("Ollama returned unparseable JSON for article summary");
    }

    return {
      analysis: asText(parsed.analysis),
      implication: asText(parsed.implication),
    };
  },

  async composeStory(cluster: StoryCluster) {
    const budget = Math.max(1200, Math.floor(contextChars() / Math.max(1, cluster.articles.length)));
    const sources = cluster.articles
      .slice(0, 5)
      .map(
        (a, i) =>
          `[${i + 1}] ${a.sourceName}: ${a.title}\n${(a.bodyText ?? a.summary ?? "").slice(0, budget)}`,
      )
      .join("\n\n");

    const prompt = [
      "Several reports below cover the same event. Write one brief story from them.",
      "",
      'Return JSON with exactly two keys: "headline" and "body".',
      '"headline": under 14 words, specific, no clickbait, no trailing full stop.',
      '"body": 3-4 short paragraphs separated by blank lines. Lead with what happened,',
      "then the corroborating detail, then what it means for the UK and what to watch.",
      "Where sources disagree, say so rather than picking one.",
      "",
      cluster.placeLabel ? `Location: ${cluster.placeLabel}` : "",
      cluster.tags.length > 0 ? `Themes: ${cluster.tags.join(", ")}` : "",
      "",
      "Reports:",
      sources,
    ]
      .filter(Boolean)
      .join("\n");

    const parsed = parseJsonObject(await callOllama(prompt, ANALYST_SYSTEM));
    const headline = parsed ? asText(parsed.headline) : null;
    const body = parsed ? asText(parsed.body) : null;
    if (!headline || !body) {
      throw new Error("Ollama returned no usable story for cluster");
    }
    return { headline, body };
  },

  async writeBluf(stories) {
    if (stories.length === 0) return null;
    const prompt = [
      "Write the bottom line up front for today's intelligence brief.",
      "",
      'Return JSON with one key: "bluf".',
      "One paragraph, at most four sentences, covering the day's most consequential",
      "developments and the single thing a UK reader should watch next.",
      "",
      "Stories:",
      stories.map((s, i) => `${i + 1}. ${s.headline}\n${s.body.slice(0, 700)}`).join("\n\n"),
    ].join("\n");

    const parsed = parseJsonObject(await callOllama(prompt, ANALYST_SYSTEM));
    return parsed ? asText(parsed.bluf) : null;
  },
};
