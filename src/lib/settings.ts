import { prisma } from "./db";
import { pruneOldestArticles } from "./retention";
import {
  DEFAULT_SETTINGS,
  GLOBE_IMAGE_MAX,
  GLOBE_IMAGE_MIN,
  HOLDINGS_MAX,
  HOLDINGS_MIN,
  defaultSettings,
  llmProviderFromEnv,
  parseBriefTimes,
  parseInsightOrder,
  type LlmProviderId,
  type WatchfloorSettings,
} from "./settings-types";

export { briefIsDue, nextBriefAt } from "./brief-schedule";

export {
  BRIEF_TIMES_MAX,
  DEFAULT_SETTINGS,
  GLOBE_IMAGE_MAX,
  GLOBE_IMAGE_MIN,
  GLOBE_IMAGE_SIZES,
  HOLDINGS_MAX,
  HOLDINGS_MIN,
  HOLDINGS_SIZES,
  INGEST_INTERVALS,
  INSIGHT_CARDS,
  LLM_PROVIDERS,
  defaultSettings,
  llmProviderFromEnv,
  parseBriefTimes,
  parseInsightOrder,
  type BriefClockTime,
  type InsightCardId,
  type LlmProviderId,
  type WatchfloorSettings,
} from "./settings-types";

export const SETTINGS_KEY = "watchfloorSettings";
export const LAST_BRIEF_AT_KEY = "lastBriefAt";

const PROVIDER_IDS = new Set<LlmProviderId>(["rules", "ollama", "lmstudio"]);

function parseProvider(raw: unknown): LlmProviderId | null {
  if (typeof raw !== "string") return null;
  const id = raw.toLowerCase().trim();
  if (id === "openai" || id === "openai-compat") return "lmstudio";
  return PROVIDER_IDS.has(id as LlmProviderId) ? (id as LlmProviderId) : null;
}

export function parseSettings(raw: unknown): WatchfloorSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const interval = Number(o.ingestIntervalMinutes);
  const holdings = Number(o.holdingsMax);
  const globeImages = Number(o.globeImageMax);
  const host = typeof o.llmHost === "string" ? o.llmHost.trim().slice(0, 200) : "";
  const model = typeof o.llmModel === "string" ? o.llmModel.trim().slice(0, 120) : "";
  const weatherCity =
    typeof o.weatherCity === "string" && o.weatherCity.trim()
      ? o.weatherCity.trim().slice(0, 80)
      : DEFAULT_SETTINGS.weatherCity;
  const weatherLat = Number(o.weatherLat);
  const weatherLng = Number(o.weatherLng);
  const weatherTimezone =
    typeof o.weatherTimezone === "string" && o.weatherTimezone.trim()
      ? o.weatherTimezone.trim().slice(0, 80)
      : DEFAULT_SETTINGS.weatherTimezone;
  const weatherCountry =
    typeof o.weatherCountry === "string" ? o.weatherCountry.trim().slice(0, 8).toUpperCase() : "";
  return {
    ingestEnabled: o.ingestEnabled !== false,
    ingestIntervalMinutes:
      Number.isFinite(interval) && interval >= 15 && interval <= 1440
        ? Math.round(interval)
        : DEFAULT_SETTINGS.ingestIntervalMinutes,
    briefEnabled: o.briefEnabled !== false,
    briefTimes: parseBriefTimes(o),
    llmProvider: parseProvider(o.llmProvider) ?? llmProviderFromEnv(),
    llmHost: host,
    llmModel: model,
    holdingsMax:
      Number.isFinite(holdings)
        ? Math.min(HOLDINGS_MAX, Math.max(HOLDINGS_MIN, Math.round(holdings)))
        : DEFAULT_SETTINGS.holdingsMax,
    globeImageMax:
      Number.isFinite(globeImages)
        ? Math.min(GLOBE_IMAGE_MAX, Math.max(GLOBE_IMAGE_MIN, Math.round(globeImages)))
        : DEFAULT_SETTINGS.globeImageMax,
    weatherCity,
    weatherLat:
      Number.isFinite(weatherLat) && weatherLat >= -90 && weatherLat <= 90
        ? weatherLat
        : DEFAULT_SETTINGS.weatherLat,
    weatherLng:
      Number.isFinite(weatherLng) && weatherLng >= -180 && weatherLng <= 180
        ? weatherLng
        : DEFAULT_SETTINGS.weatherLng,
    weatherTimezone,
    weatherCountry: weatherCountry || DEFAULT_SETTINGS.weatherCountry,
    insightOrder: parseInsightOrder(o.insightOrder),
  };
}

export async function loadSettings(): Promise<WatchfloorSettings> {
  const row = await prisma.meta.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return defaultSettings();
  try {
    return parseSettings(JSON.parse(row.value) as unknown);
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(next: WatchfloorSettings): Promise<WatchfloorSettings> {
  const settings = parseSettings(next);
  await prisma.meta.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
  await pruneOldestArticles(settings.holdingsMax);
  return settings;
}

export async function loadLastBriefAt(): Promise<Date | null> {
  const row = await prisma.meta.findUnique({ where: { key: LAST_BRIEF_AT_KEY } });
  if (!row) return null;
  const parsed = new Date(row.value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function markBriefRan(at = new Date()): Promise<void> {
  await prisma.meta.upsert({
    where: { key: LAST_BRIEF_AT_KEY },
    create: { key: LAST_BRIEF_AT_KEY, value: at.toISOString() },
    update: { value: at.toISOString() },
  });
}

export function nextIngestAt(settings: WatchfloorSettings, lastIngestAt: Date | null, now = new Date()): Date | null {
  if (!settings.ingestEnabled) return null;
  if (!lastIngestAt) return now;
  return new Date(lastIngestAt.getTime() + settings.ingestIntervalMinutes * 60_000);
}

export function ingestIsDue(settings: WatchfloorSettings, lastIngestAt: Date | null, now = new Date()): boolean {
  const next = nextIngestAt(settings, lastIngestAt, now);
  return next != null && next.getTime() <= now.getTime();
}
