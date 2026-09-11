import assert from "node:assert/strict";
import test from "node:test";
import { nextBriefAt } from "../src/lib/brief-schedule";
import { DEFAULT_SETTINGS, parseBriefTimes } from "../src/lib/settings-types";

test("parseBriefTimes keeps explicit clock times and drops duplicates", () => {
  assert.deepEqual(
    parseBriefTimes({
      briefTimes: [
        { hour: 18, minute: 0 },
        { hour: 6, minute: 0 },
        { hour: 18, minute: 0 },
        { hour: 12, minute: 0 },
      ],
    }),
    [
      { hour: 6, minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 18, minute: 0 },
    ],
  );
});

test("parseBriefTimes expands the old start-time plus times-per-day fields", () => {
  assert.deepEqual(parseBriefTimes({ briefHour: 6, briefMinute: 0, briefTimesPerDay: 1 }), [
    { hour: 6, minute: 0 },
  ]);
  assert.deepEqual(parseBriefTimes({ briefHour: 6, briefMinute: 0, briefTimesPerDay: 4 }), [
    { hour: 6, minute: 0 },
    { hour: 12, minute: 0 },
    { hour: 18, minute: 0 },
  ]);
});

test("parseBriefTimes prefers briefTimes over the old even-spacing fields", () => {
  assert.deepEqual(
    parseBriefTimes({
      briefHour: 6,
      briefMinute: 0,
      briefTimesPerDay: 4,
      briefTimes: [
        { hour: 6, minute: 0 },
        { hour: 12, minute: 0 },
        { hour: 18, minute: 0 },
      ],
    }),
    [
      { hour: 6, minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 18, minute: 0 },
    ],
  );
});

test("nextBriefAt with 06:00 12:00 18:00 does not schedule midnight", () => {
  const previous = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    const settings = {
      ...DEFAULT_SETTINGS,
      briefTimes: [
        { hour: 6, minute: 0 },
        { hour: 12, minute: 0 },
        { hour: 18, minute: 0 },
      ],
    };
    const last = new Date("2026-09-11T18:01:00.000Z");
    const now = new Date("2026-09-11T23:00:00.000Z");
    const next = nextBriefAt(settings, last, now);
    assert.ok(next);
    assert.equal(next!.toISOString(), "2026-09-12T06:00:00.000Z");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
