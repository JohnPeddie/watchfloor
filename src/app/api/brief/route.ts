import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJsonArray, toBriefSourceDTO, toBriefStoryDTO } from "@/lib/serializers";
import { importAuthoredBrief, loadAuthoredBrief } from "@/lib/brief/authored";
import { generateBrief, todayUtc } from "@/lib/brief/generate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");

  const brief = date
    ? await prisma.dailyBrief.findUnique({
        where: { date },
        include: { stories: { orderBy: { sortOrder: "asc" } } },
      })
    : await prisma.dailyBrief.findFirst({
        orderBy: { date: "desc" },
        include: { stories: { orderBy: { sortOrder: "asc" } } },
      });

  if (!brief) {
    return NextResponse.json({ brief: null });
  }

  // Resolve every story's reports in one query so the source web can be drawn
  // without depending on which articles the client happens to have loaded.
  const sourceIds = [
    ...new Set(brief.stories.flatMap((s) => parseJsonArray(s.relatedArticleIds))),
  ];
  const sourceRows = sourceIds.length
    ? await prisma.article.findMany({ where: { id: { in: sourceIds } } })
    : [];
  const sourcesById = new Map(sourceRows.map((row) => [row.id, toBriefSourceDTO(row)]));

  return NextResponse.json({
    brief: {
      id: brief.id,
      date: brief.date,
      title: brief.title,
      bluf: brief.bluf,
      source: brief.source,
      stories: brief.stories.map((story) =>
        toBriefStoryDTO(
          story,
          parseJsonArray(story.relatedArticleIds)
            .map((id) => sourcesById.get(id))
            .filter((s): s is NonNullable<typeof s> => Boolean(s)),
        ),
      ),
    },
  });
}

/**
 * Rebuilds a brief on demand.
 *
 * An authored brief for the date wins unless `auto` is set, matching the CLI.
 * Lets a scheduled job on the server refresh the brief with a plain HTTP call
 * instead of shelling into the container.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    date?: string;
    auto?: boolean;
    maxStories?: number;
  };
  const date = body.date ?? todayUtc();

  if (!body.auto) {
    const authored = await loadAuthoredBrief(date);
    if (authored) {
      const result = await importAuthoredBrief(authored);
      return NextResponse.json({ mode: "authored", ...result });
    }
  }

  const result = await generateBrief({ date, maxStories: body.maxStories, minSources: 4 });
  return NextResponse.json({
    mode: "generated",
    date: result.date,
    title: result.title,
    provider: result.source,
    fellBack: result.fellBack,
    providerDetail: result.providerDetail,
    stories: result.stories.length,
    candidates: result.candidateCount,
  });
}
