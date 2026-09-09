import type { WeatherCityHit } from "./weather-types";

const USER_AGENT = "WATCHFLOOR/1.0 (local OSINT dashboard)";
const SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search";

type OpenMeteoPlace = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
};

export async function searchCities(query: string): Promise<WeatherCityHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];

  const url = `${SEARCH_URL}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { results?: OpenMeteoPlace[] };
    return (data.results ?? [])
      .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && row.name)
      .map((row) => {
        const name = row.name!.trim();
        const parts = [name, row.admin1, row.country].filter((part): part is string => Boolean(part?.trim()));
        return {
          id: row.id ?? Math.round((row.latitude ?? 0) * 10000 + (row.longitude ?? 0) * 100),
          name,
          label: parts.join(", "),
          lat: row.latitude as number,
          lng: row.longitude as number,
          timezone: row.timezone?.trim() || "auto",
          country: row.country?.trim() || "",
          countryCode: (row.country_code ?? "").trim().toUpperCase(),
        } satisfies WeatherCityHit;
      });
  } finally {
    clearTimeout(timer);
  }
}
