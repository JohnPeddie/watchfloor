import type { Summarizer, SummarizerArticle, SummarizerStoryDraft } from "./types";

/**
 * Future local LLM summarizer. Wire OLLAMA_BASE_URL + OLLAMA_MODEL when ready.
 * Not used in v1 — swap getSummarizer() to return this when you want automated briefs.
 */
export const ollamaSummarizer: Summarizer = {
  name: "ollama",
  async summarizeArticles(articles: SummarizerArticle[]): Promise<SummarizerStoryDraft[]> {
    const base = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
    const model = process.env.OLLAMA_MODEL ?? "llama3.2";

    const prompt = `You are an intelligence briefer. Produce 4-6 Global Radar style stories from these OSINT items.
Each story needs a strong headline and 3-4 short factual paragraphs.
Return ONLY valid JSON array of objects: { "headline": string, "body": string, "placeLabel": string }.

Articles:
${articles
  .slice(0, 40)
  .map((a, i) => `${i + 1}. [${a.sourceName}] ${a.title}\n${a.summary ?? ""}\n${a.url}`)
  .join("\n\n")}`;

    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, format: "json" }),
    });

    if (!res.ok) {
      throw new Error(`Ollama error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { response?: string };
    const raw = data.response ?? "[]";
    const parsed = JSON.parse(raw) as SummarizerStoryDraft[] | { stories: SummarizerStoryDraft[] };
    const stories = Array.isArray(parsed) ? parsed : parsed.stories;
    return stories.map((s, i) => ({
      headline: s.headline,
      body: s.body,
      placeLabel: s.placeLabel ?? null,
      sortOrder: i,
    }));
  },
};
