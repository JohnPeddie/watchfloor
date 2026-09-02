import { NextRequest, NextResponse } from "next/server";
import { getMarkets } from "@/lib/markets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const markets = await getMarkets(force);
  return NextResponse.json({ markets });
}
