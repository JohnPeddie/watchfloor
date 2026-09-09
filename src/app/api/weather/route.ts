import { NextRequest, NextResponse } from "next/server";
import { loadSettings, parseSettings, saveSettings } from "@/lib/settings";
import { getWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const weather = await getWeather(force);
  return NextResponse.json(weather);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.weatherCity !== "string" || !body.weatherCity.trim()) {
    return NextResponse.json({ error: "city required" }, { status: 400 });
  }
  const current = await loadSettings();
  await saveSettings(
    parseSettings({
      ...current,
      weatherCity: body.weatherCity,
      weatherLat: body.weatherLat,
      weatherLng: body.weatherLng,
      weatherTimezone: body.weatherTimezone,
      weatherCountry: body.weatherCountry,
    }),
  );
  const weather = await getWeather(true);
  return NextResponse.json(weather);
}
