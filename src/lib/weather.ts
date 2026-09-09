import Parser from "rss-parser";
import { prisma } from "./db";
import { loadSettings } from "./settings";
import { DEFAULT_SETTINGS } from "./settings-types";
import type {
  WeatherCurrent,
  WeatherDay,
  WeatherPayload,
  WeatherWarning,
  WeatherWarningLevel,
} from "./weather-types";

export type {
  WeatherCurrent,
  WeatherDay,
  WeatherPayload,
  WeatherWarning,
  WeatherWarningLevel,
} from "./weather-types";

const CACHE_KEY = "ukWeather";
const CACHE_MS = 20 * 60 * 1000;
const USER_AGENT = "WATCHFLOOR/1.0 (local OSINT dashboard)";

const UK_WARNINGS = "https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/UK";
const SE_WARNINGS = "https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/se";

type WeatherPlace = {
  city: string;
  lat: number;
  lng: number;
  timezone: string;
  country: string;
};

type OpenMeteo = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

function placeFromSettings(settings: {
  weatherCity: string;
  weatherLat: number;
  weatherLng: number;
  weatherTimezone: string;
  weatherCountry: string;
}): WeatherPlace {
  return {
    city: settings.weatherCity || DEFAULT_SETTINGS.weatherCity,
    lat: settings.weatherLat,
    lng: settings.weatherLng,
    timezone: settings.weatherTimezone || "auto",
    country: settings.weatherCountry || "",
  };
}

function emptyPayload(place: WeatherPlace): WeatherPayload {
  return {
    location: place.city,
    lat: place.lat,
    lng: place.lng,
    timezone: place.timezone,
    country: place.country,
    current: null,
    forecast: [],
    warnings: [],
    fetchedAt: new Date().toISOString(),
  };
}

function samePlace(payload: WeatherPayload, place: WeatherPlace): boolean {
  return Math.abs(payload.lat - place.lat) < 0.05 && Math.abs(payload.lng - place.lng) < 0.05;
}

