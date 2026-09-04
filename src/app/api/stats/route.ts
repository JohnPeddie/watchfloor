import { NextResponse } from "next/server";
import { loadOpsSnapshot } from "@/lib/ops";
import { startScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  startScheduler();
  const snapshot = await loadOpsSnapshot();
  return NextResponse.json(snapshot);
}
