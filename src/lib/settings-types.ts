export type WatchfloorSettings = {
  ingestEnabled: boolean;
  ingestIntervalMinutes: number;
  briefEnabled: boolean;
  briefHour: number;
  briefMinute: number;
};

export const DEFAULT_SETTINGS: WatchfloorSettings = {
  ingestEnabled: true,
  ingestIntervalMinutes: 60,
  briefEnabled: true,
  briefHour: 6,
  briefMinute: 0,
};

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
