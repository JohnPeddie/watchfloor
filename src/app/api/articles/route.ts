import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toArticleDTO } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lane = req.nextUrl.searchParams.get("lane");
  const tag = req.nextUrl.searchParams.get("tag");
  const precedence = req.nextUrl.searchParams.get("precedence");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 60), 200);

  const articles = await prisma.article.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  let filtered = articles;
  if (lane) {
    filtered = filtered.filter((a) => parseList(a.lanes).includes(lane));
  }
  if (tag) {
    filtered = filtered.filter((a) => parseList(a.tags).includes(tag));
  }
  if (precedence) {
    filtered = filtered.filter((a) => a.precedence === precedence);
  }
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(needle) ||
        (a.summary ?? "").toLowerCase().includes(needle) ||
        a.sourceName.toLowerCase().includes(needle) ||
        (a.placeLabel ?? "").toLowerCase().includes(needle),
    );
  }

  const lastIngest = await prisma.meta.findUnique({ where: { key: "lastIngestAt" } });

  const tagCounts: Record<string, number> = {};
  for (const a of articles) {
    for (const t of parseList(a.tags)) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }
  const precedenceCounts: Record<string, number> = {};
  for (const a of articles) {
    precedenceCounts[a.precedence] = (precedenceCounts[a.precedence] ?? 0) + 1;
  }

  return NextResponse.json({
    articles: filtered.slice(0, limit).map(toArticleDTO),
    total: articles.length,
    matched: filtered.length,
    tagCounts,
    precedenceCounts,
    lastIngestAt: lastIngest?.value ?? null,
  });
}

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
