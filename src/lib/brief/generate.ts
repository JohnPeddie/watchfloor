import { prisma } from "../db";
import type { Precedence, Tag } from "../classify";
import { exclusive } from "../jobs";
import { recordRun } from "../run-log";
import { markBriefRan } from "../settings";
import { resolveProvider } from "../summarize";
import type { StoryCluster, StoryDraft } from "../summarize/types";
import {
  briefIsAdequate,
  BRIEF_CEILING,
  clusterArticles,
  coverageLanesOf,
  fillBriefToFloor,
  MIN_BRIEF_STORIES,
  pickBriefClusters,
  type ClusterCandidate,
} from "./cluster";

export type GenerateOptions = {
  /** Brief date as YYYY-MM-DD. Defaults to today (UTC). */
  date?: string;
  maxStories?: number;
  /**
   * How far back to look for reporting, in hours. Three days by default: a
   * story needs several outlets on it to qualify, and that corroboration
   * accumulates over more than one news cycle.
   */
  windowHours?: number;
  /**
   * Starting corroboration bar. If the brief cannot reach five stories with
   * mixed interest-lane coverage, generation steps this down automatically.
   * A busy day keeps every well-corroborated cluster (up to a ceiling), so
   * the count can sit well above five.
   */
  minSources?: number;
  /** Overrides SUMMARIZER for this run. */
  providerId?: string;
  /** Build the brief but do not write it to the database. */
  dryRun?: boolean;
};

export type GenerateResult = {
  date: string;
  title: string;
  bluf: string | null;
  source: string;
  stories: StoryDraft[];
  candidateCount: number;
  clusterCount: number;
  coverageLanes: number;
  tolerance: {
    minSources: number;
    minOverlap: number;
    windowHours: number;
    relaxed: boolean;
  };
  providerRequested: string;
  providerUsed: string;
  fellBack: boolean;
  providerDetail: string | null;
  written: boolean;
};

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function briefTitle(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  const formatted = parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Global Radar Report – ${formatted}`;
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Pulls the reporting window for a brief date out of the database. */
export async function loadCandidates(
  date: string,
  windowHours = 72,
): Promise<ClusterCandidate[]> {
  const end = new Date(`${date}T23:59:59.999Z`);
  const start = new Date(end.getTime() - windowHours * 3600_000);

  const rows = await prisma.article.findMany({
    where: { publishedAt: { gte: start, lte: end } },
    orderBy: { publishedAt: "desc" },
    take: 300,
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    sourceName: row.sourceName,
    summary: row.summary,
    bodyText: row.bodyText,
    tags: parseJsonArray<Tag>(row.tags),
    placeLabel: row.placeLabel,
    precedence: (row.precedence as Precedence) ?? "ROUTINE",
    lat: row.lat,
    lng: row.lng,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
  }));
}

/**
 * Builds a daily brief from stored articles.
 *
 * Clustering and tagging stay on the rules engine. The configured LLM, if
 * reachable, writes each brief item and the bottom line from those clusters.
 * If the model host is down, the same clusters are written extractively.
 */
export async function generateBrief(options: GenerateOptions = {}): Promise<GenerateResult> {
  return exclusive(() => generateBriefInner(options));
}

type ToleranceStep = { minSources: number; minOverlap: number };

function relaxationLadder(startSources: number): ToleranceStep[] {
  const steps: ToleranceStep[] = [
    { minSources: startSources, minOverlap: 0.38 },
    { minSources: Math.min(startSources, 3), minOverlap: 0.34 },
    { minSources: 2, minOverlap: 0.3 },
  ];
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (step.minSources > startSources) return false;
    const key = `${step.minSources}:${step.minOverlap}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function generateBriefInner(options: GenerateOptions = {}): Promise<GenerateResult> {
  const startedAt = new Date();
  const date = options.date ?? todayUtc();
  const ceiling = Math.max(options.maxStories ?? BRIEF_CEILING, MIN_BRIEF_STORIES);
  const startSources = options.minSources ?? 4;
  const startWindow = options.windowHours ?? 72;
  const { provider, health, fellBack, requestedId } = await resolveProvider(options.providerId);
  if (fellBack) {
    console.warn(
      "[brief] local LLM unreachable — writing this brief with the rules engine.",
      health.detail ?? "",
    );
  }

  try {
    return await generateBriefWithProvider(options, {
      startedAt,
      date,
      ceiling,
      startSources,
      startWindow,
      provider,
      health,
      fellBack,
      requestedId,
    });
  } finally {
    // Ollama unloads here so VRAM is free between scheduled briefs.
    try {
      await provider.release?.();
    } catch {
      // Best-effort: a down host is already not holding a loaded model.
    }
  }
}

async function generateBriefWithProvider(
  options: GenerateOptions,
  ctx: {
    startedAt: Date;
    date: string;
    ceiling: number;
    startSources: number;
    startWindow: number;
    provider: Awaited<ReturnType<typeof resolveProvider>>["provider"];
    health: Awaited<ReturnType<typeof resolveProvider>>["health"];
    fellBack: boolean;
    requestedId: string;
  },
): Promise<GenerateResult> {
  const { startedAt, date, ceiling, startSources, startWindow, provider, health, fellBack, requestedId } =
    ctx;
  const steps = relaxationLadder(startSources);
  const strictStep = steps[0]!;
  let windowHours = startWindow;
  let candidates = await loadCandidates(date, windowHours);
  let used = strictStep;

  function pool(cands: ClusterCandidate[], step: ToleranceStep): StoryCluster[] {
    return clusterArticles(cands, {
      maxClusters: ceiling,
      minSources: step.minSources,
      minOverlap: step.minOverlap,
    });
  }

  let clusters = pickBriefClusters(pool(candidates, strictStep), ceiling);

  if (!briefIsAdequate(clusters)) {
    for (const step of steps.slice(1)) {
      used = step;
      clusters = fillBriefToFloor(clusters, pool(candidates, step), ceiling);
      if (briefIsAdequate(clusters)) break;
    }
  }

  if (!briefIsAdequate(clusters) && options.windowHours == null) {
    windowHours = 120;
    candidates = await loadCandidates(date, windowHours);
    clusters = pickBriefClusters(pool(candidates, strictStep), ceiling);
    used = strictStep;
    if (!briefIsAdequate(clusters)) {
      for (const step of steps.slice(1)) {
        used = step;
        clusters = fillBriefToFloor(clusters, pool(candidates, step), ceiling);
        if (briefIsAdequate(clusters)) break;
      }
    }
  }

  const relaxed =
    used.minSources < startSources || used.minOverlap < 0.38 || windowHours > startWindow;
  if (relaxed) {
    console.info(
      `[brief] relaxed tolerance to ${used.minSources} sources / overlap ${used.minOverlap}` +
        ` / ${windowHours}h window (${clusters.length} stories, ${coverageLanesOf(clusters).size} lanes)`,
    );
  }

  const stories: StoryDraft[] = [];
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const written = await composeWithFallback(provider, cluster);
    stories.push({
      headline: written.headline,
      body: written.body,
      tags: cluster.tags,
      precedence: cluster.precedence,
      placeLabel: cluster.placeLabel,
      lat: cluster.lat,
      lng: cluster.lng,
      imageUrl: cluster.imageUrl,
      relatedArticleIds: cluster.articles.map((a) => a.id),
      sortOrder: i,
    });
  }

  const precedenceRank: Record<string, number> = {
    FLASH: 4,
    IMMEDIATE: 3,
    PRIORITY: 2,
    ROUTINE: 1,
  };
  stories.sort(
    (a, b) =>
      (precedenceRank[b.precedence] ?? 0) - (precedenceRank[a.precedence] ?? 0) ||
      a.sortOrder - b.sortOrder,
  );
  stories.forEach((story, index) => {
    story.sortOrder = index;
  });

  let bluf: string | null = null;
  if (provider.writeBluf && stories.length > 0) {
    try {
      bluf = await provider.writeBluf(stories.map((s) => ({ headline: s.headline, body: s.body })));
    } catch {
      bluf = null;
    }
  }

  const source = provider.model ? `${provider.id}:${provider.model}` : provider.id;
  const title = briefTitle(date);

  if (!options.dryRun && stories.length > 0) {
    await writeBrief({ date, title, bluf, source, stories });
  }

  const result: GenerateResult = {
    date,
    title,
    bluf,
    source,
    stories,
    candidateCount: candidates.length,
    clusterCount: clusters.length,
    coverageLanes: coverageLanesOf(clusters).size,
    tolerance: {
      minSources: used.minSources,
      minOverlap: used.minOverlap,
      windowHours,
      relaxed,
    },
    providerRequested: requestedId,
    providerUsed: provider.id,
    fellBack,
    providerDetail: health.detail,
    written: !options.dryRun && stories.length > 0,
  };

  await recordRun({
    kind: "brief",
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
    ok: true,
    provider: provider.id,
    model: provider.model,
    stories: stories.length,
    fellBack,
    detail:
      [
        health.detail,
        relaxed
          ? `relaxed to ${used.minSources} sources, overlap ${used.minOverlap}, ${windowHours}h`
          : `${clusters.length} stories / ${coverageLanesOf(clusters).size} lanes`,
      ]
        .filter(Boolean)
        .join(" · ") || null,
  });
  if (!options.dryRun) await markBriefRan(startedAt);

  return result;
}

