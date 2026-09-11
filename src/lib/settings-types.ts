export type LlmProviderId = "rules" | "ollama" | "lmstudio";

export type BriefClockTime = { hour: number; minute: number };

export type WatchfloorSettings = {
  ingestEnabled: boolean;
  ingestIntervalMinutes: number;
  briefEnabled: boolean;
  /** Wall-clock times to rebuild the brief each day, in the server timezone. */
  briefTimes: BriefClockTime[];
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
  briefTimes: [{ hour: 6, minute: 0 }],
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

export const BRIEF_TIMES_MAX = 24;

function clampClock(hour: number, minute: number): BriefClockTime {
  return {
    hour: Math.min(23, Math.max(0, Math.round(hour))),
    minute: Math.min(59, Math.max(0, Math.round(minute))),
  };
}

function clockKey(time: BriefClockTime): number {
  return time.hour * 60 + time.minute;
}

function evenBriefTimes(hour: number, minute: number, timesPerDay: number): BriefClockTime[] {
  const count = Math.min(BRIEF_TIMES_MAX, Math.max(1, Math.round(timesPerDay)));
  const start = hour * 60 + minute;
  const step = (24 * 60) / count;
  const seen = new Set<number>();
  const times: BriefClockTime[] = [];
  for (let i = 0; i < count; i++) {
    const mins = Math.round(start + i * step) % (24 * 60);
    if (seen.has(mins)) continue;
    seen.add(mins);
    times.push({ hour: Math.floor(mins / 60), minute: mins % 60 });
  }
  times.sort((a, b) => clockKey(a) - clockKey(b));
  // Four even slots from 06:00 include midnight. Keep the three daytime runs.
  const origin = clampClock(hour, minute);
  if (count === 4 && origin.hour === 6 && origin.minute === 0) {
    const daytime = times.filter((time) => time.hour !== 0 || time.minute !== 0);
    if (daytime.length) return daytime;
  }
  return times.length ? times : [{ hour: 6, minute: 0 }];
}

/**
 * Reads `briefTimes`, or expands the old start-time + times-per-day fields.
 */
export function parseBriefTimes(raw: unknown): BriefClockTime[] {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (Array.isArray(o.briefTimes) || Array.isArray(raw)) {
    const list = Array.isArray(o.briefTimes) ? o.briefTimes : (raw as unknown[]);
    const seen = new Set<number>();
    const times: BriefClockTime[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const hour = Number((item as { hour?: unknown }).hour);
      const minute = Number((item as { minute?: unknown }).minute);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
      const time = clampClock(hour, minute);
      const key = clockKey(time);
      if (seen.has(key)) continue;
      seen.add(key);
      times.push(time);
      if (times.length >= BRIEF_TIMES_MAX) break;
    }
    if (times.length) {
      times.sort((a, b) => clockKey(a) - clockKey(b));
      return times;
    }
  }
  const hour = Number(o.briefHour);
  const minute = Number(o.briefMinute);
  const perDay = Number(o.briefTimesPerDay);
  return evenBriefTimes(
    Number.isFinite(hour) ? hour : 6,
    Number.isFinite(minute) ? minute : 0,
    Number.isFinite(perDay) ? perDay : 1,
  );
}

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
