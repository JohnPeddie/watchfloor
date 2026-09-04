export type Lane =
  | "uk"
  | "uk-defence"
  | "war"
  | "oil-gas"
  | "markets"
  | "cyber"
  | "intel";

/**
 * Admiralty-style source grading.
 * Letter = source reliability (A completely reliable → F cannot be judged).
 * Digit = information credibility (1 confirmed → 6 cannot be judged).
 */
export type SourceGrade =
  | "A1" | "A2" | "B1" | "B2" | "B3" | "C2" | "C3" | "D3" | "F6";

/** Where an outlet files from, used to plot the spread of coverage. */
export type Bureau = {
  label: string;
  lat: number;
  lng: number;
};

export type FeedConfig = {
  id: string;
  name: string;
  /** Short designator shown in dense tables, e.g. BBC-UK */
  code: string;
  url: string;
  lanes: Lane[];
  grade: SourceGrade;
  bureau: Bureau;
};

const LONDON: Bureau = { label: "London", lat: 51.5074, lng: -0.1278 };
const WASHINGTON: Bureau = { label: "Washington D.C.", lat: 38.9072, lng: -77.0369 };

export const FEEDS: FeedConfig[] = [
  {
    id: "bbc-uk",
    name: "BBC News UK",
    code: "BBC-UK",
    url: "https://feeds.bbci.co.uk/news/uk/rss.xml",
    lanes: ["uk"],
    grade: "B2",
    bureau: LONDON,
  },
  {
    id: "bbc-world",
    name: "BBC News World",
    code: "BBC-WLD",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    lanes: ["war", "intel"],
    grade: "B2",
    bureau: LONDON,
  },
  {
    id: "bbc-business",
    name: "BBC Business",
    code: "BBC-BIZ",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    lanes: ["markets", "oil-gas"],
    grade: "B2",
    bureau: LONDON,
  },
  {
    id: "bbc-tech",
    name: "BBC Technology",
    code: "BBC-TEC",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    lanes: ["cyber"],
    grade: "B2",
    bureau: LONDON,
  },
  {
    id: "guardian-uk",
    name: "The Guardian UK",
    code: "GRD-UK",
    url: "https://www.theguardian.com/uk-news/rss",
    lanes: ["uk"],
    grade: "B3",
    bureau: LONDON,
  },
  {
    id: "guardian-world",
    name: "The Guardian World",
    code: "GRD-WLD",
    url: "https://www.theguardian.com/world/rss",
    lanes: ["war", "intel"],
    grade: "B3",
    bureau: LONDON,
  },
  {
    id: "mod-news",
    name: "UK Ministry of Defence",
    code: "UK-MOD",
    url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=ministry-of-defence",
    lanes: ["uk-defence", "uk"],
    grade: "A1",
    bureau: { label: "Whitehall", lat: 51.5045, lng: -0.1280 },
  },
  {
    id: "defence-news",
    name: "Defense News",
    code: "DEF-NWS",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
    lanes: ["uk-defence", "war"],
    grade: "B2",
    bureau: { label: "Vienna, VA", lat: 38.9012, lng: -77.2653 },
  },
  {
    id: "npr-world",
    name: "NPR World",
    code: "NPR-WLD",
    url: "https://feeds.npr.org/1004/rss.xml",
    lanes: ["war", "intel"],
    grade: "B2",
    bureau: WASHINGTON,
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    code: "AJZ",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    lanes: ["war", "intel"],
    grade: "C3",
    bureau: { label: "Doha", lat: 25.2854, lng: 51.531 },
  },
  {
    id: "oilprice",
    name: "OilPrice.com",
    code: "OILP",
    url: "https://oilprice.com/rss/main",
    lanes: ["oil-gas", "markets"],
    grade: "C3",
    bureau: { label: "Limassol", lat: 34.7071, lng: 33.0226 },
  },
  {
    id: "eia",
    name: "U.S. EIA",
    code: "US-EIA",
    url: "https://www.eia.gov/rss/todayinenergy.xml",
    lanes: ["oil-gas"],
    grade: "A2",
    bureau: WASHINGTON,
  },
  {
    id: "krebs",
    name: "Krebs on Security",
    code: "KREBS",
    url: "https://krebsonsecurity.com/feed/",
    lanes: ["cyber"],
    grade: "B1",
    bureau: { label: "Northern Virginia", lat: 38.8462, lng: -77.3064 },
  },
  {
    id: "bleeping",
    name: "BleepingComputer",
    code: "BLEEP",
    url: "https://www.bleepingcomputer.com/feed/",
    lanes: ["cyber"],
    grade: "B2",
    bureau: { label: "New York", lat: 40.7128, lng: -74.006 },
  },
  {
    id: "the-record",
    name: "The Record",
    code: "RECORD",
    url: "https://therecord.media/feed",
    lanes: ["cyber"],
    grade: "B2",
    bureau: { label: "Boston", lat: 42.3601, lng: -71.0589 },
  },
  {
    id: "cisa",
    name: "CISA Advisories",
    code: "US-CISA",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    lanes: ["cyber"],
    grade: "A1",
    bureau: { label: "Arlington, VA", lat: 38.8816, lng: -77.091 },
  },
];

export const LANE_LABELS: Record<Lane, string> = {
  uk: "UK",
  "uk-defence": "UK Defence",
  war: "Conflict",
  "oil-gas": "Oil & Gas",
  markets: "Markets",
  cyber: "Cyber",
  intel: "Intel",
};

export function feedByName(name: string): FeedConfig | undefined {
  return FEEDS.find((f) => f.name === name);
}

export function feedByCode(code: string): FeedConfig | undefined {
  return FEEDS.find((f) => f.code === code);
}
