import { prisma } from "../db";
import type { Precedence, Tag } from "../classify";
import { resolveProvider } from "../summarize";
import type { StoryCluster, StoryDraft } from "../summarize/types";
import { clusterArticles, type ClusterCandidate } from "./cluster";

export type GenerateOptions = {
  /** Brief date as YYYY-MM-DD. Defaults to today (UTC). */
  date?: string;
  maxStories?: number;
  /**
   * How far back to look for reporting, in hours. Three days by default: a
   * story needs four outlets on it to qualify, and that corroboration
   * accumulates over more than one news cycle.
   */
  windowHours?: number;
  /** Reports required before a story earns a place in the brief. */
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
    take: 400,
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
 * Builds a daily brief from stored articles using the active summariser.
 *
 * This is the unattended path — what a scheduled job runs. With the rules
 * provider it produces a corroborated multi-source extract; once Ollama is
 * reachable the same clusters are written up as prose instead.
 */
export async function generateBrief(options: GenerateOptions = {}): Promise<GenerateResult> {
  const date = options.date ?? todayUtc();
  const maxStories = options.maxStories ?? 7;
  const minSources = options.minSources ?? 4;
  const { provider, health, fellBack, requestedId } = await resolveProvider(options.providerId);

  const candidates = await loadCandidates(date, options.windowHours ?? 72);
  const clusters = clusterArticles(candidates, {
    maxClusters: maxStories,
    minSources,
  });

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

  return {
    date,
    title,
    bluf,
    source,
    stories,
    candidateCount: candidates.length,
    clusterCount: clusters.length,
    providerRequested: requestedId,
    providerUsed: provider.id,
    fellBack,
    providerDetail: health.detail,
    written: !options.dryRun && stories.length > 0,
  };
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
