import type { Summarizer, SummarizerStoryDraft } from "./types";

/**
 * v1: returns empty — daily briefs are authored manually / via seed.
 * Kept so the UI and API can call a stable Summarizer interface.
 */
export const manualSummarizer: Summarizer = {
  name: "manual",
  async summarizeArticles(): Promise<SummarizerStoryDraft[]> {
    return [];
  },
};
