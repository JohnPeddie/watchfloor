import { NextRequest, NextResponse } from "next/server";
import type { Tag } from "@/lib/classify";
import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/serializers";
import { resolveProvider } from "@/lib/summarize";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Operator-asked rewrite of a single article's "why it matters" line.
 *
 * The stream stays rules-only; this is the one per-article LLM path, and it
 * only runs when someone clicks the button on the open report.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }

  const resolved = await resolveProvider();
  if (resolved.requestedId === "rules") {
    return NextResponse.json(
      { error: "No local LLM is configured. Pick Ollama or LM Studio in Settings." },
      { status: 400 },
    );
  }
  if (resolved.fellBack || !resolved.provider.writeImplication) {
    return NextResponse.json(
      {
        error:
          resolved.health.detail ??
          "Local LLM is offline. The dashboard still works; this rewrite needs the model host.",
      },
      { status: 503 },
    );
  }

  try {
    const implication = await resolved.provider.writeImplication({
      id: article.id,
      title: article.title,
      url: article.url,
      sourceName: article.sourceName,
      summary: article.rawExcerpt ?? article.summary,
      bodyText: article.bodyText,
      tags: parseJsonArray(article.tags) as Tag[],
      placeLabel: article.placeLabel,
    });
    if (!implication) {
      return NextResponse.json(
        { error: "The model returned no usable why-it-matters line." },
        { status: 502 },
      );
    }

    const source = resolved.health.model
      ? `${resolved.provider.id}:${resolved.health.model}`
      : resolved.provider.id;
    const updated = await prisma.article.update({
      where: { id: article.id },
      data: {
        implication,
        implicationSource: source,
      },
    });

    return NextResponse.json({
      implication: updated.implication,
      implicationSource: updated.implicationSource,
      model: resolved.health.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await resolved.provider.release?.();
  }
}
