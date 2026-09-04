import type { ProviderHealth } from "./types";
import { createChatProvider, timeoutMs } from "./chat";
import { recordRun } from "../run-log";

/**
 * Networked LLM summariser via Ollama's native /api/generate.
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

async function callOllama(prompt: string, system: string, attempt = 0, startedAt = Date.now()): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  const model = modelName();

  try {
    const res = await fetch(`${baseUrl()}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
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

    const data = (await res.json()) as {
      response?: string;
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
    return data.response ?? "";
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
}

export const ollamaProvider = createChatProvider({
  id: "ollama",
  label: "Ollama (local LLM)",
  getModel: modelName,
  health,
  complete: callOllama,
});
