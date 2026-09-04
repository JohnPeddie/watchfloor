import { NextRequest, NextResponse } from "next/server";
import { getHazards } from "@/lib/hazards";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const hazards = await getHazards(force);
  return NextResponse.json(hazards);
}