function forecastUrl(place: WeatherPlace): string {
  const tz = encodeURIComponent(place.timezone || "auto");
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lng}` +
    "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,precipitation" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum" +
    `&timezone=${tz}&forecast_days=5&wind_speed_unit=kmh`
  );
}

export function weatherSummary(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunder";
  return "Mixed";
}

function warningLevel(title: string): WeatherWarningLevel {
  const head = title.trim().toLowerCase();
  if (head.startsWith("red")) return "red";
  if (head.startsWith("amber")) return "amber";
  if (head.startsWith("yellow")) return "yellow";
  return "unknown";
}

function isGb(country: string): boolean {
  const code = country.trim().toUpperCase();
  return code === "GB" || code === "UK" || code === "UNITED KINGDOM";
}

function isLondon(city: string): boolean {
  return /\blondon\b/i.test(city);
}

function mentionsPlace(text: string, city: string): boolean {
  const name = city.trim();
  if (name.length < 3) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function mentionsSouthEast(text: string): boolean {
  return /south east england|south-east england|greater london/i.test(text);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function fromCache(raw: string): WeatherPayload | null {
  try {
    const parsed = JSON.parse(raw) as WeatherPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      location: typeof parsed.location === "string" ? parsed.location : DEFAULT_SETTINGS.weatherCity,
      lat: parsed.lat,
      lng: parsed.lng,
      timezone: parsed.timezone || DEFAULT_SETTINGS.weatherTimezone,
      country: parsed.country || "",
      current: parsed.current ?? null,
      forecast: Array.isArray(parsed.forecast) ? parsed.forecast : [],
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((warning) => ({
            ...warning,
            local: Boolean(warning.local || (warning as { london?: boolean }).london),
          }))
        : [],
      fetchedAt: parsed.fetchedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseForecast(data: OpenMeteo): Pick<WeatherPayload, "current" | "forecast"> {
  const c = data.current;
  const current: WeatherCurrent | null = c
    ? {
        tempC: c.temperature_2m ?? 0,
        feelsLikeC: c.apparent_temperature ?? c.temperature_2m ?? 0,
        humidity: c.relative_humidity_2m ?? 0,
        windKph: c.wind_speed_10m ?? 0,
        precipMm: c.precipitation ?? 0,
        weatherCode: c.weather_code ?? 0,
        summary: weatherSummary(c.weather_code ?? 0),
        time: c.time ?? new Date().toISOString(),
      }
    : null;

  const daily = data.daily;
  const forecast: WeatherDay[] = [];
  const days = daily?.time?.length ?? 0;
  for (let i = 0; i < days; i++) {
    const code = daily?.weather_code?.[i] ?? 0;
    forecast.push({
      date: daily?.time?.[i] ?? "",
      weatherCode: code,
      summary: weatherSummary(code),
      maxC: daily?.temperature_2m_max?.[i] ?? 0,
      minC: daily?.temperature_2m_min?.[i] ?? 0,
      rainChance: daily?.precipitation_probability_max?.[i] ?? 0,
    });
  }
  return { current, forecast };
}

function warningFeeds(place: WeatherPlace): Array<{ region: string; url: string }> {
  const feeds = [{ region: "uk", url: UK_WARNINGS }];
  if (isLondon(place.city) && (isGb(place.country) || !place.country)) {
    feeds.unshift({ region: "london", url: SE_WARNINGS });
  }
  return feeds;
}

async function fetchWarnings(place: WeatherPlace): Promise<WeatherWarning[]> {
  const parser = new Parser({ timeout: 12_000 });
  const batches = await Promise.all(
    warningFeeds(place).map(async (feed) => {
      try {
        const xml = await fetchText(feed.url, 12_000);
        const parsed = await parser.parseString(xml);
        return (parsed.items ?? []).map((item, index) => {
          const extra = item as { summary?: string; guid?: string };
          const title = item.title?.trim() || "Weather warning";
          const summary = stripHtml(item.contentSnippet || item.content || extra.summary || "");
          const haystack = `${title} ${summary}`;
          const local =
            mentionsPlace(haystack, place.city) ||
            (isLondon(place.city) && (feed.region === "london" || mentionsSouthEast(haystack)));
          return {
            id: extra.guid || item.link || `${feed.region}-${index}-${title}`,
            title,
            summary,
            link: item.link || "https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings",
            level: warningLevel(title),
            local,
            region: feed.region,
          } satisfies WeatherWarning;
        });
      } catch {
        return [] as WeatherWarning[];
      }
    }),
  );

  const rank: Record<WeatherWarningLevel, number> = { red: 0, amber: 1, yellow: 2, unknown: 3 };
  const seen = new Set<string>();
  const merged: WeatherWarning[] = [];
  for (const warning of batches.flat()) {
    const key = warning.title.toLowerCase();
    if (seen.has(key)) {
      const existing = merged.find((w) => w.title.toLowerCase() === key);
      if (existing && warning.local) existing.local = true;
      continue;
    }
    seen.add(key);
    merged.push(warning);
  }
  merged.sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    return rank[a.level] - rank[b.level];
  });
  return merged;
}

export async function getWeather(force = false): Promise<WeatherPayload> {
  const place = placeFromSettings(await loadSettings());
  const row = await prisma.meta.findUnique({ where: { key: CACHE_KEY } });
  const cached = row ? fromCache(row.value) : null;
  const age = cached?.fetchedAt ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
  if (!force && cached && age < CACHE_MS && samePlace(cached, place)) {
    return { ...cached, location: place.city, country: place.country, timezone: cached.timezone || place.timezone };
  }

  try {
    const [forecastRaw, warnings] = await Promise.all([
      fetchText(forecastUrl(place), 12_000),
      fetchWarnings(place),
    ]);
    const parsed = JSON.parse(forecastRaw) as OpenMeteo;
    const { current, forecast } = parseForecast(parsed);
    const payload: WeatherPayload = {
      location: place.city,
      lat: place.lat,
      lng: place.lng,
      timezone: parsed.timezone || place.timezone,
      country: place.country,
      current,
      forecast,
      warnings,
      fetchedAt: new Date().toISOString(),
    };
    await prisma.meta.upsert({
      where: { key: CACHE_KEY },
      create: { key: CACHE_KEY, value: JSON.stringify(payload) },
      update: { value: JSON.stringify(payload) },
    });
    return payload;
  } catch {
    if (cached && samePlace(cached, place)) return cached;
    return emptyPayload(place);
  }
}
