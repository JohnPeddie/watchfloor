import type { ArticleDTO, BriefDTO } from "@/lib/serializers";

export const FLOOR_CACHE_KEY = "watchfloor:floor-cache";
export const MAX_CACHED_ARTICLES = 80;

/**
 * Last successful floor payload kept in localStorage so the daily brief can
 * paint immediately on the next open, then refresh from the API.
 */
export type FloorCacheSnapshot = {
  savedAt: string;
  brief: BriefDTO | null;
  articles: ArticleDTO[];
  allArticles: ArticleDTO[];
  tagCounts: Record<string, number>;
  precedenceCounts: Record<string, number>;
  total: number;
  matched: number;
  lastIngestAt: string | null;
};

const EMPTY: Omit<FloorCacheSnapshot, "savedAt"> = {
  brief: null,
  articles: [],
  allArticles: [],
  tagCounts: {},
  precedenceCounts: {},
  total: 0,
  matched: 0,
  lastIngestAt: null,
};

function isRecord(value: unknown): value is Record<string, number> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBrief(value: unknown): value is BriefDTO {
  if (!value || typeof value !== "object") return false;
  const brief = value as BriefDTO;
  return (
    typeof brief.id === "string" &&
    typeof brief.title === "string" &&
    Array.isArray(brief.stories)
  );
}

export function parseFloorCache(raw: string | null): FloorCacheSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const articles = Array.isArray(parsed.articles) ? (parsed.articles as ArticleDTO[]) : [];
    const allArticles = Array.isArray(parsed.allArticles)
      ? (parsed.allArticles as ArticleDTO[])
      : articles;
    return {
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      brief: isBrief(parsed.brief) ? parsed.brief : null,
      articles,
      allArticles,
      tagCounts: isRecord(parsed.tagCounts) ? parsed.tagCounts : {},
      precedenceCounts: isRecord(parsed.precedenceCounts) ? parsed.precedenceCounts : {},
      total: typeof parsed.total === "number" ? parsed.total : 0,
      matched: typeof parsed.matched === "number" ? parsed.matched : 0,
      lastIngestAt: typeof parsed.lastIngestAt === "string" ? parsed.lastIngestAt : null,
    };
  } catch {
    return null;
  }
}

export function mergeFloorCache(
  prev: FloorCacheSnapshot | null,
  patch: Partial<Omit<FloorCacheSnapshot, "savedAt">>,
): Omit<FloorCacheSnapshot, "savedAt"> {
  const base = prev ?? { ...EMPTY, savedAt: "" };
  return {
    brief: patch.brief !== undefined ? patch.brief : base.brief,
    articles: patch.articles ?? base.articles,
    allArticles: patch.allArticles ?? base.allArticles,
    tagCounts: patch.tagCounts ?? base.tagCounts,
    precedenceCounts: patch.precedenceCounts ?? base.precedenceCounts,
    total: patch.total ?? base.total,
    matched: patch.matched ?? base.matched,
    lastIngestAt: patch.lastIngestAt !== undefined ? patch.lastIngestAt : base.lastIngestAt,
  };
}

export function serializeFloorCache(
  snapshot: Omit<FloorCacheSnapshot, "savedAt">,
  savedAt = new Date().toISOString(),
): string {
  const payload: FloorCacheSnapshot = {
    ...snapshot,
    articles: snapshot.articles.slice(0, MAX_CACHED_ARTICLES),
    allArticles: snapshot.allArticles.slice(0, MAX_CACHED_ARTICLES),
    savedAt,
  };
  return JSON.stringify(payload);
}

export function readFloorCache(): FloorCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    return parseFloorCache(window.localStorage.getItem(FLOOR_CACHE_KEY));
  } catch {
    return null;
  }
}

export function patchFloorCache(patch: Partial<Omit<FloorCacheSnapshot, "savedAt">>): void {
  if (typeof window === "undefined") return;
  try {
    const merged = mergeFloorCache(readFloorCache(), patch);
    window.localStorage.setItem(FLOOR_CACHE_KEY, serializeFloorCache(merged));
  } catch {
    // Quota or private browsing: the live fetch still updates the session.
  }
}
