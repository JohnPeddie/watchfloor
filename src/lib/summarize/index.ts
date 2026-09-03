import { ollamaProvider } from "./ollama";
import { rulesProvider } from "./rules";
import type { ProviderHealth, SummaryProvider } from "./types";

export type { ArticleInput, ArticleSummary, StoryCluster, StoryDraft, SummaryProvider } from "./types";
export { rulesProvider } from "./rules";
export { ollamaProvider } from "./ollama";

const PROVIDERS: Record<string, SummaryProvider> = {
  rules: rulesProvider,
  ollama: ollamaProvider,
};

/** Reads SUMMARIZER, defaulting to the always-available rules engine. */
export function configuredProviderId(): string {
  const raw = (process.env.SUMMARIZER ?? "rules").toLowerCase().trim();
  // "manual" was the v1 value and still appears in older .env files.
  if (raw === "manual" || raw === "") return "rules";
  return raw in PROVIDERS ? raw : "rules";
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
 * what makes it safe to leave SUMMARIZER=ollama set permanently.
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
