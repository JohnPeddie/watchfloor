import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadLlmRuntime } from "@/lib/summarize/runtime-config";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness probe.
 *
 * Used by the container healthcheck and by anything monitoring the box on the
 * LAN. Returns 200 only when the database is actually reachable, so a running
 * process with a broken volume mount is reported as unhealthy.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    const [articles, briefs, lastIngest, latestBrief] = await Promise.all([
      prisma.article.count(),
      prisma.dailyBrief.count(),
      prisma.meta.findUnique({ where: { key: "lastIngestAt" } }),
      prisma.dailyBrief.findFirst({
        orderBy: { date: "desc" },
        select: { date: true, source: true, _count: { select: { stories: true } } },
      }),
    ]);

    const lastIngestAt = lastIngest?.value ?? null;
    const ingestAgeMinutes = lastIngestAt
      ? Math.round((Date.now() - new Date(lastIngestAt).getTime()) / 60000)
      : null;

    const runtime = await loadLlmRuntime();

    return NextResponse.json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      checkMs: Date.now() - startedAt,
      database: { reachable: true, articles, briefs },
      ingest: { lastIngestAt, ageMinutes: ingestAgeMinutes },
      brief: latestBrief
        ? {
            date: latestBrief.date,
            source: latestBrief.source,
            stories: latestBrief._count.stories,
          }
        : null,
      summarizer: {
        configured: runtime.choice,
        ollamaBaseUrl: runtime.ollamaBaseUrl,
        ollamaModel: runtime.ollamaModel || null,
        openaiBaseUrl: runtime.openaiBaseUrl,
        openaiModel: runtime.openaiModel || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        checkMs: Date.now() - startedAt,
        database: { reachable: false },
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
