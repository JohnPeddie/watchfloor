import type { Precedence, Tag } from "./classify";

export type ArticleDTO = {
  id: string;
  title: string;
  summary: string | null;
  analysis: string | null;
  implication: string | null;
  url: string;
  sourceName: string;
  sourceCode: string;
  sourceGrade: string;
  publishedAt: string | null;
  imageUrl: string | null;
  images: string[];
  lanes: string[];
  tags: Tag[];
  precedence: Precedence;
  confidence: number;
  ref: string | null;
  lat: number | null;
  lng: number | null;
  placeLabel: string | null;
};

/**
 * A report a brief item was built from, resolved server-side.
 *
 * Sent with the brief rather than looked up client-side, because the client
 * only holds a page of articles and a story's sources are often older than
 * that page reaches.
 */
export type BriefSourceDTO = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceCode: string;
  sourceGrade: string;
  publishedAt: string | null;
  imageUrl: string | null;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  precedence: Precedence;
};

export type BriefStoryDTO = {
  id: string;
  headline: string;
  body: string;
  paragraphs: string[];
  tags: Tag[];
  precedence: Precedence;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  relatedArticleIds: string[];
  sources: BriefSourceDTO[];
  imageUrl: string | null;
  sortOrder: number;
};

export type BriefDTO = {
  id: string;
  date: string;
  title: string;
  bluf: string | null;
  /** "authored" for hand-written briefs, otherwise the summariser id. */
  source: string;
  stories: BriefStoryDTO[];
};

/** Mirrors ProviderHealth from lib/summarize, as returned by /api/summarizer. */
export type ProviderHealthDTO = {
  id: string;
  label: string;
  model: string | null;
  reachable: boolean;
  detail: string | null;
  latencyMs: number | null;
};

export type SummarizerStatus = {
  configured: string;
  degraded: boolean;
  providers: ProviderHealthDTO[];
};

export type GlobePin = {
  id: string;
  kind: "story" | "article" | "source";
  label: string;
  lat: number;
  lng: number;
  placeLabel: string | null;
  precedence: Precedence;
  imageUrl: string | null;
  /** The article to open when the pin is clicked, for source pins. */
  articleId?: string;
  /** Marks the subject location of the selected story. */
  focus?: boolean;
};

/**
 * One strand of the source web: a report's origin in toward the subject of
 * the selected brief item.
 */
export type GlobeLink = {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  label: string;
};

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function toArticleDTO(article: {
  id: string;
  title: string;
  summary: string | null;
  analysis: string | null;
  implication: string | null;
  url: string;
  sourceName: string;
  sourceCode: string;
  sourceGrade: string;
  publishedAt: Date | null;
  imageUrl: string | null;
  images: string;
  lanes: string;
  tags: string;
  precedence: string;
  confidence: number;
  ref: string | null;
  lat: number | null;
  lng: number | null;
  placeLabel: string | null;
}): ArticleDTO {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    analysis: article.analysis,
    implication: article.implication,
    url: article.url,
    sourceName: article.sourceName,
    sourceCode: article.sourceCode,
    sourceGrade: article.sourceGrade,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    imageUrl: article.imageUrl,
    images: parseJsonArray(article.images),
    lanes: parseJsonArray(article.lanes),
    tags: parseJsonArray(article.tags) as Tag[],
    precedence: article.precedence as Precedence,
    confidence: article.confidence,
    ref: article.ref,
    lat: article.lat,
    lng: article.lng,
    placeLabel: article.placeLabel,
  };
}

export function toBriefStoryDTO(
  story: {
    id: string;
    headline: string;
    body: string;
    tags: string;
    precedence: string;
    placeLabel: string | null;
    lat: number | null;
    lng: number | null;
    relatedArticleIds: string;
    imageUrl: string | null;
    sortOrder: number;
  },
  sources: BriefSourceDTO[] = [],
): BriefStoryDTO {
  return {
    id: story.id,
    headline: story.headline,
    body: story.body,
    paragraphs: splitParagraphs(story.body),
    tags: parseJsonArray(story.tags) as Tag[],
    precedence: story.precedence as Precedence,
    placeLabel: story.placeLabel,
    lat: story.lat,
    lng: story.lng,
    relatedArticleIds: parseJsonArray(story.relatedArticleIds),
    sources,
    imageUrl: story.imageUrl,
    sortOrder: story.sortOrder,
  };
}

export function toBriefSourceDTO(article: {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceCode: string;
  sourceGrade: string;
  publishedAt: Date | null;
  imageUrl: string | null;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  precedence: string;
}): BriefSourceDTO {
  return {
    id: article.id,
    title: article.title,
    url: article.url,
    sourceName: article.sourceName,
    sourceCode: article.sourceCode,
    sourceGrade: article.sourceGrade,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    imageUrl: article.imageUrl,
    placeLabel: article.placeLabel,
    lat: article.lat,
    lng: article.lng,
    precedence: article.precedence as Precedence,
  };
}
