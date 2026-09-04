import { prisma } from "./db";

export type RunKind = "ingest" | "brief" | "llm";

export type RunRecord = {
  kind: RunKind;
  durationMs: number;
  ok: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string | null;
  provider?: string | null;
  stories?: number;
  fellBack?: boolean;
  detail?: string | null;
  startedAt?: Date;
};

export async function recordRun(entry: RunRecord): Promise<void> {
  try {
    await prisma.runLog.create({
      data: {
        kind: entry.kind,
        startedAt: entry.startedAt ?? new Date(Date.now() - entry.durationMs),
        durationMs: Math.max(0, Math.round(entry.durationMs)),
        ok: entry.ok,
        created: entry.created ?? null,
        updated: entry.updated ?? null,
        skipped: entry.skipped ?? null,
        promptTokens: entry.promptTokens ?? null,
        completionTokens: entry.completionTokens ?? null,
        totalTokens: entry.totalTokens ?? null,
        model: entry.model ?? null,
        provider: entry.provider ?? null,
        stories: entry.stories ?? null,
        fellBack: entry.fellBack ?? null,
        detail: entry.detail ?? null,
      },
    });
  } catch (error) {
    console.warn("Failed to record run log:", error);
  }
}
