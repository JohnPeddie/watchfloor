import { prisma } from "../src/lib/db";
import { classify } from "../src/lib/classify";
import { parseJsonArray } from "../src/lib/serializers";
import { serialRef } from "../src/lib/dtg";
import { feedByName } from "../config/feeds";

/** Re-applies classification rules to stored articles without re-fetching feeds. */
async function main() {
  const articles = await prisma.article.findMany();
  let updated = 0;

  for (const article of articles) {
    const feed = feedByName(article.sourceName);
    const classification = classify({
      title: article.title,
      summary: article.rawExcerpt ?? article.summary,
      feedLanes: parseJsonArray(article.lanes),
      publishedAt: article.publishedAt,
    });

    await prisma.article.update({
      where: { id: article.id },
      data: {
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
  }

  console.log(`Reclassified ${updated} articles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
