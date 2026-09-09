import { NextRequest, NextResponse } from "next/server";
import { getThreatLevel } from "@/lib/threat";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const threat = await getThreatLevel(force);
  return NextResponse.json(threat);
}
