import { runIngest } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";

async function main() {
  console.log("Starting WATCHFLOOR ingest...");
  const result = await runIngest({ fetchImages: true, maxPerFeed: 10 });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
