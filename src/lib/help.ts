/**
 * Explanations for each panel, surfaced by the question-mark buttons.
 *
 * Kept together so the wording stays consistent and describes what the
 * dashboard actually does rather than what a generic OSINT tool might.
 */
export type HelpTopic = {
  title: string;
  body: string;
};

export const HELP: Record<string, HelpTopic> = {
  brief: {
    title: "Daily brief",
    body:
      "The day's reporting reduced to a handful of stories. An item only appears when at least four reports are talking about the same event. Items are ordered by precedence. Selecting one shows the assessment, the reports behind it, and a source web on the globe.",
  },
  stream: {
    title: "Reporting stream",
    body:
      "Every article currently held, newest first, narrowed by the lane and search box. Each row shows its urgency, source, Admiralty grade and time of publication. Select one to read the summary and open the original.",
  },
  globe: {
    title: "Geospatial plot",
    body:
      "Where the reporting is happening. Day and night track real time. Selecting a brief item plants a marker at the story's subject and draws a spoke from every source toward it — the outlet's desk when the article is about the same place, or the article's own location when the chatter is elsewhere. The assessment itself replaces the reporting stream, so the globe stays in view.",
  },
  energy: {
    title: "Energy",
    body:
      "Front-month crude benchmarks in US dollars per barrel, with the recent trend and the change since the previous close. Crude is tracked separately from the other markets because so much of the reporting here turns on it.",
  },
  markets: {
    title: "Markets",
    body:
      "Equity indices and currency pairs followed alongside the reporting, each with its recent trend and daily change. Useful as corroboration: a move here often confirms that a story is being taken seriously.",
  },
  precedence: {
    title: "Precedence",
    body:
      "How urgent an item is, graded automatically from its wording and age. FLASH is reserved for strong signals in the headline within the last twelve hours, IMMEDIATE for the same within a day, PRIORITY for corroborating language or urgent wording in a lane that matters here, and ROUTINE for everything else.",
  },
  classification: {
    title: "Classification",
    body:
      "Topic tags applied by keyword rules — defence, UK, cyber, energy and so on. An article can carry several. Select a tag to filter the stream and the globe down to it, and select it again to clear.",
  },
  collection: {
    title: "Collection",
    body:
      "The RSS feeds being polled and how many articles each has contributed to the current holdings. A feed shows as offline when it has returned nothing, which usually means the source is unreachable rather than quiet.",
  },
  summarisation: {
    title: "Summarisation",
    body:
      "Which engine wrote the summaries. Rules is offline sentence extraction and always available. LLM uses a local Ollama model when one is reachable, and falls back to rules automatically if it is not, so the dashboard keeps working either way.",
  },
};
