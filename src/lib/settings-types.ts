export type LlmProviderId = "rules" | "ollama" | "lmstudio";

export type WatchfloorSettings = {
  ingestEnabled: boolean;
  ingestIntervalMinutes: number;
  briefEnabled: boolean;
  briefHour: number;
  briefMinute: number;
  /** How many times to rebuild the brief each day, spaced evenly from briefHour:briefMinute. */
  briefTimesPerDay: number;
  /** Which engine writes daily brief items. */
  llmProvider: LlmProviderId;
  /**
   * Host for the selected LLM. IP, hostname, or URL.
   * Empty keeps the process environment default (OPENAI_BASE_URL / OLLAMA_BASE_URL).
   */
  llmHost: string;
  /** Optional model id. Empty uses the host default / currently loaded model. */
  llmModel: string;
};

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
