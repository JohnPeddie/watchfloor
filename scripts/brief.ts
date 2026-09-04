import { prisma } from "../src/lib/db";
import { importAuthoredBrief, loadAuthoredBrief } from "../src/lib/brief/authored";
import { generateBrief, todayUtc } from "../src/lib/brief/generate";

/**
 * Builds the daily brief.
 *
 * By default an authored brief at content/briefs/<date>.json wins, so a
 * hand-written product is never clobbered by a scheduled run. Pass --auto to
 * force generation from ingested articles using the active summariser.
 */
function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((a) => a.startsWith(prefix));
  if (match) return match.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function main() {
  const date = arg("date") ?? todayUtc();
  const forceAuto = process.argv.includes("--auto");
  const dryRun = process.argv.includes("--dry-run");
  const stories = Number(arg("stories") ?? 7);
  const windowHours = Number(arg("window") ?? 72);
  const minSources = Number(arg("min-sources") ?? 4);

  if (!forceAuto) {
    const authored = await loadAuthoredBrief(date);
    if (authored) {
      if (dryRun) {
        console.log(
          JSON.stringify(
            {
              mode: "authored",
              date,
              dryRun: true,
              storyCount: authored.stories.length,
              headlines: authored.stories.map((s) => s.headline),
            },
            null,
            2,
          ),
        );
        return;
      }
      const result = await importAuthoredBrief(authored);
      console.log(JSON.stringify({ mode: "authored", ...result }, null, 2));
      return;
    }
  }

  const result = await generateBrief({
    date,
    maxStories: Number.isFinite(stories) ? stories : 7,
    windowHours: Number.isFinite(windowHours) ? windowHours : 72,
    minSources: Number.isFinite(minSources) ? minSources : 4,
    providerId: arg("provider"),
    dryRun,
  });

  if (result.fellBack) {
    console.warn(
      `  ! ${result.providerRequested} unavailable (${result.providerDetail ?? "no detail"}) — used ${result.providerUsed}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: "generated",
        date: result.date,
        title: result.title,
        provider: result.source,
        fellBack: result.fellBack,
        candidates: result.candidateCount,
        stories: result.clusterCount,
        written: result.written,
        headlines: result.stories.map((s) => `[${s.precedence}] ${s.headline}`),
      },
      null,
      2,
    ),
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
