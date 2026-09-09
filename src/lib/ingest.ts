import Parser from "rss-parser";
import { FEEDS, ingestCap } from "../../config/feeds";
import { prisma } from "./db";
import { plotLocation } from "./geocode";
import { classify } from "./classify";
import { serialRef } from "./dtg";
import { extractPage, mapLimit } from "./extract";
import { deriveImplication, summariseExtractive } from "./analysis";
import { exclusive } from "./jobs";
import { recordRun } from "./run-log";
import { pruneOldestArticles } from "./retention";
import { loadSettings } from "./settings";
import { isLlmImplicationSource } from "./serializers";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "WATCHFLOOR/1.0 (+local OSINT dashboard)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  pound: "£",
  euro: "€",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function stripHtml(input?: string): string {
  if (!input) return "";
  return decodeEntities(input.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export type IngestResult = {
  feedsProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  enriched: number;
  errors: string[];
};

type StagedItem = {
  url: string;
  title: string;
  rawExcerpt: string;
  categoryText: string;
  publishedAt: Date | null;
  feedIndex: number;
  itemIndex: number;
};

export async function runIngest(options?: {
  fetchImages?: boolean;
  maxPerFeed?: number;
  concurrency?: number;
}): Promise<IngestResult> {
  return exclusive(() => runIngestInner(options));
}

async function runIngestInner(options?: {
  fetchImages?: boolean;
  maxPerFeed?: number;
  concurrency?: number;
}): Promise<IngestResult> {
  const startedAt = new Date();
  const enrich = options?.fetchImages ?? true;
  const maxPerFeed = options?.maxPerFeed ?? 12;
  const concurrency = options?.concurrency ?? 6;
  const result: IngestResult = {
    feedsProcessed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    enriched: 0,
    errors: [],
  };

  const staged: StagedItem[] = [];

  for (let feedIndex = 0; feedIndex < FEEDS.length; feedIndex++) {
    const feed = FEEDS[feedIndex];
    try {
      const parsed = await parser.parseURL(feed.url);
      result.feedsProcessed += 1;
      const items = (parsed.items ?? []).slice(0, ingestCap(feed, maxPerFeed));

      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const item = items[itemIndex];
        const url = item.link?.trim();
        if (!url) {
          result.skipped += 1;
          continue;
        }
        const publishedAt = item.isoDate
          ? new Date(item.isoDate)
          : item.pubDate
            ? new Date(item.pubDate)
            : null;

        staged.push({
          url,
          title: stripHtml(item.title) || "Untitled",
          rawExcerpt: stripHtml(
            item.contentSnippet ||
              (typeof item.content === "string" ? item.content : undefined) ||
              (typeof item.summary === "string" ? item.summary : undefined),
          ),
          categoryText: (item.categories ?? [])
            .map((c) => (typeof c === "string" ? c : String((c as { _?: string })?._ ?? "")))
            .filter(Boolean)
            .join(" "),
          publishedAt:
            publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
          feedIndex,
          itemIndex,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${feed.id}: ${message}`);
    }
  }

  await mapLimit(staged, concurrency, async (staged_item) => {
    const feed = FEEDS[staged_item.feedIndex];
    const { url, title, rawExcerpt, categoryText, publishedAt } = staged_item;

    try {
      const classification = classify({
        title,
        summary: `${rawExcerpt} ${categoryText}`,
        feedLanes: feed.lanes,
        publishedAt,
      });
      const place = plotLocation({
        id: url,
        title,
        extra: [rawExcerpt, categoryText],
        tags: classification.tags,
        lanes: feed.lanes,
      });

      const existing = await prisma.article.findUnique({ where: { url } });
      const needsEnrichment =
        enrich && (!existing?.bodyText || !existing?.analysis || existing.images === "[]");

      let images: string[] = existing ? safeParse(existing.images) : [];
      let bodyText = existing?.bodyText ?? null;

      if (needsEnrichment) {
        const page = await extractPage(url);
        if (page.images.length > 0) images = page.images;
        if (page.bodyText) bodyText = page.bodyText;
        result.enriched += 1;
      }

      // Extractive analysis stays on the rules engine. A hand-asked LLM
      // why-it-matters line is kept across later collects.
      const keepLlmImplication =
        isLlmImplicationSource(existing?.implicationSource) && Boolean(existing?.implication);
      const analysisFields = {
        analysis: summariseExtractive(bodyText, rawExcerpt || null),
        implication:
          keepLlmImplication && existing?.implication
            ? existing.implication
            : deriveImplication(classification.tags, place?.label ?? null),
        implicationSource:
          keepLlmImplication && existing?.implicationSource
            ? existing.implicationSource
            : "rules",
        analysisSource: "rules",
        analysedAt: new Date(),
      };

      const data = {
        title,
        summary: rawExcerpt.slice(0, 800) || null,
        sourceName: feed.name,
        sourceCode: feed.code,
        sourceGrade: feed.grade,
        publishedAt,
        imageUrl: images[0] ?? existing?.imageUrl ?? null,
        images: JSON.stringify(images),
        bodyText,
        ...analysisFields,
        lanes: JSON.stringify(feed.lanes),
        tags: JSON.stringify(classification.tags),
        precedence: classification.precedence,
        confidence: classification.confidence,
        ref: existing?.ref ?? serialRef(url, publishedAt ?? new Date(), staged_item.itemIndex),
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        placeLabel: place?.label ?? null,
        rawExcerpt: rawExcerpt.slice(0, 2000) || null,
      };

      if (existing) {
        await prisma.article.update({ where: { url }, data });
        result.updated += 1;
      } else {
        await prisma.article.create({ data: { url, ...data } });
        result.created += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${feed.id} item: ${message}`);
    }
  });

  const settings = await loadSettings();
  await pruneOldestArticles(settings.holdingsMax);

  await prisma.meta.upsert({
    where: { key: "lastIngestAt" },
    create: { key: "lastIngestAt", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });

  await recordRun({
    kind: "ingest",
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
    ok: result.errors.length === 0,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    detail: result.errors.length > 0 ? result.errors.slice(0, 4).join("; ") : null,
  });

  return result;
}

function safeParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
