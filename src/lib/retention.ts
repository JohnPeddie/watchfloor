import { feedByCode, feedByName, ingestWeight } from "../../config/feeds";
import { HOLDINGS_MAX, HOLDINGS_MIN } from "./settings-types";
import { prisma } from "./db";

/** Fallback when a caller does not pass the live setting. */
export const MAX_ARTICLES = 300;

/** Niche feeds are treated as this much older at prune time, so BBC outlasts F1. */
const NICHE_AGE_PENALTY_MS = 24 * 36e5;

export async function pruneOldestArticles(max = MAX_ARTICLES): Promise<number> {
  const cap = Math.min(HOLDINGS_MAX, Math.max(HOLDINGS_MIN, Math.round(max)));
  const extra = (await prisma.article.count()) - cap;
  if (extra <= 0) return 0;

  const rows = await prisma.article.findMany({
    select: { id: true, publishedAt: true, createdAt: true, sourceCode: true, sourceName: true },
  });
  if (rows.length <= cap) return 0;

  const drop = [...rows]
    .sort((a, b) => keepScore(a) - keepScore(b))
    .slice(0, rows.length - cap)
    .map((row) => row.id);

  if (drop.length === 0) return 0;
  await prisma.article.deleteMany({ where: { id: { in: drop } } });
  return drop.length;
}

function keepScore(row: {
  publishedAt: Date | null;
  createdAt: Date;
  sourceCode: string;
  sourceName: string;
}): number {
  const feed = feedByCode(row.sourceCode) ?? feedByName(row.sourceName);
  const published = (row.publishedAt ?? row.createdAt).getTime();
  return published - (1 - ingestWeight(feed)) * NICHE_AGE_PENALTY_MS;
}
