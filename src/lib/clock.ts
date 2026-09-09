/** Timezone used for schedules and "today" stats. */
export function zone(): string {
  return process.env.TZ?.trim() || "UTC";
}

/** YYYY-MM-DD in the configured zone. */
export function todayInZone(at = new Date(), timeZone = zone()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function partsInZone(at = new Date(), timeZone = zone()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

/** Instant for a wall-clock time on a local calendar day in the zone. */
export function zonedDate(date: string, hour: number, minute: number, timeZone = zone()): Date {
  const rough = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  const asInZone = partsInZone(rough, timeZone);
  const wanted = hour * 60 + minute;
  const got = asInZone.hour * 60 + asInZone.minute;
  return new Date(rough.getTime() + (wanted - got) * 60_000);
}

export function startOfToday(timeZone = zone()): Date {
  return zonedDate(todayInZone(new Date(), timeZone), 0, 0, timeZone);
}