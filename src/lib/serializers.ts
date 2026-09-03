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
  kind: "story" | "article";
  label: string;
  lat: number;
  lng: number;
  placeLabel: string | null;
  precedence: Precedence;
  imageUrl: string | null;
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

export function toBriefStoryDTO(story: {
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
}): BriefStoryDTO {
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
    imageUrl: story.imageUrl,
    sortOrder: story.sortOrder,
  };
}
