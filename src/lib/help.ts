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
      "Every article currently held — at most 300, with the oldest dropped first — narrowed by the lane and search box. Sort by Recent (newest first), Urgency (FLASH down to ROUTINE), or Tags (defence, UK, conflict, and the rest of the lane order). Urgency and Tags grouping keeps recency as the tie-break. Each row shows its urgency, source, Admiralty grade and time of publication. Select one to read the summary and open the original.",
  },
  globe: {
    title: "Geospatial plot",
    body:
      "Where the reporting is happening. Day and night track real time. Red discs are active warzones (major ongoing armed conflicts). Amber discs are high-severity tropical cyclones — hurricanes and major storms — with violet for a major hurricane. Selecting a brief item or article plants a marker at the subject and, for brief items, draws a spoke from every source toward it. On a PC the plot sits above the stream. On the Fold inner screen it sits beside the list; on the cover, use the Globe tab.",
  },
  energy: {
    title: "Energy",
    body:
      "Front-month crude benchmarks in US dollars per barrel, with the recent trend and the change since the previous close. Crude is tracked separately from the other markets because so much of the reporting here turns on it. Oil and gas equities sit under Sectors.",
  },
  markets: {
    title: "Markets",
    body:
      "The FTSE 100 and sterling against the dollar, each with its recent trend and daily change. Sector baskets — tech, defence, oil and gas, AI and cyber — sit underneath as corroboration: a move there often confirms that a story is being taken seriously.",
  },
  sectors: {
    title: "Sectors",
    body:
      "Liquid ETF baskets used as proxies for the industries that turn up in the reporting: tech, defence, oil and gas, AI and cyber. Each row is the recent trend and the change since the previous close, not a single company. Crude prices stay in Energy.",
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
      "Which engine wrote the daily brief. Rules is offline sentence extraction. LLM uses a local model (LM Studio or Ollama) only to write brief items from clustered reports — not to summarise every article. If the model host is down, the brief falls back to rules, the dashboard keeps working, and the app bar shows that local LLM summaries are offline.",
  },
  settings: {
    title: "Settings",
    body:
      "Periodic news refresh pulls the RSS feeds on the interval you set. The daily briefing runs once after the chosen morning time — 06:00 by default — and catches up if the server was off at that hour. Both only run while Watchfloor itself is running. The stats are today's figures for this machine: articles collected, LLM tokens, and how long the local model took. On a phone, tap the fullscreen control in the top bar to hide the address bar. Chrome only drops the bar permanently (Install app) when the page is opened over HTTPS, such as a Tailscale link — Add to Home screen on plain HTTP is just a bookmark.",
  },
};
