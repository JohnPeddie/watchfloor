import { manualSummarizer } from "./manual";
import { ollamaSummarizer } from "./ollama";
import type { Summarizer } from "./types";

/** v1 uses manual briefs. Set SUMMARIZER=ollama to use local LLM later. */
export function getSummarizer(): Summarizer {
  if (process.env.SUMMARIZER === "ollama") {
    return ollamaSummarizer;
  }
  return manualSummarizer;
}
