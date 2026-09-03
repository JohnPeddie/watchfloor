import { prisma } from "../src/lib/db";
import { classify } from "../src/lib/classify";
import { parseJsonArray } from "../src/lib/serializers";
import { serialRef } from "../src/lib/dtg";
import { feedByName } from "../config/feeds";
import { extractPage, mapLimit } from "../src/lib/extract";
import { deriveImplication, summariseExtractive } from "../src/lib/analysis";
import { geocodeText } from "../src/lib/geocode";

/**
 * Backfills full text, imagery and derived assessments for stored articles.
 * Pass --force to re-fetch pages that already have body text.
 */
async function main() {
  const force = process.argv.includes("--force");
  const articles = await prisma.article.findMany({
    orderBy: [{ publishedAt: "desc" }],
  });

  let fetched = 0;
  let updated = 0;

  await mapLimit(articles, 6, async (article) => {
    const feed = feedByName(article.sourceName);
    const lanes = parseJsonArray(article.lanes);
    const classification = classify({
      title: article.title,
      summary: article.rawExcerpt ?? article.summary,
      feedLanes: lanes,
      publishedAt: article.publishedAt,
    });

    let images = parseJsonArray(article.images);
    let bodyText = article.bodyText;

    if (force || !bodyText || images.length === 0) {
      const page = await extractPage(article.url);
      if (page.images.length > 0) images = page.images;
      if (page.bodyText) bodyText = page.bodyText;
      fetched += 1;
    }

    const place = geocodeText(article.title, article.rawExcerpt ?? article.summary);

    // Preserve summaries produced by a better provider (e.g. Ollama).
    const hasBetterAnalysis =
      Boolean(article.analysis) &&
      Boolean(article.analysisSource) &&
      article.analysisSource !== "rules";

    const analysisFields = hasBetterAnalysis
      ? {}
      : {
          analysis: summariseExtractive(bodyText, article.rawExcerpt ?? article.summary),
          implication: deriveImplication(classification.tags, place?.label ?? null),
          analysisSource: "rules",
          analysedAt: new Date(),
        };

    await prisma.article.update({
      where: { id: article.id },
      data: {
        images: JSON.stringify(images),
        imageUrl: images[0] ?? article.imageUrl,
        bodyText,
        ...analysisFields,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        placeLabel: place?.label ?? null,
        tags: JSON.stringify(classification.tags),
        precedence: classification.precedence,
        confidence: classification.confidence,
        sourceCode: feed?.code ?? article.sourceCode,
        sourceGrade: feed?.grade ?? article.sourceGrade,
        ref:
          article.ref ??
          serialRef(article.url, article.publishedAt ?? article.createdAt, 0),
      },
    });
    updated += 1;
  });

  console.log(
    JSON.stringify({ articles: articles.length, pagesFetched: fetched, updated }, null, 2),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
