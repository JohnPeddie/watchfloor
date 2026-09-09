import assert from "node:assert/strict";
import test from "node:test";
import {
  FEEDS,
  INGEST_WEIGHT_FULL,
  INGEST_WEIGHT_SECONDARY,
  INGEST_WEIGHT_SPORT,
  feedByCode,
  ingestCap,
  ingestWeight,
} from "../config/feeds";

function mustFeed(code: string) {
  const feed = feedByCode(code);
  assert.ok(feed, `missing feed ${code}`);
  return feed;
}

test("UK desk and UK defence feeds take a full ingest cap", () => {
  for (const code of ["BBC-UK", "GRD-UK", "SKY-UK", "UK-MOD", "UKDJ", "FT-MKT", "REG"]) {
    assert.equal(ingestWeight(mustFeed(code)), INGEST_WEIGHT_FULL, code);
  }
  assert.equal(ingestCap(mustFeed("BBC-UK"), 12), 12);
});

test("US political, consumer-tech, and US market wires take about a third", () => {
  for (const code of ["HILL", "POLITICO", "NPR-US", "VERGE", "WIRED", "NASDAQ", "MWATCH"]) {
    assert.equal(ingestWeight(mustFeed(code)), INGEST_WEIGHT_SECONDARY, code);
  }
  assert.equal(ingestCap(mustFeed("HILL"), 12), 4);
  assert.equal(ingestCap(mustFeed("VERGE"), 8), 3);
  assert.equal(ingestCap(mustFeed("NASDAQ"), 12), 4);
  assert.ok(ingestCap(mustFeed("HILL"), 12) < ingestCap(mustFeed("BBC-UK"), 12));
});

test("sport stays at a quarter and conflict or cyber is not cut", () => {
  assert.equal(ingestWeight(mustFeed("BBC-F1")), INGEST_WEIGHT_SPORT);
  assert.equal(ingestCap(mustFeed("BBC-F1"), 12), 3);
  assert.equal(ingestWeight(mustFeed("AJZ")), INGEST_WEIGHT_FULL);
  assert.equal(ingestWeight(mustFeed("KREBS")), INGEST_WEIGHT_FULL);
  assert.equal(ingestWeight(mustFeed("US-DOD")), INGEST_WEIGHT_FULL);
});

test("every feed resolves to a cap of at least one item", () => {
  for (const feed of FEEDS) {
    assert.ok(ingestCap(feed, 8) >= 1, feed.id);
  }
});
