import { todayInZone, zonedDate, zone } from "./clock";
import type { WatchfloorSettings } from "./settings-types";

function calendarDateOffset(date: string, days: number, tz: string): string {
  const noon = zonedDate(date, 12, 0, tz);
  return todayInZone(new Date(noon.getTime() + days * 24 * 3600_000), tz);
}

/** Start times for each run, from yesterday through two days ahead. */
function briefSlotsAround(settings: WatchfloorSettings, now: Date, tz: string): Date[] {
  const today = todayInZone(now, tz);
  const times = settings.briefTimes;
  const slots: Date[] = [];
  for (const day of [-1, 0, 1, 2]) {
    const date = calendarDateOffset(today, day, tz);
    for (const time of times) {
      slots.push(zonedDate(date, time.hour, time.minute, tz));
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

  const first = settings.briefTimes[0] ?? { hour: 6, minute: 0 };
  const todaysStart = zonedDate(todayInZone(now, tz), first.hour, first.minute, tz);
  // Fresh install: wait for today's first slot rather than catching up a missed yesterday slot.
  if (lastBriefAt == null && now.getTime() < todaysStart.getTime()) {
    return todaysStart;
  }

  const nextUnsatisfied = pending[0]!;
  return nextUnsatisfied.getTime() <= now.getTime() ? now : nextUnsatisfied;
}

export function briefIsDue(settings: WatchfloorSettings, lastBriefAt: Date | null, now = new Date()): boolean {
  const next = nextBriefAt(settings, lastBriefAt, now);
  return next != null && next.getTime() <= now.getTime();
}
