import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Tag } from "@/lib/classify";
import { mapLimit } from "@/lib/extract";
import { parseJsonArray } from "@/lib/serializers";
import { resolveProvider } from "@/lib/summarize";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Re-summarises a bounded batch of articles with the active provider.
 *
 * Deliberately batched: an LLM pass over the whole corpus would outlast any
 * sensible HTTP timeout. A scheduled job calls this each cycle and the backlog
 * drains over time. Targets articles with no summary, or one produced by a
 * different provider than the one now configured.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    all?: boolean;
  };
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 100);

  const { provider, health, fellBack, requestedId } = await resolveProvider();
  const source = provider.model ? `${provider.id}:${provider.model}` : provider.id;

  // Nothing to gain from re-running the offline engine over its own output.
  if (fellBack && provider.id === "rules") {
    return NextResponse.json(
      {
        skipped: true,
        reason: `${requestedId} unavailable: ${health.detail ?? "unreachable"}`,
        provider: source,
        updated: 0,
      },
      { status: 200 },
    );
  }

  const articles = await prisma.article.findMany({
    where: body.all ? {} : { OR: [{ analysis: null }, { analysisSource: { not: source } }] },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  let updated = 0;
  let failed = 0;

  await mapLimit(articles, provider.id === "rules" ? 6 : 2, async (article) => {
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
    } catch {
      failed += 1;
    }
  });

  const remaining = await prisma.article.count({
    where: { OR: [{ analysis: null }, { analysisSource: { not: source } }] },
  });

  return NextResponse.json({
    provider: source,
    fellBack,
    considered: articles.length,
    updated,
    failed,
    remaining,
  });
}
