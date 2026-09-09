import * as cheerio from "cheerio";
import { prisma } from "./db";
import { geocodeText } from "./geocode";
import type { HazardMark, HazardsPayload } from "./hazard-geometry";

const CACHE_KEY = "overlayHazards";
const CACHE_MS = 30 * 60 * 1000;
const USER_AGENT = "WATCHFLOOR/1.0 (local OSINT dashboard)";

/**
 * Wikipedia names the conflict; these hints put the disc on the fighting
 * rather than a capital the gazetteer would otherwise choose.
 */
const THEATRE_HINTS: { test: RegExp; label: string; lat: number; lng: number; radiusKm: number }[] = [
  { test: /arab[-–— ]?israeli|iran[-–— ]israel|\bgaza\b|hamas/i, label: "Gaza / Levant", lat: 31.7, lng: 35.0, radiusKm: 180 },
  { test: /russo[-–— ]?ukrain|ukraine/i, label: "Ukraine", lat: 48.4, lng: 37.0, radiusKm: 340 },
  { test: /syrian|\bsyria\b/i, label: "Syria", lat: 35.2, lng: 38.0, radiusKm: 220 },
  { test: /lebanon|hezbollah/i, label: "Lebanon", lat: 33.85, lng: 35.6, radiusKm: 90 },
  { test: /\bsudan\b|rsf|rapid support/i, label: "Sudan", lat: 13.5, lng: 25.5, radiusKm: 320 },
  { test: /myanmar|burma|rohingya/i, label: "Myanmar", lat: 21.0, lng: 96.1, radiusKm: 260 },
  { test: /yemen|houthi/i, label: "Yemen", lat: 15.4, lng: 47.0, radiusKm: 240 },
  { test: /\bsomalia\b|al[-–— ]?shabaab/i, label: "Somalia", lat: 5.2, lng: 46.2, radiusKm: 280 },
  { test: /sahel|\bmali\b|burkina|\bniger\b/i, label: "Sahel", lat: 14.5, lng: 0.2, radiusKm: 380 },
  { test: /kivu|m23|\bcongo\b/i, label: "Eastern Congo", lat: -1.7, lng: 29.2, radiusKm: 220 },
  { test: /ethiopia|amhara|tigray|\bfano\b/i, label: "Ethiopia", lat: 11.6, lng: 39.2, radiusKm: 240 },
  { test: /\bhaiti\b/i, label: "Haiti", lat: 18.54, lng: -72.34, radiusKm: 80 },
  { test: /colombian|\bcolombia\b/i, label: "Colombia", lat: 4.57, lng: -74.3, radiusKm: 280 },
  { test: /ecuador/i, label: "Ecuador", lat: -0.18, lng: -78.47, radiusKm: 160 },
  { test: /nagorno|karabakh|armenia|azerbaijan/i, label: "South Caucasus", lat: 39.8, lng: 46.8, radiusKm: 120 },
  { test: /nigeria|boko haram|iswap/i, label: "North-east Nigeria", lat: 11.8, lng: 13.2, radiusKm: 220 },
];

type GeoJsonPoint = {
  type?: string;
  features?: Array<{
    geometry?: { type?: string; coordinates?: number[] };
    properties?: Record<string, unknown>;
  }>;
};

type NhcStorms = {
  activeStorms?: Array<{
    id?: string;
    name?: string;
    classification?: string;
    intensity?: string | number;
    pressure?: string | number;
    latitudeNumeric?: number;
    longitudeNumeric?: number;
    lastUpdate?: string;
  }>;
};

function emptyPayload(): HazardsPayload {
  return { warzones: [], storms: [], fetchedAt: new Date().toISOString() };
}

