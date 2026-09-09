import type { ProviderHealth } from "./types";
import { createChatProvider, timeoutMs } from "./chat";
import { loadLlmRuntime } from "./runtime-config";
import { recordRun } from "../run-log";

/**
 * Networked LLM summariser via Ollama's native /api/generate.
 *
 * Assumes Ollama is reachable over the LAN (OLLAMA_BASE_URL). Every call is
 * bounded by a timeout and retried once, because a home-server model host is
 * allowed to be slow, busy, or switched off. Callers are expected to fall back
 * to the rules provider when `health()` reports unreachable.
 */

let lastModel: string | null = null;

/** Drops chain-of-thought wrappers some models still emit even with think:false. */
function stripThinking(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|?think\|>[\s\S]*?<\|?\/think\|>/gi, "")
    .trim();
}

async function baseUrl(): Promise<string> {
  const runtime = await loadLlmRuntime();
  return runtime.ollamaBaseUrl;
}

async function modelName(): Promise<string> {
  const runtime = await loadLlmRuntime();
  return runtime.ollamaModel;
}

async function callOllama(prompt: string, system: string, attempt = 0, startedAt = Date.now()): Promise<string> {
  const controller = new AbortController();
  const model = (await modelName()) || lastModel;
  const root = await baseUrl();
  if (!model) {
    throw new Error("No model pulled on the Ollama host");
  }
  lastModel = model;
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const res = await fetch(`${root}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: false,
        format: "json",
        // Top-level, not inside options — Ollama ignores think in options and
        // reasoning models then spend num_predict on a hidden chain of thought.
        think: false,
        // Stay loaded between story + BLUF calls in one brief; generateBrief
        // then calls release() so the weights leave VRAM when the run ends.
        keep_alive: "5m",
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

    const data = (await res.json()) as {
      response?: string;
      thinking?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const promptTokens = data.prompt_eval_count ?? null;
    const completionTokens = data.eval_count ?? null;
    const totalTokens =
      promptTokens != null && completionTokens != null ? promptTokens + completionTokens : (promptTokens ?? completionTokens);
    void recordRun({
      kind: "llm",
      startedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      ok: true,
      provider: "ollama",
      model,
      promptTokens: promptTokens ?? undefined,
      completionTokens: completionTokens ?? undefined,
      totalTokens: totalTokens ?? undefined,
    });
    return stripThinking(data.response ?? "");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // One retry covers a model still loading into memory, which is common on
    // the first request after the host has been idle.
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return callOllama(prompt, system, attempt + 1, startedAt);
    }
    void recordRun({
      kind: "llm",
      startedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      ok: false,
      provider: "ollama",
      model,
      detail: message.slice(0, 280),
    });
    throw new Error(`Ollama request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function health(): Promise<ProviderHealth> {
  const started = Date.now();
  const model = await modelName();
  const root = await baseUrl();
  const base: Omit<ProviderHealth, "reachable" | "detail" | "latencyMs"> = {
    id: "ollama",
    label: "Ollama (local LLM)",
    model,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${root}/api/tags`, { signal: controller.signal });
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
    const wanted = model;
    const present =
      installed.length > 0 &&
      (!wanted || installed.some((n) => n === wanted || n.split(":")[0] === wanted.split(":")[0]));
    if (present) lastModel = (wanted && installed.find((n) => n === wanted || n.split(":")[0] === wanted.split(":")[0])) || installed[0] || lastModel;

    return {
      ...base,
      model: lastModel,
      reachable: present,
      detail: present
        ? null
        : wanted
          ? `Model "${wanted}" not pulled on host. Available: ${
              installed.length > 0 ? installed.join(", ") : "none"
            }`
          : `No models pulled at ${root}.`,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      reachable: false,
      detail: `Ollama is not reachable at ${root}. The dashboard still runs; daily briefs will use the rules engine until it is back.`,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unload the configured model immediately. keep_alive: 0 is Ollama's documented
 * way to drop weights from memory without waiting out the idle timer.
 */
async function unloadOllamaModel(): Promise<void> {
  const model = (await modelName()) || lastModel;
  const root = await baseUrl();
  if (!model) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    await fetch(`${root}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        keep_alive: 0,
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

export const ollamaProvider = createChatProvider({
  id: "ollama",
  label: "Ollama (local LLM)",
  getModel: () => lastModel,
  health,
  complete: callOllama,
  release: unloadOllamaModel,
});
