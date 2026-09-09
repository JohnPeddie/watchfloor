import { existsSync } from "fs";
import { loadSettings } from "../settings";
import type { LlmProviderId } from "../settings-types";

export type LlmRuntime = {
  /** Internal provider key used by the summariser registry. */
  providerId: "rules" | "ollama" | "openai";
  choice: LlmProviderId;
  ollamaBaseUrl: string;
  openaiBaseUrl: string;
  ollamaModel: string;
  openaiModel: string;
};

const OLLAMA_DEFAULT = "http://127.0.0.1:11434";
const OPENAI_DEFAULT = "http://127.0.0.1:1234/v1";
const OLLAMA_PORT = "11434";
const LMSTUDIO_PORT = "1234";

function runningInDocker(): boolean {
  try {
    return existsSync("/.dockerenv");
  } catch {
    return false;
  }
}

/**
 * From a Watchfloor container, 127.0.0.1 is the container itself. Rewrite
 * loopback so "this machine" reaches the Docker host (Ollama on the same box).
 */
function rewriteLoopback(url: string): string {
  if (!runningInDocker()) return url;
  return url.replace(/\b127\.0\.0\.1\b/g, "host.docker.internal").replace(/\blocalhost\b/gi, "host.docker.internal");
}

function withProtocol(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export function resolveLlmBaseUrl(
  raw: string,
  kind: "ollama" | "lmstudio",
  fallback: string,
): string {
  const source = raw.trim() ? raw : fallback;
  const defaultPort = kind === "ollama" ? OLLAMA_PORT : LMSTUDIO_PORT;
  try {
    const parsed = new URL(withProtocol(source));
    if (!parsed.hostname) throw new Error("missing host");
    if (!parsed.port) parsed.port = defaultPort;
    if (kind === "lmstudio") {
      const path = parsed.pathname.replace(/\/+$/, "");
      parsed.pathname = path && path !== "/" && path !== "/v1" ? path : "/v1";
      if (!parsed.pathname.endsWith("/v1")) {
        parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/v1`;
      }
    } else {
      parsed.pathname = "";
    }
    parsed.search = "";
    parsed.hash = "";
    const href =
      kind === "lmstudio"
        ? `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "")
        : parsed.origin;
    return rewriteLoopback(href);
  } catch {
    return rewriteLoopback(fallback.replace(/\/+$/, ""));
  }
}

function mapProvider(choice: LlmProviderId): LlmRuntime["providerId"] {
  if (choice === "ollama") return "ollama";
  if (choice === "lmstudio") return "openai";
  return "rules";
}

export async function loadLlmRuntime(): Promise<LlmRuntime> {
  const settings = await loadSettings();
  const envOllama = (process.env.OLLAMA_BASE_URL ?? OLLAMA_DEFAULT).replace(/\/+$/, "");
  const envOpenAi = (process.env.OPENAI_BASE_URL ?? OPENAI_DEFAULT).replace(/\/+$/, "");
  const host = settings.llmHost.trim();
  const model = settings.llmModel.trim();
  const ollamaHost = settings.llmProvider === "ollama" ? host : "";
  const openaiHost = settings.llmProvider === "lmstudio" ? host : "";

  return {
    providerId: mapProvider(settings.llmProvider),
    choice: settings.llmProvider,
    ollamaBaseUrl: resolveLlmBaseUrl(ollamaHost, "ollama", envOllama),
    openaiBaseUrl: resolveLlmBaseUrl(openaiHost, "lmstudio", envOpenAi),
    ollamaModel:
      settings.llmProvider === "ollama" && model
        ? model
        : settings.llmProvider === "ollama"
          ? ""
          : (process.env.OLLAMA_MODEL ?? "llama3.1:8b").trim(),
    openaiModel:
      settings.llmProvider === "lmstudio" && model ? model : (process.env.OPENAI_MODEL ?? "").trim(),
  };
}