async function fetchJson<T>(url: string, timeoutMs: number, extraHeaders?: Record<string, string>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...extraHeaders,
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseCached(raw: string): HazardsPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<HazardsPayload>;
    if (!Array.isArray(parsed.warzones) || !Array.isArray(parsed.storms)) return null;
    return {
      warzones: parsed.warzones,
      storms: parsed.storms,
      fetchedAt: parsed.fetchedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function cleanText(value: string): string {
  return value.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

function placeForConflict(name: string, location: string): { label: string; lat: number; lng: number; radiusKm: number } | null {
  const haystack = `${name} ${location}`;
  const hint = THEATRE_HINTS.find((item) => item.test.test(haystack));
  if (hint) return hint;
  const hit = geocodeText(name, location);
  if (!hit) return null;
  return { label: hit.label, lat: hit.lat, lng: hit.lng, radiusKm: 200 };
}

function near(a: { lat: number; lng: number }, b: { lat: number; lng: number }, deg: number): boolean {
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return dLat * dLat + dLng * dLng < deg * deg;
}

function dedupe(marks: HazardMark[], deg: number): HazardMark[] {
  const kept: HazardMark[] = [];
  for (const mark of marks) {
    const existing = kept.find((item) => near(item, mark, deg));
    if (!existing) {
      kept.push(mark);
      continue;
    }
    if (mark.radiusKm > existing.radiusKm) {
      kept.splice(kept.indexOf(existing), 1, mark);
    }
  }
  return kept;
}

async function fetchWarzones(): Promise<HazardMark[]> {
  const data = await fetchJson<{ parse?: { text?: string } }>(
    "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_ongoing_armed_conflicts&prop=text&format=json&formatversion=2",
    18000,
  );
  const html = data.parse?.text;
  if (!html) return [];

  const $ = cheerio.load(html);
  const marks: HazardMark[] = [];
  const tables: { selector: string; radiusKm: number; extreme: boolean }[] = [
    { selector: "#conflicts10000", radiusKm: 300, extreme: true },
    { selector: "#conflicts1000", radiusKm: 180, extreme: false },
  ];

  for (const table of tables) {
    $(table.selector)
      .find("tr")
      .each((index, row) => {
        if (index === 0) return;
        const cells = $(row).children("td");
        if (cells.length < 4) return;
        const conflictCell = cells.eq(1);
        const locationCell = cells.eq(3);
        const name = cleanText(
          conflictCell.find("a").first().attr("title") ||
            conflictCell.find("a").first().text() ||
            conflictCell.text(),
        );
        const location = cleanText(
          locationCell
            .find("a")
            .map((_, el) => $(el).text())
            .get()
            .filter((text) => text && !/^\[/.test(text))
            .join(", ") || locationCell.text(),
        );
        if (!name) return;
        const place = placeForConflict(name, location);
        if (!place) return;
        marks.push({
          id: `war:${slug(name)}`,
          kind: "warzone",
          label: name.replace(/\s*\(.*$/, "").slice(0, 48),
          detail: location ? `${place.label} · ${location}` : place.label,
          lat: place.lat,
          lng: place.lng,
          radiusKm: Math.max(place.radiusKm, table.radiusKm * 0.7),
          severity: table.extreme ? "extreme" : "high",
        });
      });
  }

  return dedupe(marks, 1.6);
}

function hurricaneCategory(knots: number): number {
  if (knots >= 137) return 5;
  if (knots >= 113) return 4;
  if (knots >= 96) return 3;
  if (knots >= 83) return 2;
  if (knots >= 64) return 1;
  return 0;
}

function stormRadius(category: number): number {
  if (category >= 3) return 260;
  if (category >= 1) return 170;
  return 140;
}

async function fetchNhcStorms(): Promise<HazardMark[]> {
  const data = await fetchJson<NhcStorms>("https://www.nhc.noaa.gov/CurrentStorms.json", 12000);
  const marks: HazardMark[] = [];
  for (const storm of data.activeStorms ?? []) {
    const knots = Number(storm.intensity);
    const category = hurricaneCategory(knots);
    const classCode = (storm.classification ?? "").toUpperCase();
    const isHurricane = classCode === "HU" || classCode === "MH" || category >= 1;
    if (!isHurricane || !Number.isFinite(storm.latitudeNumeric) || !Number.isFinite(storm.longitudeNumeric)) {
      continue;
    }
    const name = (storm.name ?? "Cyclone").trim();
    marks.push({
      id: `storm:${(storm.id ?? slug(name)).toLowerCase()}`,
      kind: "storm",
      label: name,
      detail: `Hurricane Cat ${Math.max(category, 1)} · ${knots || "—"} kt`,
      lat: storm.latitudeNumeric as number,
      lng: storm.longitudeNumeric as number,
      radiusKm: stormRadius(Math.max(category, 1)),
      severity: category >= 3 ? "extreme" : "high",
    });
  }
  return marks;
}

function readProp(props: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!props) return null;
  for (const key of keys) {
    const value = props[key] ?? props[key.toLowerCase()] ?? props[key.toUpperCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

async function fetchGdacsStorms(): Promise<HazardMark[]> {
  const from = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&fromdate=${from}&todate=${to}&alertlevel=Red;Orange`;
  const data = await fetchJson<GeoJsonPoint>(url, 12000);
  const marks: HazardMark[] = [];
  const staleBefore = Date.now() - 4 * 24 * 60 * 60 * 1000;

  for (const feature of data.features ?? []) {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const props = feature.properties ?? {};
    const alert = (readProp(props, ["alertlevel", "alertLevel"]) ?? "").toLowerCase();
    if (alert !== "red" && alert !== "orange") continue;
    const toDate = readProp(props, ["todate", "toDate", "todateutc"]);
    const fromDate = readProp(props, ["fromdate", "fromDate"]);
    const fromMs = Date.parse(fromDate ?? "");
    const toMs = Date.parse(toDate ?? "");
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
    if (alert !== "red" && Number.isFinite(fromMs) && fromMs < sixDaysAgo) continue;
    if (Number.isFinite(toMs) && toMs < staleBefore) continue;
    const rawName = readProp(props, ["eventname", "name", "eventName"]) ?? "Cyclone";
    const name = rawName.replace(/-\d+$/, "").replace(/\s+/g, " ").trim();
    const extreme = alert === "red";
    marks.push({
      id: `storm:gdacs-${slug(rawName)}`,
      kind: "storm",
      label: name,
      detail: `GDACS ${alert} tropical cyclone`,
      lat,
      lng,
      radiusKm: extreme ? 240 : 170,
      severity: extreme ? "extreme" : "high",
    });
  }
  return marks;
}

async function fetchStorms(): Promise<HazardMark[]> {
  const [nhc, gdacs] = await Promise.allSettled([fetchNhcStorms(), fetchGdacsStorms()]);
  const marks: HazardMark[] = [];
  if (nhc.status === "fulfilled") marks.push(...nhc.value);
  if (gdacs.status === "fulfilled") {
    for (const storm of gdacs.value) {
      if (marks.some((item) => near(item, storm, 5))) continue;
      marks.push(storm);
    }
  }
  return marks;
}

export async function getHazards(force = false): Promise<HazardsPayload> {
  const cachedRow = await prisma.meta.findUnique({ where: { key: CACHE_KEY } });
  const cached = cachedRow ? parseCached(cachedRow.value) : null;
  const age = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
  if (!force && cached && age < CACHE_MS) return cached;

  try {
    const [warzones, storms] = await Promise.all([
      fetchWarzones().catch(() => cached?.warzones ?? []),
      fetchStorms().catch(() => cached?.storms ?? []),
    ]);
    const payload: HazardsPayload = {
      warzones,
      storms,
      fetchedAt: new Date().toISOString(),
    };
    await prisma.meta.upsert({
      where: { key: CACHE_KEY },
      create: { key: CACHE_KEY, value: JSON.stringify(payload) },
      update: { value: JSON.stringify(payload) },
    });
    return payload;
  } catch {
    return cached ?? emptyPayload();
  }
}
