import type {
  ArticleInput,
  ArticleSummary,
  ProviderHealth,
  StoryCluster,
  SummaryProvider,
} from "./types";

/**
 * Shared prompt + JSON handling for any chat-completions style host
 * (Ollama, LM Studio, llama.cpp server).
 */

export function contextChars(): number {
  const raw = Number(process.env.LLM_CONTEXT_CHARS ?? process.env.OLLAMA_CONTEXT_CHARS);
  return Number.isFinite(raw) && raw > 0 ? raw : 6000;
}

export function timeoutMs(): number {
  const raw = Number(process.env.LLM_TIMEOUT_MS ?? process.env.OLLAMA_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
}

export const ANALYST_SYSTEM = [
  "You are an intelligence analyst writing for a UK all-source watchfloor.",
  "Write plainly and factually. Never invent detail that is not in the source text.",
  "Do not hedge with phrases like 'it appears that'. Do not mention being an AI.",
  "Always reply with a single JSON object and nothing else.",
].join(" ");

/**
 * Models wrap JSON in prose, fences, or thinking tags even when asked not to,
 * so pull out the first balanced object rather than trusting the whole response.
 */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
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

export function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+\n/g, "\n").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export type ChatComplete = (prompt: string, system: string) => Promise<string>;

export function createChatProvider(opts: {
  id: string;
  label: string;
  getModel: () => string | null;
  health: () => Promise<ProviderHealth>;
  complete: ChatComplete;
  release?: () => Promise<void>;
}): SummaryProvider {
  return {
    id: opts.id,
    label: opts.label,
    get model() {
      return opts.getModel();
    },
    health: opts.health,
    release: opts.release,

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

      const parsed = parseJsonObject(await opts.complete(prompt, ANALYST_SYSTEM));
      if (!parsed) {
        throw new Error(`${opts.label} returned unparseable JSON for article summary`);
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

      const parsed = parseJsonObject(await opts.complete(prompt, ANALYST_SYSTEM));
      const headline = parsed ? asText(parsed.headline) : null;
      const body = parsed ? asText(parsed.body) : null;
      if (!headline || !body) {
        throw new Error(`${opts.label} returned no usable story for cluster`);
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

      const parsed = parseJsonObject(await opts.complete(prompt, ANALYST_SYSTEM));
      return parsed ? asText(parsed.bluf) : null;
    },
  };
}
