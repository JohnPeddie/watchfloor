import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toBriefStoryDTO } from "@/lib/serializers";

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

  return NextResponse.json({
    brief: {
      id: brief.id,
      date: brief.date,
      title: brief.title,
      stories: brief.stories.map(toBriefStoryDTO),
    },
  });
}
