import { prisma } from "./db";
import { partsInZone, todayInZone, zonedDate, zone } from "./clock";
import { DEFAULT_SETTINGS, type WatchfloorSettings } from "./settings-types";

export { DEFAULT_SETTINGS, INGEST_INTERVALS, type WatchfloorSettings } from "./settings-types";

export const SETTINGS_KEY = "watchfloorSettings";
export const LAST_BRIEF_AT_KEY = "lastBriefAt";

export function parseSettings(raw: unknown): WatchfloorSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const interval = Number(o.ingestIntervalMinutes);
  const hour = Number(o.briefHour);
  const minute = Number(o.briefMinute);
  return {
    ingestEnabled: o.ingestEnabled !== false,
    ingestIntervalMinutes:
      Number.isFinite(interval) && interval >= 15 && interval <= 1440
        ? Math.round(interval)
        : DEFAULT_SETTINGS.ingestIntervalMinutes,
    briefEnabled: o.briefEnabled !== false,
    briefHour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : 6,
    briefMinute: Number.isFinite(minute) ? Math.min(59, Math.max(0, Math.round(minute))) : 0,
  };
}

export async function loadSettings(): Promise<WatchfloorSettings> {
  const row = await prisma.meta.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return parseSettings(JSON.parse(row.value) as unknown);
  } catch {
    return { ...DEFAULT_SETTINGS };
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

export function nextBriefAt(
  settings: WatchfloorSettings,
  lastBriefAt: Date | null,
  now = new Date(),
): Date | null {
  if (!settings.briefEnabled) return null;
  const tz = zone();
  const today = todayInZone(now, tz);
  const todaysSlot = zonedDate(today, settings.briefHour, settings.briefMinute, tz);
  const alreadyToday = lastBriefAt != null && todayInZone(lastBriefAt, tz) === today;
  if (now.getTime() < todaysSlot.getTime() || alreadyToday) {
    if (!alreadyToday && now.getTime() < todaysSlot.getTime()) return todaysSlot;
    const tomorrow = new Date(todaysSlot.getTime() + 24 * 3600_000);
    const t = partsInZone(tomorrow, tz);
    const date = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
    return zonedDate(date, settings.briefHour, settings.briefMinute, tz);
  }
  return now;
}

export function ingestIsDue(settings: WatchfloorSettings, lastIngestAt: Date | null, now = new Date()): boolean {
  const next = nextIngestAt(settings, lastIngestAt, now);
  return next != null && next.getTime() <= now.getTime();
}

export function briefIsDue(settings: WatchfloorSettings, lastBriefAt: Date | null, now = new Date()): boolean {
  if (!settings.briefEnabled) return false;
  const tz = zone();
  const today = todayInZone(now, tz);
  const alreadyToday = lastBriefAt != null && todayInZone(lastBriefAt, tz) === today;
  if (alreadyToday) return false;
  const slot = zonedDate(today, settings.briefHour, settings.briefMinute, tz);
  return now.getTime() >= slot.getTime();
}