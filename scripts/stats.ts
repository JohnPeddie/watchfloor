import { prisma } from "../src/lib/db";
import { parseJsonArray } from "../src/lib/serializers";

async function main() {
  const articles = await prisma.article.findMany({ take: 500 });
  const withBody = articles.filter((a) => (a.bodyText?.length ?? 0) > 300).length;
  const withAnalysis = articles.filter((a) => (a.analysis?.length ?? 0) > 200).length;
  const imageCounts = articles.map((a) => parseJsonArray(a.images).length);
  const multiImage = imageCounts.filter((n) => n > 1).length;
  const avg = imageCounts.reduce((s, n) => s + n, 0) / (articles.length || 1);

  console.log({
    total: articles.length,
    withBodyText: withBody,
    withAnalysis: withAnalysis,
    multiImage,
    avgImages: Number(avg.toFixed(2)),
    geolocated: articles.filter((a) => a.lat != null).length,
  });

  const sample = articles.find((a) => (a.analysis?.length ?? 0) > 350);
  if (sample) {
    console.log("\n--- SAMPLE ---");
    console.log("TITLE:", sample.title);
    console.log("IMAGES:", parseJsonArray(sample.images).length);
    console.log("ANALYSIS:", sample.analysis?.slice(0, 700));
    console.log("IMPLICATION:", sample.implication);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
