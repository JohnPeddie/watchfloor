import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Tag } from "@/lib/classify";
import { mapLimit } from "@/lib/extract";
import { isLlmImplicationSource, parseJsonArray } from "@/lib/serializers";
import { rulesProvider } from "@/lib/summarize";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Re-applies the offline rules engine to a batch of articles.
 *
 * Per-article LLM summaries are not a thing: tagging and extractive analysis
 * stay on the rules engine. The local model writes daily brief items, and
 * an on-demand why-it-matters line when the operator asks.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    all?: boolean;
  };
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 200);

  const articles = await prisma.article.findMany({
    where: body.all ? {} : { OR: [{ analysis: null }, { analysisSource: { not: "rules" } }] },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

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
    } catch {
      failed += 1;
    }
  });

  const remaining = await prisma.article.count({
    where: { OR: [{ analysis: null }, { analysisSource: { not: "rules" } }] },
  });

  return NextResponse.json({
    provider: "rules",
    considered: articles.length,
    updated,
    failed,
    remaining,
  });
}