/**
 * A single flaky model response should not lose the whole story, so fall back
 * to the extractive merge for that cluster alone.
 */
async function composeWithFallback(
  provider: Awaited<ReturnType<typeof resolveProvider>>["provider"],
  cluster: StoryCluster,
): Promise<{ headline: string; body: string }> {
  try {
    return await provider.composeStory(cluster);
  } catch (error) {
    if (provider.id === "rules") throw error;
    const { rulesProvider } = await import("../summarize/rules");
    console.warn(
      `  ! ${provider.id} failed on cluster ${cluster.key}, using rules engine:`,
      error instanceof Error ? error.message : error,
    );
    return rulesProvider.composeStory(cluster);
  }
}

export type WritableBrief = {
  date: string;
  title: string;
  bluf: string | null;
  source: string;
  stories: StoryDraft[];
};

/** Replaces the brief for a date in one transaction. */
export async function writeBrief(brief: WritableBrief): Promise<string> {
  const record = await prisma.dailyBrief.upsert({
    where: { date: brief.date },
    create: {
      date: brief.date,
      title: brief.title,
      bluf: brief.bluf,
      source: brief.source,
    },
    update: {
      title: brief.title,
      bluf: brief.bluf,
      source: brief.source,
    },
  });

  await prisma.briefStory.deleteMany({ where: { briefId: record.id } });

  for (const story of brief.stories) {
    await prisma.briefStory.create({
      data: {
        briefId: record.id,
        headline: story.headline,
        body: story.body,
        tags: JSON.stringify(story.tags),
        precedence: story.precedence,
        placeLabel: story.placeLabel,
        lat: story.lat,
        lng: story.lng,
        imageUrl: story.imageUrl,
        relatedArticleIds: JSON.stringify(story.relatedArticleIds),
        sortOrder: story.sortOrder,
      },
    });
  }

  return record.id;
}
