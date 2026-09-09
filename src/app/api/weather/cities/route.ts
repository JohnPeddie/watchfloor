import { NextRequest, NextResponse } from "next/server";
import { searchCities } from "@/lib/weather-cities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const cities = await searchCities(q);
    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json({ cities: [] });
  }
}
