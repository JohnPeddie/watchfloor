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
      "The day's reporting, at least five stories and more when the day is busy. Items are chosen for coverage across UK, defence, conflict, energy, cyber and markets. An item normally needs four reports on the same event; if the floor is short or the lanes are thin, the bar steps down rather than shipping an empty or one-topic brief. A local LLM writes those items from the clustered articles when one is reachable; otherwise the rules engine extracts them. Items are ordered by precedence.",
  },
  stream: {
    title: "Reporting stream",
    body:
      "Every article currently held, newest first, narrowed by the lane and search box. Each row shows its urgency, source, Admiralty grade and time of publication. Select one to read the summary and open the original.",
  },
  globe: {
    title: "Geospatial plot",
    body:
      "Where the reporting is happening. Day and night track real time. Selecting a brief item or article plants a marker at the subject and, for brief items, draws a spoke from every source toward it. On a PC the plot sits above the stream. On the Fold inner screen it sits beside the list; on the cover, use the Globe tab.",
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
      "Which engine wrote the daily brief. Rules is offline sentence extraction. LLM uses a local model (LM Studio or Ollama) only to write brief items from clustered reports — not to summarise every article. If the model host is down, the brief falls back to rules and the dashboard keeps working.",
  },
  settings: {
    title: "Settings",
    body:
      "Periodic news refresh pulls the RSS feeds on the interval you set. The daily briefing runs once after the chosen morning time — 06:00 by default — and catches up if the server was off at that hour. Both only run while Watchfloor itself is running. The stats are today's figures for this machine: articles collected, LLM tokens, and how long the local model took.",
  },
};
