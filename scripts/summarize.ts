import { prisma } from "../src/lib/db";
import { mapLimit } from "../src/lib/extract";
import { isLlmImplicationSource, parseJsonArray } from "../src/lib/serializers";
import { rulesProvider } from "../src/lib/summarize";
import type { Tag } from "../src/lib/classify";

/**
 * Re-applies the offline rules engine to stored articles (extractive
 * analysis, tag-driven implication). Article text is never sent to the LLM
 * here; the model is reserved for daily brief items and the on-demand
 * why-it-matters spark.
 */
function arg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const match = process.argv.find((a) => a.startsWith(prefix));
  const value = match ? Number(match.slice(prefix.length)) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  const all = process.argv.includes("--all");
  const limit = arg("limit", 0);

  const articles = await prisma.article.findMany({
    where: all ? {} : { OR: [{ analysis: null }, { analysisSource: { not: "rules" } }] },
    orderBy: { publishedAt: "desc" },
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(
    `Summarising ${articles.length} article(s) with rules` +
      (all ? " (--all)" : " (missing or non-rules only)"),
  );

  let updated = 0;
  let failed = 0;

  await mapLimit(articles, 8, async (article) => {
    try {
      const result = await rulesProvider.summariseArticle({
        id: article.id,
        title: article.title,
        url: article.url,
        sourceName: article.sourceName,
        summary: article.rawExcerpt ?? article.summary,
        bodyText: article.bodyText,
        tags: parseJsonArray(article.tags) as Tag[],
        placeLabel: article.placeLabel,
      });

      if (!result.analysis) return;

      const keepLlmImplication = isLlmImplicationSource(article.implicationSource);
      await prisma.article.update({
        where: { id: article.id },
        data: {
          analysis: result.analysis,
          implication: keepLlmImplication
            ? article.implication
            : (result.implication ?? article.implication),
          implicationSource: keepLlmImplication ? article.implicationSource : "rules",
          analysisSource: "rules",
          analysedAt: new Date(),
        },
      });
      updated += 1;
      if (updated % 25 === 0) console.log(`  ...${updated} updated`);
    } catch (error) {
      failed += 1;
      console.warn(
        `  ! ${article.title.slice(0, 60)}:`,
        error instanceof Error ? error.message : error,
      );
    }
  });

  console.log(
    JSON.stringify({ provider: "rules", considered: articles.length, updated, failed }, null, 2),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
