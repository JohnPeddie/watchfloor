import { prisma } from "./db";
import { generateBrief } from "./brief/generate";
import { runIngest } from "./ingest";
import {
  briefIsDue,
  ingestIsDue,
  loadLastBriefAt,
  loadSettings,
} from "./settings";

const TICK_MS = 20_000;
const FIRST_TICK_MS = 5_000;

type SchedulerState = {
  started: boolean;
  timer: ReturnType<typeof setInterval> | null;
  kick: ReturnType<typeof setTimeout> | null;
  ticking: boolean;
};

const g = globalThis as typeof globalThis & { __watchfloorScheduler?: SchedulerState };

function state(): SchedulerState {
  if (!g.__watchfloorScheduler) {
    g.__watchfloorScheduler = { started: false, timer: null, kick: null, ticking: false };
  }
  return g.__watchfloorScheduler;
}

async function lastIngestAt(): Promise<Date | null> {
  const row = await prisma.meta.findUnique({ where: { key: "lastIngestAt" } });
  if (!row) return null;
  const parsed = new Date(row.value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function tick(): Promise<void> {
  const s = state();
  if (s.ticking) return;
  s.ticking = true;
  try {
    const settings = await loadSettings();
    if (ingestIsDue(settings, await lastIngestAt())) {
      console.log("[scheduler] ingest due");
      await runIngest({ fetchImages: true, maxPerFeed: 12 });
    }
    if (briefIsDue(settings, await loadLastBriefAt())) {
      console.log("[scheduler] daily brief due");
      await generateBrief();
    }
  } catch (error) {
    console.warn("[scheduler] tick failed:", error);
  } finally {
    s.ticking = false;
  }
}

/** Starts the in-process ingest/brief scheduler. Safe to call many times. */
export function startScheduler(): void {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const s = state();
  if (s.started) return;
  s.started = true;
  s.kick = setTimeout(() => {
    void tick();
  }, FIRST_TICK_MS);
  s.timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof s.kick.unref === "function") s.kick.unref();
  if (typeof s.timer.unref === "function") s.timer.unref();
  console.log("[scheduler] watching ingest interval and daily brief slot");
}
