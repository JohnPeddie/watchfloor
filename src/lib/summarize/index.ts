import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import { rulesProvider } from "./rules";
import { loadLlmRuntime } from "./runtime-config";
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

/** Reads settings (falling back to SUMMARIZER) for which engine writes briefs. */
export async function configuredProviderId(): Promise<string> {
  const runtime = await loadLlmRuntime();
  return runtime.providerId;
}

export function getProvider(id: string): SummaryProvider {
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
export async function resolveProvider(id?: string): Promise<ResolvedProvider> {
  const requestedId = id ?? (await configuredProviderId());
  const requested = getProvider(requestedId);
  const health = await requested.health();

  if (health.reachable) {
    return { provider: requested, health, fellBack: false, requestedId };
  }

  return {
    provider: rulesProvider,
    health,
    fellBack: requested.id !== rulesProvider.id,
    requestedId,
  };
}

/** Health of every known provider, for the status panel and /api/summarizer. */
export async function allProviderHealth(): Promise<ProviderHealth[]> {
  return Promise.all(Object.values(PROVIDERS).map((p) => p.health()));
}

