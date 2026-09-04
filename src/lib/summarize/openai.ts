import type { ProviderHealth } from "./types";
import { createChatProvider, timeoutMs } from "./chat";
import { recordRun } from "../run-log";

/**
 * OpenAI-compatible chat summariser.
 *
 * LM Studio, llama.cpp server, vLLM and similar hosts all speak
 * /v1/chat/completions. Watchfloor treats "openai" and "lmstudio" as this
 * provider. Falls back to the rules engine when the host is off or no model
 * is loaded.
 */

const DEFAULT_BASE = "http://127.0.0.1:1234/v1";

function baseUrl(): string {
  const raw = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

function configuredModel(): string {
  return (process.env.OPENAI_MODEL ?? "").trim();
}

function apiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() || "lm-studio";
}

/** Last id seen on /v1/models, used when OPENAI_MODEL is left blank. */
let loadedModel: string | null = null;

function activeModel(): string | null {
  return configuredModel() || loadedModel;
}

function modelMatches(available: string[], wanted: string): boolean {
  const needle = wanted.toLowerCase();
  return available.some((name) => {
    const n = name.toLowerCase();
    return n === needle || n.includes(needle) || needle.includes(n);
  });
}

function resolvedModelId(available: string[]): string | null {
  const wanted = configuredModel();
  if (!wanted) return available[0] ?? null;
  const exact = available.find((n) => n === wanted);
  if (exact) return exact;
  const fuzzy = available.find((n) => {
    const lower = n.toLowerCase();
    const needle = wanted.toLowerCase();
    return lower.includes(needle) || needle.includes(lower);
  });
  return fuzzy ?? wanted;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const rec = part as { text?: unknown; content?: unknown };
          if (typeof rec.text === "string") return rec.text;
          if (typeof rec.content === "string") return rec.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

async function callChat(prompt: string, system: string, attempt = 0, startedAt = Date.now()): Promise<string> {
  const model = activeModel();
  if (!model) {
    throw new Error("No model loaded on the OpenAI-compatible host");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  // LM Studio accepts response_format type "json_schema" or "text", not
  // OpenAI's "json_object". The prompt already demands JSON; we parse it out.
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 1200,
    stream: false,
  };

  try {
    const res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${res.status} ${res.statusText}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown; reasoning_content?: unknown } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const message = data.choices?.[0]?.message;
    // Gemma and other reasoning models put chain-of-thought in
    // reasoning_content. That text is not JSON and must not be parsed.
    const text = contentText(message?.content).trim();
    const promptTokens = data.usage?.prompt_tokens ?? null;
    const completionTokens = data.usage?.completion_tokens ?? null;
    const totalTokens =
      data.usage?.total_tokens ??
      (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
    void recordRun({
      kind: "llm",
      startedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      ok: true,
      provider: "openai",
      model,
      promptTokens: promptTokens ?? undefined,
      completionTokens: completionTokens ?? undefined,
      totalTokens: totalTokens ?? undefined,
    });
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attempt === 0 && !message.includes("HTTP 400") && !message.includes("HTTP 422")) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return callChat(prompt, system, attempt + 1, startedAt);
    }
    void recordRun({
      kind: "llm",
      startedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      ok: false,
      provider: "openai",
      model,
      detail: message.slice(0, 280),
    });
    throw new Error(`OpenAI-compatible request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function health(): Promise<ProviderHealth> {
  const started = Date.now();
  const model = configuredModel() || loadedModel;
  const base: Omit<ProviderHealth, "reachable" | "detail" | "latencyMs"> = {
    id: "openai",
    label: "LM Studio",
    model,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl()}/models`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        ...base,
        reachable: false,
        detail: `Host answered HTTP ${res.status}`,
        latencyMs: Date.now() - started,
      };
    }

    const data = (await res.json()) as { data?: { id?: string }[] };
    const installed = (data.data ?? []).map((row) => row.id ?? "").filter(Boolean);
    loadedModel = installed[0] ?? null;

    const wanted = configuredModel();
    if (installed.length === 0) {
      return {
        ...base,
        model: wanted || null,
        reachable: false,
        detail: `No model loaded at ${baseUrl()}. Start the server in LM Studio and load Qwen.`,
        latencyMs: Date.now() - started,
      };
    }

    const present = !wanted || modelMatches(installed, wanted);
    const resolved = resolvedModelId(installed);
    if (present && resolved) loadedModel = resolved;

    return {
      ...base,
      model: present ? resolved : wanted,
      reachable: present,
      detail: present
        ? null
        : `Model "${wanted}" not loaded. Available: ${installed.join(", ")}`,
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
}

export const openaiProvider = createChatProvider({
  id: "openai",
  label: "LM Studio",
  getModel: activeModel,
  health,
  complete: callChat,
});
