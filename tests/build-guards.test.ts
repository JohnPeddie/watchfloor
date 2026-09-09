import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FEEDS } from "../config/feeds";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * These are the classes of error that have already broken `next build` in
 * Docker: missing feed URLs, globe props the library types reject, and
 * identifiers used without an import. Turbopack in `next dev` does not catch
 * them the same way.
 */
test("every RSS feed has a unique id, code, and http(s) url", () => {
  const ids = new Set<string>();
  const codes = new Set<string>();
  assert.ok(FEEDS.length > 0, "feed list is empty");
  for (const feed of FEEDS) {
    assert.ok(feed.id.trim(), `${feed.name} is missing id`);
    assert.ok(feed.code.trim(), `${feed.id} is missing code`);
    assert.match(feed.url, /^https?:\/\//, `${feed.id} is missing a URL`);
    assert.equal(ids.has(feed.id), false, `duplicate feed id ${feed.id}`);
    assert.equal(codes.has(feed.code), false, `duplicate feed code ${feed.code}`);
    ids.add(feed.id);
    codes.add(feed.code);
  }
});

test("WatchfloorDashboard imports every name it calls from source-web", () => {
  const src = readFileSync(join(root, "src/components/WatchfloorDashboard.tsx"), "utf8");
  if (!/\bbuildSourceWeb\s*\(/.test(src)) return;
  assert.match(
    src,
    /import\s*\{[^}]*\bbuildSourceWeb\b[^}]*\}\s*from\s*["']@\/lib\/source-web["']/,
    "buildSourceWeb is called but not imported — that fails next build",
  );
});

test("GlobeView only passes props that react-globe.gl types accept", () => {
  const view = readFileSync(join(root, "src/components/GlobeView.tsx"), "utf8");
  const match = view.match(/<Globe\b[\s\S]*?\/>/);
  assert.ok(match, "Globe JSX is missing");
  const block = match[0];
  const jsxProps = [...block.matchAll(/\s([A-Za-z][A-Za-z0-9]*)=/g)].map((m) => m[1]);
  assert.ok(jsxProps.includes("width"), "did not parse Globe props");

  const dts = readFileSync(join(root, "node_modules/react-globe.gl/dist/react-globe.gl.d.ts"), "utf8");
  const declared = new Set(
    [...dts.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1]),
  );
  // React wrapper extras, not listed on GlobeProps itself.
  declared.add("ref");
  declared.add("animateIn");
  declared.add("rendererConfig");

  const unknown = jsxProps.filter((name) => !declared.has(name));
  assert.deepEqual(unknown, [], `unknown globe props: ${unknown.join(", ")}`);
  assert.equal(
    jsxProps.includes("ringsTransitionDuration"),
    false,
    "ringsTransitionDuration is not a valid react-globe.gl prop",
  );
});
