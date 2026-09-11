import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CACHED_ARTICLES,
  mergeFloorCache,
  parseFloorCache,
  serializeFloorCache,
} from "../src/lib/floor-cache";
import type { BriefDTO } from "../src/lib/serializers";

const brief: BriefDTO = {
  id: "brief-1",
  date: "2026-09-11",
  title: "Global Radar Report",
  bluf: "Bottom line",
  source: "rules",
  stories: [],
};

test("parseFloorCache restores a valid brief snapshot", () => {
  const raw = serializeFloorCache(
    {
      brief,
      articles: [{ id: "a1" } as never],
      allArticles: [{ id: "a1" } as never],
      tagCounts: { UK: 2 },
      precedenceCounts: { FLASH: 1 },
      total: 4,
      matched: 4,
      lastIngestAt: "2026-09-11T08:00:00.000Z",
    },
    "2026-09-11T08:01:00.000Z",
  );
  const parsed = parseFloorCache(raw);
  assert.equal(parsed?.brief?.id, "brief-1");
  assert.equal(parsed?.brief?.title, "Global Radar Report");
  assert.equal(parsed?.tagCounts.UK, 2);
  assert.equal(parsed?.total, 4);
  assert.equal(parsed?.savedAt, "2026-09-11T08:01:00.000Z");
});

test("parseFloorCache rejects junk and a brief without stories", () => {
  assert.equal(parseFloorCache(null), null);
  assert.equal(parseFloorCache("{"), null);
  const parsed = parseFloorCache(
    JSON.stringify({ brief: { id: "x", title: "Nope" }, articles: "nope" }),
  );
  assert.equal(parsed?.brief, null);
  assert.deepEqual(parsed?.articles, []);
});

test("mergeFloorCache keeps the previous brief when only articles patch", () => {
  const merged = mergeFloorCache(
    {
      savedAt: "t0",
      brief,
      articles: [],
      allArticles: [],
      tagCounts: {},
      precedenceCounts: {},
      total: 0,
      matched: 0,
      lastIngestAt: null,
    },
    { total: 12, articles: [{ id: "a2" } as never] },
  );
  assert.equal(merged.brief?.id, "brief-1");
  assert.equal(merged.total, 12);
  assert.equal(merged.articles[0]?.id, "a2");
});

test("serializeFloorCache caps stored articles", () => {
  const articles = Array.from({ length: MAX_CACHED_ARTICLES + 20 }, (_, i) => ({
    id: `a${i}`,
  }));
  const parsed = parseFloorCache(
    serializeFloorCache({
      brief,
      articles: articles as never,
      allArticles: articles as never,
      tagCounts: {},
      precedenceCounts: {},
      total: articles.length,
      matched: articles.length,
      lastIngestAt: null,
    }),
  );
  assert.equal(parsed?.articles.length, MAX_CACHED_ARTICLES);
  assert.equal(parsed?.allArticles.length, MAX_CACHED_ARTICLES);
});
