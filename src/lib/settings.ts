import { prisma } from "./db";
import { todayInZone, zonedDate, zone } from "./clock";
import {
  DEFAULT_SETTINGS,
  defaultSettings,
  llmProviderFromEnv,
  type LlmProviderId,
  type WatchfloorSettings,
} from "./settings-types";

export {
  BRIEF_FREQUENCIES,
  DEFAULT_SETTINGS,
  INGEST_INTERVALS,
  LLM_PROVIDERS,
  defaultSettings,
  llmProviderFromEnv,
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
  const hour = Number(o.briefHour);
  const minute = Number(o.briefMinute);
  const times = Number(o.briefTimesPerDay);
  const host = typeof o.llmHost === "string" ? o.llmHost.trim().slice(0, 200) : "";
  const model = typeof o.llmModel === "string" ? o.llmModel.trim().slice(0, 120) : "";
  return {
    ingestEnabled: o.ingestEnabled !== false,
    ingestIntervalMinutes:
      Number.isFinite(interval) && interval >= 15 && interval <= 1440
        ? Math.round(interval)
        : DEFAULT_SETTINGS.ingestIntervalMinutes,
    briefEnabled: o.briefEnabled !== false,
    briefHour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : 6,
    briefMinute: Number.isFinite(minute) ? Math.min(59, Math.max(0, Math.round(minute))) : 0,
    briefTimesPerDay: Number.isFinite(times) ? Math.min(24, Math.max(1, Math.round(times))) : 1,
    llmProvider: parseProvider(o.llmProvider) ?? llmProviderFromEnv(),
    llmHost: host,
    llmModel: model,
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

function calendarDateOffset(date: string, days: number, tz: string): string {
  const noon = zonedDate(date, 12, 0, tz);
  return todayInZone(new Date(noon.getTime() + days * 24 * 3600_000), tz);
}

function briefIntervalMs(timesPerDay: number): number {
  return (24 * 60 * 60 * 1000) / timesPerDay;
}

/** Start times for each run, from yesterday through two days ahead. */
function briefSlotsAround(settings: WatchfloorSettings, now: Date, tz: string): Date[] {
  const today = todayInZone(now, tz);
  const times = settings.briefTimesPerDay;
  const interval = briefIntervalMs(times);
  const slots: Date[] = [];
  for (const day of [-1, 0, 1, 2]) {
    const start = zonedDate(
      calendarDateOffset(today, day, tz),
      settings.briefHour,
      settings.briefMinute,
      tz,
    );
    for (let i = 0; i < times; i++) {
      slots.push(new Date(start.getTime() + i * interval));
    }
  }
  slots.sort((a, b) => a.getTime() - b.getTime());
  const unique: Date[] = [];
  for (const slot of slots) {
    const prev = unique[unique.length - 1];
    if (!prev || prev.getTime() !== slot.getTime()) unique.push(slot);
  }
  return unique;
}

export function nextBriefAt(
  settings: WatchfloorSettings,
  lastBriefAt: Date | null,
  now = new Date(),
): Date | null {
  if (!settings.briefEnabled) return null;
  const tz = zone();
  const slots = briefSlotsAround(settings, now, tz);
  const lastMs = lastBriefAt?.getTime() ?? 0;
  const pending = slots.filter((slot) => slot.getTime() > lastMs);
  if (pending.length === 0) return null;

  const todaysStart = zonedDate(todayInZone(now, tz), settings.briefHour, settings.briefMinute, tz);
  // Fresh install: wait for today's start rather than catching up a missed yesterday slot.
  if (lastBriefAt == null && now.getTime() < todaysStart.getTime()) {
    return todaysStart;
  }

  const nextUnsatisfied = pending[0]!;
  return nextUnsatisfied.getTime() <= now.getTime() ? now : nextUnsatisfied;
}

export function ingestIsDue(settings: WatchfloorSettings, lastIngestAt: Date | null, now = new Date()): boolean {
  const next = nextIngestAt(settings, lastIngestAt, now);
  return next != null && next.getTime() <= now.getTime();
}

export function briefIsDue(settings: WatchfloorSettings, lastBriefAt: Date | null, now = new Date()): boolean {
  const next = nextBriefAt(settings, lastBriefAt, now);
  return next != null && next.getTime() <= now.getTime();
}