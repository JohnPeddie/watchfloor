import { prisma } from "./db";
import {
  THREAT_MEANINGS,
  THREAT_SOURCE_URL,
  type ThreatBand,
  type ThreatPayload,
} from "./threat-types";

export type { ThreatBand, ThreatPayload } from "./threat-types";

const CACHE_KEY = "ukThreatLevel";
const CACHE_MS = 20 * 60 * 1000;
const USER_AGENT = "WATCHFLOOR/1.0 (local OSINT dashboard)";
const FEED_URL = "https://www.mi5.gov.uk/UKThreatLevel/UKThreatLevel.xml";

const BANDS: ThreatBand[] = ["critical", "severe", "substantial", "moderate", "low"];

function emptyPayload(): ThreatPayload {
  return {
    level: null,
    meaning: "",
    northernIreland: null,
    source: "MI5 / JTAC",
    sourceUrl: THREAT_SOURCE_URL,
    changedAt: null,
    fetchedAt: new Date().toISOString(),
  };
}

function parseBand(text: string): ThreatBand | null {
  const match = text.match(/\b(CRITICAL|SEVERE|SUBSTANTIAL|MODERATE|LOW)\b/i);
  if (!match) return null;
  const band = match[1].toLowerCase() as ThreatBand;
  return BANDS.includes(band) ? band : null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function firstTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function fromCache(raw: string): ThreatPayload | null {
  try {
    const parsed = JSON.parse(raw) as ThreatPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return { ...emptyPayload(), ...parsed };
  } catch {
    return null;
  }
}

function parseFeed(xml: string): Pick<ThreatPayload, "level" | "northernIreland" | "changedAt"> {
  const item = xml.match(/<item>([\s\S]*?)<\/item>/i)?.[1] ?? xml;
  const title = stripTags(firstTag(item, "title"));
  const description = stripTags(firstTag(item, "description"));
  const haystack = `${title} ${description}`;
  const level = parseBand(title) ?? parseBand(haystack);
  const niChunk = haystack.match(/northern ireland[\s\S]{0,80}/i)?.[0] ?? "";
  const changedRaw = firstTag(xml, "lastBuildDate") || firstTag(item, "pubDate");
  const changed = changedRaw ? new Date(changedRaw) : null;
  return {
    level,
    northernIreland: niChunk ? parseBand(niChunk) : null,
    changedAt: changed && !Number.isNaN(changed.getTime()) ? changed.toISOString() : null,
  };
}

export async function getThreatLevel(force = false): Promise<ThreatPayload> {
  const row = await prisma.meta.findUnique({ where: { key: CACHE_KEY } });
  const cached = row ? fromCache(row.value) : null;
  const age = cached?.fetchedAt ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
  if (!force && cached?.level && age < CACHE_MS) return cached;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = parseFeed(xml);
    const payload: ThreatPayload = {
      ...emptyPayload(),
      ...parsed,
      meaning: parsed.level ? THREAT_MEANINGS[parsed.level] : "",
      fetchedAt: new Date().toISOString(),
    };
    if (payload.level) {
      await prisma.meta.upsert({
        where: { key: CACHE_KEY },
        create: { key: CACHE_KEY, value: JSON.stringify(payload) },
        update: { value: JSON.stringify(payload) },
      });
    }
    return payload.level ? payload : cached ?? payload;
  } catch {
    return cached ?? emptyPayload();
  } finally {
    clearTimeout(timer);
  }
}
