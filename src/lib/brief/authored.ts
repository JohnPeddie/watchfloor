import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db";
import { loadSettings } from "../settings";
import type { Precedence, Tag } from "../classify";
import type { StoryDraft } from "../summarize/types";
import { briefTitle, writeBrief } from "./generate";

/**
 * Hand-written brief, stored as JSON under content/briefs/<date>.json.
 *
 * This is the human (or analyst-assisted) path. It takes precedence over
 * automatic generation for a given date, so a written brief is never
 * overwritten by a scheduled run.
 */
export type AuthoredStory = {
  headline: string;
  body: string;
  tags: Tag[];
  precedence: Precedence;
  placeLabel?: string | null;
  lat?: number | null;
  lng?: number | null;
  /**
   * Phrases used to link this story to ingested articles, so the detail sheet
   * can offer the original reporting. Matched case-insensitively against
   * article titles.
   */
  match?: string[];
};

export type AuthoredBrief = {
  date: string;
  title?: string;
  bluf?: string | null;
  stories: AuthoredStory[];
};

export function authoredBriefPath(date: string): string {
  return path.join(process.cwd(), "content", "briefs", `${date}.json`);
}

export async function loadAuthoredBrief(date: string): Promise<AuthoredBrief | null> {
  try {
    const raw = await readFile(authoredBriefPath(date), "utf8");
    const parsed = JSON.parse(raw) as AuthoredBrief;
    if (!Array.isArray(parsed.stories) || parsed.stories.length === 0) return null;
    return { ...parsed, date };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Links an authored story to real ingested articles.
 *
 * Every match phrase must appear in the title for a hit, so a phrase like
 * "Strait of Hormuz" behaves as intended rather than matching any "strait".
 */
async function findRelatedArticles(match: string[] | undefined): Promise<string[]> {
  if (!match || match.length === 0) return [];

  const rows = await prisma.article.findMany({
    select: { id: true, title: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: (await loadSettings()).holdingsMax,
  });

  const needles = match.map((m) => m.toLowerCase());
  return rows
    .filter((row) => {
      const title = row.title.toLowerCase();
      return needles.some((needle) =>
        needle
          .split("+")
          .map((part) => part.trim())
          .filter(Boolean)
          .every((part) => title.includes(part)),
      );
    })
    .slice(0, 8)
    .map((row) => row.id);
}

export type ImportResult = {
  date: string;
  title: string;
  storyCount: number;
  linkedArticles: number;
};

export async function importAuthoredBrief(brief: AuthoredBrief): Promise<ImportResult> {
  const stories: StoryDraft[] = [];

  for (let i = 0; i < brief.stories.length; i++) {
    const story = brief.stories[i];
    const relatedArticleIds = await findRelatedArticles(story.match);

    // Use the lead related article's image so the story gets a globe thumbnail.
    let imageUrl: string | null = null;
    if (relatedArticleIds.length > 0) {
      const withImage = await prisma.article.findFirst({
        where: { id: { in: relatedArticleIds }, imageUrl: { not: null } },
        select: { imageUrl: true },
      });
      imageUrl = withImage?.imageUrl ?? null;
    }

    stories.push({
      headline: story.headline,
      body: story.body,
      tags: story.tags,
      precedence: story.precedence,
      placeLabel: story.placeLabel ?? null,
      lat: story.lat ?? null,
      lng: story.lng ?? null,
      imageUrl,
      relatedArticleIds,
      sortOrder: i,
    });
  }

  const title = brief.title ?? briefTitle(brief.date);
  await writeBrief({
    date: brief.date,
    title,
    bluf: brief.bluf ?? null,
    source: "authored",
    stories,
  });

  return {
    date: brief.date,
    title,
    storyCount: stories.length,
    linkedArticles: stories.reduce((sum, s) => sum + s.relatedArticleIds.length, 0),
  };
}
