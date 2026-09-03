import { prisma } from "../src/lib/db";
import { mapLimit } from "../src/lib/extract";
import { parseJsonArray } from "../src/lib/serializers";
import { resolveProvider } from "../src/lib/summarize";
import type { Tag } from "../src/lib/classify";

/**
 * Re-summarises stored articles with the active provider.
 *
 * Default behaviour targets only what needs work: articles with no analysis,
 * or whose analysis came from a different provider than the one now
 * configured. So after pointing SUMMARIZER at Ollama, a single run upgrades
 * every rule-generated summary and later runs become no-ops.
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
  const { provider, health, fellBack, requestedId } = await resolveProvider();

  if (fellBack) {
    console.warn(
      `! ${requestedId} unavailable: ${health.detail ?? "no detail"}`,
      `\n  Falling back to ${provider.id}. Fix the host and re-run to upgrade summaries.`,
    );
  }

  const source = provider.model ? `${provider.id}:${provider.model}` : provider.id;
  // The LLM path is slow and sequentialish; the rules path is CPU-bound and cheap.
  const concurrency = arg("concurrency", provider.id === "rules" ? 8 : 2);

  const articles = await prisma.article.findMany({
    where: all ? {} : { OR: [{ analysis: null }, { analysisSource: { not: source } }] },
    orderBy: { publishedAt: "desc" },
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(
    `Summarising ${articles.length} article(s) with ${source}` +
      (all ? " (--all)" : " (missing or stale only)"),
  );

  let updated = 0;
  let failed = 0;

  await mapLimit(articles, concurrency, async (article) => {
    try {
      const result = await provider.summariseArticle({
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

      await prisma.article.update({
        where: { id: article.id },
        data: {
          analysis: result.analysis,
          implication: result.implication ?? article.implication,
          analysisSource: source,
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
    JSON.stringify(
      { provider: source, considered: articles.length, updated, failed, fellBack },
      null,
      2,
    ),
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
