export type LlmProviderId = "rules" | "ollama" | "lmstudio";

export type WatchfloorSettings = {
  ingestEnabled: boolean;
  ingestIntervalMinutes: number;
  briefEnabled: boolean;
  briefHour: number;
  briefMinute: number;
  /** How many times to rebuild the brief each day, spaced evenly from briefHour:briefMinute. */
  briefTimesPerDay: number;
  /** Which engine writes daily brief items and on-demand why-it-matters lines. */
  llmProvider: LlmProviderId;
  /**
   * Host for the selected LLM. IP, hostname, or URL.
   * Empty keeps the process environment default (OPENAI_BASE_URL / OLLAMA_BASE_URL).
   */
  llmHost: string;
  /** Optional model id. Empty uses the host default / currently loaded model. */
  llmModel: string;
  /** Max articles kept in the reporting stream. Oldest drop first. */
  holdingsMax: number;
  /** How many photo markers the globe draws. The rest are small yellow dots. */
  globeImageMax: number;
  /** Weather card city. Forecast follows these coordinates. */
  weatherCity: string;
  weatherLat: number;
  weatherLng: number;
  weatherTimezone: string;
  weatherCountry: string;
  /** Order of cards on the desk / insights pane. */
  insightOrder: InsightCardId[];
};

export const INSIGHT_CARD_IDS = [
  "weather",
  "energy",
  "markets",
  "sectors",
  "precedence",
  "classification",
  "collection",
  "summarisation",
] as const;

export type InsightCardId = (typeof INSIGHT_CARD_IDS)[number];

export const INSIGHT_CARDS: { id: InsightCardId; label: string }[] = [
  { id: "weather", label: "Weather" },
  { id: "energy", label: "Energy" },
  { id: "markets", label: "Markets" },
  { id: "sectors", label: "Sectors" },
  { id: "precedence", label: "Precedence" },
  { id: "classification", label: "Classification" },
  { id: "collection", label: "Collection" },
  { id: "summarisation", label: "Summarisation" },
];

export function parseInsightOrder(raw: unknown): InsightCardId[] {
  const allowed = new Set<string>(INSIGHT_CARD_IDS);
  const seen = new Set<InsightCardId>();
  const order: InsightCardId[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "string" || !allowed.has(item) || seen.has(item as InsightCardId)) continue;
      const id = item as InsightCardId;
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of INSIGHT_CARD_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

export const LLM_PROVIDERS: { id: LlmProviderId; label: string }[] = [
  { id: "rules", label: "Rules engine (no LLM)" },
  { id: "ollama", label: "Ollama" },
  { id: "lmstudio", label: "LM Studio" },
];

export function llmProviderFromEnv(): LlmProviderId {
  const raw = (process.env.SUMMARIZER ?? "rules").toLowerCase().trim();
  if (raw === "ollama") return "ollama";
  if (raw === "openai" || raw === "lmstudio" || raw === "openai-compat") return "lmstudio";
  return "rules";
}

export const DEFAULT_SETTINGS: WatchfloorSettings = {
  ingestEnabled: true,
  ingestIntervalMinutes: 60,
  briefEnabled: true,
  briefHour: 6,
  briefMinute: 0,
  briefTimesPerDay: 1,
  llmProvider: "lmstudio",
  llmHost: "",
  llmModel: "",
  holdingsMax: 300,
  globeImageMax: 100,
  weatherCity: "London",
  weatherLat: 51.5074,
  weatherLng: -0.1278,
  weatherTimezone: "Europe/London",
  weatherCountry: "GB",
  insightOrder: [...INSIGHT_CARD_IDS],
};

export function defaultSettings(): WatchfloorSettings {
  return { ...DEFAULT_SETTINGS, llmProvider: llmProviderFromEnv() };
}

export const BRIEF_FREQUENCIES: { times: number; label: string }[] = [
  { times: 1, label: "Once a day" },
  { times: 2, label: "Twice a day (every 12 hours)" },
  { times: 3, label: "3 times a day (every 8 hours)" },
  { times: 4, label: "4 times a day (every 6 hours)" },
  { times: 6, label: "6 times a day (every 4 hours)" },
  { times: 8, label: "8 times a day (every 3 hours)" },
  { times: 12, label: "12 times a day (every 2 hours)" },
  { times: 24, label: "Every hour" },
];

export const HOLDINGS_SIZES: { count: number; label: string }[] = [
  { count: 150, label: "150 articles" },
  { count: 200, label: "200 articles" },
  { count: 300, label: "300 articles" },
  { count: 400, label: "400 articles" },
  { count: 500, label: "500 articles" },
  { count: 750, label: "750 articles" },
  { count: 1000, label: "1,000 articles" },
];

export const HOLDINGS_MIN = 150;
export const HOLDINGS_MAX = 1000;

export const GLOBE_IMAGE_SIZES: { count: number; label: string }[] = [
  { count: 0, label: "None (dots only)" },
  { count: 25, label: "25 photos" },
  { count: 50, label: "50 photos" },
  { count: 100, label: "100 photos" },
  { count: 150, label: "150 photos" },
  { count: 200, label: "200 photos" },
];

export const GLOBE_IMAGE_MIN = 0;
export const GLOBE_IMAGE_MAX = 200;

export const INGEST_INTERVALS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "Every 15 minutes" },
  { minutes: 30, label: "Every 30 minutes" },
  { minutes: 60, label: "Every hour" },
  { minutes: 120, label: "Every 2 hours" },
  { minutes: 180, label: "Every 3 hours" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 720, label: "Every 12 hours" },
  { minutes: 1440, label: "Once a day" },
];
