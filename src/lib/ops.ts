import { prisma } from "./db";
import { startOfToday, zone } from "./clock";
import type { OpsSnapshot } from "./serializers";
import { allProviderHealth, configuredProviderId } from "./summarize";
import {
  briefIsDue,
  ingestIsDue,
  loadLastBriefAt,
  loadSettings,
  nextBriefAt,
  nextIngestAt,
} from "./settings";
import type { ProviderHealth } from "./summarize/types";

function pickLlmHost(
  health: ProviderHealth[],
  configured: string,
): ProviderHealth | undefined {
  if (configured === "openai" || configured === "ollama") {
    return health.find((p) => p.id === configured);
  }
  const openai = health.find((p) => p.id === "openai");
  const ollama = health.find((p) => p.id === "ollama");
  if (openai?.reachable) return openai;
  if (ollama?.reachable) return ollama;
  return openai ?? ollama;
}

export async function loadOpsSnapshot(): Promise<OpsSnapshot> {
  const settings = await loadSettings();
  const [lastIngestRow, lastBriefAt, holdings, todayArticles, llmHealth, ingestLogs, briefLogs, llmLogs] =
    await Promise.all([
      prisma.meta.findUnique({ where: { key: "lastIngestAt" } }),
      loadLastBriefAt(),
      prisma.article.count(),
      prisma.article.count({ where: { createdAt: { gte: startOfToday() } } }),
      allProviderHealth(),
      prisma.runLog.findMany({
        where: { kind: "ingest", startedAt: { gte: startOfToday() } },
        orderBy: { startedAt: "desc" },
      }),
      prisma.runLog.findMany({
        where: { kind: "brief", startedAt: { gte: startOfToday() } },
        orderBy: { startedAt: "desc" },
        take: 8,
      }),
      prisma.runLog.findMany({
        where: { kind: "llm", startedAt: { gte: startOfToday() } },
        orderBy: { startedAt: "desc" },
      }),
    ]);

  const lastIngestAt = lastIngestRow?.value ? new Date(lastIngestRow.value) : null;
  const configured = configuredProviderId();
  const llm = pickLlmHost(llmHealth, configured);

  const sum = (rows: typeof llmLogs, key: "promptTokens" | "completionTokens" | "totalTokens" | "durationMs") =>
    rows.reduce((acc, row) => acc + (row[key] ?? 0), 0);

  const lastBrief = briefLogs[0] ?? null;
  const lastIngestRun = ingestLogs[0] ?? null;

  return {
    timezone: zone(),
    settings,
    schedule: {
      ingestDue: ingestIsDue(settings, lastIngestAt),
      briefDue: briefIsDue(settings, lastBriefAt),
      nextIngestAt: nextIngestAt(settings, lastIngestAt)?.toISOString() ?? null,
      nextBriefAt: nextBriefAt(settings, lastBriefAt)?.toISOString() ?? null,
      lastIngestAt: lastIngestAt?.toISOString() ?? null,
      lastBriefAt: lastBriefAt?.toISOString() ?? null,
    },
    collection: {
      holdings,
      pulledToday: todayArticles,
      createdToday: ingestLogs.reduce((acc, row) => acc + (row.created ?? 0), 0),
      updatedToday: ingestLogs.reduce((acc, row) => acc + (row.updated ?? 0), 0),
      ingestRunsToday: ingestLogs.length,
      lastIngestDurationMs: lastIngestRun?.durationMs ?? null,
      lastIngestOk: lastIngestRun?.ok ?? null,
    },
    llm: {
      configured,
      reachable: llm?.reachable ?? false,
      model: llm?.model ?? null,
      label: llm?.label ?? null,
      detail: llm?.detail ?? null,
      probeMs: llm?.latencyMs ?? null,
      callsToday: llmLogs.length,
      promptTokensToday: sum(llmLogs, "promptTokens"),
      completionTokensToday: sum(llmLogs, "completionTokens"),
      totalTokensToday: sum(llmLogs, "totalTokens"),
      durationMsToday: sum(llmLogs, "durationMs"),
      lastCallMs: llmLogs[0]?.durationMs ?? null,
      lastModel: llmLogs[0]?.model ?? llm?.model ?? null,
    },
    brief: {
      runsToday: briefLogs.length,
      lastDurationMs: lastBrief?.durationMs ?? null,
      lastProvider: lastBrief?.provider ?? null,
      lastFellBack: lastBrief?.fellBack ?? null,
      lastStories: lastBrief?.stories ?? null,
      lastOk: lastBrief?.ok ?? null,
      lastModel: lastBrief?.model ?? null,
    },
  };
}
