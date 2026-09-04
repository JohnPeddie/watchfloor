import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import { rulesProvider } from "./rules";
import type { ProviderHealth, SummaryProvider } from "./types";

export type { ArticleInput, ArticleSummary, StoryCluster, StoryDraft, SummaryProvider } from "./types";
export { rulesProvider } from "./rules";
export { ollamaProvider } from "./ollama";
export { openaiProvider } from "./openai";

const PROVIDERS: Record<string, SummaryProvider> = {
  rules: rulesProvider,
  ollama: ollamaProvider,
  openai: openaiProvider,
};

const ALIASES: Record<string, string> = {
  manual: "rules",
  lmstudio: "openai",
  "openai-compat": "openai",
};

/** Reads SUMMARIZER, defaulting to the always-available rules engine. */
export function configuredProviderId(): string {
  const raw = (process.env.SUMMARIZER ?? "rules").toLowerCase().trim();
  if (raw === "") return "rules";
  const mapped = ALIASES[raw] ?? raw;
  return mapped in PROVIDERS ? mapped : "rules";
}

export function getProvider(id = configuredProviderId()): SummaryProvider {
  return PROVIDERS[id] ?? rulesProvider;
}

export type ResolvedProvider = {
  provider: SummaryProvider;
  health: ProviderHealth;
  /** True when the configured provider was unavailable and we downgraded. */
  fellBack: boolean;
  requestedId: string;
};

/**
 * Picks the provider to actually use for a run.
 *
 * The configured provider is probed first. If it cannot be reached — the model
 * host is off, the model was never pulled, the LAN is down — we degrade to the
 * rules engine rather than failing the run, and report that we did so. This is
 * what makes it safe to leave SUMMARIZER=openai (or ollama) set permanently.
 * The LLM is only used to compose daily brief items, not per-article summaries.
 */
export async function resolveProvider(id = configuredProviderId()): Promise<ResolvedProvider> {
  const requested = getProvider(id);
  const health = await requested.health();

  if (health.reachable) {
    return { provider: requested, health, fellBack: false, requestedId: id };
  }

  return {
    provider: rulesProvider,
    health,
    fellBack: requested.id !== rulesProvider.id,
    requestedId: id,
  };
}

/** Health of every known provider, for the status panel and /api/summarizer. */
export async function allProviderHealth(): Promise<ProviderHealth[]> {
  return Promise.all(Object.values(PROVIDERS).map((p) => p.health()));
}
