import { prisma } from "./db";

/** Hard cap on stored reporting. Oldest items (by publication, then ingest) go first. */
export const MAX_ARTICLES = 300;

export async function pruneOldestArticles(): Promise<number> {
  const extra = (await prisma.article.count()) - MAX_ARTICLES;
  if (extra <= 0) return 0;

  const rows = await prisma.article.findMany({
    select: { id: true, publishedAt: true, createdAt: true },
  });
  if (rows.length <= MAX_ARTICLES) return 0;

  const drop = [...rows]
    .sort((a, b) => articleAge(a) - articleAge(b))
    .slice(0, rows.length - MAX_ARTICLES)
    .map((row) => row.id);

  if (drop.length === 0) return 0;
  await prisma.article.deleteMany({ where: { id: { in: drop } } });
  return drop.length;
}

function articleAge(row: { publishedAt: Date | null; createdAt: Date }): number {
  return (row.publishedAt ?? row.createdAt).getTime();
}
