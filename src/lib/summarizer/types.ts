export type SummarizerArticle = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  sourceName: string;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
};

export type SummarizerStoryDraft = {
  headline: string;
  body: string;
  placeLabel?: string | null;
  lat?: number | null;
  lng?: number | null;
  relatedArticleIds?: string[];
  imageUrl?: string | null;
  sortOrder?: number;
};

export type Summarizer = {
  name: string;
  summarizeArticles: (articles: SummarizerArticle[]) => Promise<SummarizerStoryDraft[]>;
};
