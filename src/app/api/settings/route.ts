import { NextRequest, NextResponse } from "next/server";
import { loadOpsSnapshot } from "@/lib/ops";
import { parseSettings, saveSettings } from "@/lib/settings";
import { startScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  startScheduler();
  const snapshot = await loadOpsSnapshot();
  return NextResponse.json({
    settings: snapshot.settings,
    timezone: snapshot.timezone,
    schedule: snapshot.schedule,
  });
}

export async function PUT(req: NextRequest) {
  startScheduler();
  const body = (await req.json().catch(() => ({}))) as unknown;
  const settings = await saveSettings(parseSettings(body));
  const snapshot = await loadOpsSnapshot();
  return NextResponse.json({
    settings,
    timezone: snapshot.timezone,
    schedule: snapshot.schedule,
  });
}
