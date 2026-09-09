import assert from "node:assert/strict";
import test from "node:test";
import type { BriefStoryDTO } from "../src/lib/serializers";
import { parseInsightOrder } from "../src/lib/settings-types";
import { buildSourceWeb } from "../src/lib/source-web";

function story(overrides: Partial<BriefStoryDTO> = {}): BriefStoryDTO {
  return {
    id: "story-1",
    headline: "Test story",
    body: "Body",
    paragraphs: ["Body"],
    tags: ["UK"],
    precedence: "PRIORITY",
    placeLabel: "London",
    lat: 51.5,
    lng: -0.12,
    relatedArticleIds: [],
    sources: [
      {
        id: "src-1",
        title: "Desk copy",
        url: "https://example.test/a",
        sourceName: "BBC News UK",
        sourceCode: "BBC-UK",
        sourceGrade: "A1",
        publishedAt: null,
        imageUrl: null,
        placeLabel: "London",
        lat: 51.5,
        lng: -0.12,
        precedence: "PRIORITY",
      },
    ],
    imageUrl: null,
    sortOrder: 0,
    ...overrides,
  };
}

test("buildSourceWeb returns a hub, source pin, and spoke when the story is located", () => {
  const web = buildSourceWeb(story());
  assert.ok(web.hub);
  assert.equal(web.pins.length, 2);
  assert.equal(web.links.length, 1);
  assert.equal(web.pins[0]?.kind, "story");
  assert.equal(web.pins[1]?.kind, "source");
});

test("buildSourceWeb is empty when nothing can be placed", () => {
  const web = buildSourceWeb(
    story({
      lat: null,
      lng: null,
      placeLabel: null,
      sources: [],
    }),
  );
  assert.equal(web.hub, null);
  assert.deepEqual(web.pins, []);
  assert.deepEqual(web.links, []);
});

test("parseInsightOrder keeps known cards and appends anything missing", () => {
  assert.deepEqual(parseInsightOrder(["markets", "weather", "markets", "nope"]), [
    "markets",
    "weather",
    "energy",
    "sectors",
    "precedence",
    "classification",
    "collection",
    "summarisation",
  ]);
});
