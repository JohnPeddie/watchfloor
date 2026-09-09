import type { Precedence, Tag } from "../classify";

/** A single ingested item handed to a summariser. */
export type ArticleInput = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  /** RSS excerpt — the fallback when full-page extraction failed. */
  summary: string | null;
  /** Extracted article body, when available. */
  bodyText: string | null;
  tags: Tag[];
  placeLabel: string | null;
};

/** Per-article product: the read, plus the "so what". */
export type ArticleSummary = {
  analysis: string | null;
  implication: string | null;
};

/**
 * A group of articles covering the same real-world event, assembled before
 * summarising so a story can be written from several sources at once.
 */
export type StoryCluster = {
  key: string;
  tags: Tag[];
  precedence: Precedence;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  articles: ArticleInput[];
};

/** Story as written for the daily brief. */
export type StoryDraft = {
  headline: string;
  body: string;
  tags: Tag[];
  precedence: Precedence;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  relatedArticleIds: string[];
  sortOrder: number;
};

export type ProviderHealth = {
  id: string;
  label: string;
  model: string | null;
  reachable: boolean;
  /** Populated when `reachable` is false. */
  detail: string | null;
  /** Round-trip time of the health probe, in milliseconds. */
  latencyMs: number | null;
};

/**
 * Contract every summariser satisfies. The rules provider runs offline;
 * Ollama and OpenAI-compatible hosts (LM Studio) call a model over the
 * network. Anything added later only has to implement this.
 */
export type SummaryProvider = {
  id: string;
  label: string;
  model: string | null;
  /** Cheap probe used for status display and for fallback decisions. */
  health: () => Promise<ProviderHealth>;
  summariseArticle: (input: ArticleInput) => Promise<ArticleSummary>;
  composeStory: (cluster: StoryCluster) => Promise<{ headline: string; body: string }>;
  /** Optional day-level read across the finished stories. */
  writeBluf?: (stories: { headline: string; body: string }[]) => Promise<string | null>;
  /**
   * Drop host-side resources after a brief run. Ollama uses this to unload
   * the model from VRAM so the host is not sitting on a loaded model all day.
   */
  release?: () => Promise<void>;
};
