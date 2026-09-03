import { deriveImplication, summariseExtractive } from "../analysis";
import type {
  ArticleInput,
  ArticleSummary,
  ProviderHealth,
  StoryCluster,
  SummaryProvider,
} from "./types";

/**
 * Offline summariser. Frequency-scored sentence extraction for the read, and
 * tag-driven templates for the implication. No model, no network, so it always
 * works — it is the fallback whenever the LLM host is unreachable.
 */
export const rulesProvider: SummaryProvider = {
  id: "rules",
  label: "Rules engine (extractive)",
  model: null,

  async health(): Promise<ProviderHealth> {
    return {
      id: "rules",
      label: "Rules engine (extractive)",
      model: null,
      reachable: true,
      detail: null,
      latencyMs: 0,
    };
  },

  async summariseArticle(input: ArticleInput): Promise<ArticleSummary> {
    return {
      analysis: summariseExtractive(input.bodyText, input.summary),
      implication: deriveImplication(input.tags, input.placeLabel),
    };
  },

  async composeStory(cluster: StoryCluster) {
    return {
      headline: pickHeadline(cluster),
      body: mergeSources(cluster),
    };
  },
};

/**
 * Prefers the longest headline from the most-cited source, which in practice
 * picks the most descriptive wording rather than a truncated wire title.
 */
function pickHeadline(cluster: StoryCluster): string {
  const ranked = [...cluster.articles].sort(
    (a, b) => scoreHeadline(b.title) - scoreHeadline(a.title),
  );
  return (ranked[0]?.title ?? "Untitled report").replace(/\s+/g, " ").trim();
}

function scoreHeadline(title: string): number {
  const words = title.trim().split(/\s+/).length;
  // Eight to sixteen words reads as a headline; outside that, penalise.
  const shape = words >= 8 && words <= 16 ? 1.4 : words >= 5 ? 1 : 0.5;
  const clickbait = /\?$|^(why|how|what|will)\b/i.test(title) ? 0.7 : 1;
  return title.length * shape * clickbait;
}

/**
 * Multi-source merge: takes the strongest couple of sentences from each article
 * in the cluster, drops near-duplicates, and attributes the sources at the end
 * so the reader can see the story is corroborated.
 */
function mergeSources(cluster: StoryCluster): string {
  const paragraphs: string[] = [];
  const seen: string[] = [];

  for (const article of cluster.articles.slice(0, 4)) {
    const extract = summariseExtractive(article.bodyText, article.summary, 2);
    if (!extract) continue;
    const text = extract.replace(/\s+/g, " ").trim();
    if (text.length < 60) continue;
    if (seen.some((prior) => similarity(prior, text) > 0.6)) continue;
    seen.push(text);
    paragraphs.push(text);
  }

  if (paragraphs.length === 0) {
    const first = cluster.articles[0];
    paragraphs.push(first?.summary?.trim() || first?.title || "No detail extracted.");
  }

  const sources = [...new Set(cluster.articles.map((a) => a.sourceName))];
  if (sources.length > 1) {
    paragraphs.push(`Corroboration: ${sources.join(", ")}.`);
  }

  return paragraphs.join("\n\n");
}

/** Jaccard overlap on word sets — enough to spot two wires of the same copy. */
function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const setB = new Set(b.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared++;
  return shared / Math.min(setA.size, setB.size);
}
