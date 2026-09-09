export type Lane =
  | "uk"
  | "uk-defence"
  | "war"
  | "oil-gas"
  | "markets"
  | "cyber"
  | "intel"
  | "tech"
  | "us"
  | "sport";

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
  /**
   * Share of the per-feed ingest cap. General news is 1.
   * Niche verticals (F1, etc.) take a smaller cut so they cannot crowd BBC-scale outlets.
   */
  weight?: number;
};

const LONDON: Bureau = { label: "London", lat: 51.5074, lng: -0.1278 };
const WASHINGTON: Bureau = { label: "Washington D.C.", lat: 38.9072, lng: -77.0369 };
const NEW_YORK: Bureau = { label: "New York", lat: 40.7128, lng: -74.006 };
const PARIS: Bureau = { label: "Paris", lat: 48.8566, lng: 2.3522 };
const SAN_FRANCISCO: Bureau = { label: "San Francisco", lat: 37.7749, lng: -122.4194 };

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
    lanes: ["tech", "cyber"],
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
    lanes: ["uk-defence", "war", "us"],
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

  // UK general
  {
    id: "sky-uk",
    name: "Sky News UK",
    code: "SKY-UK",
    url: "https://feeds.skynews.com/feeds/rss/uk.xml",
    lanes: ["uk"],
    grade: "B2",
    bureau: LONDON,
  },
  {
    id: "independent-uk",
    name: "The Independent UK",
    code: "IND-UK",
    url: "https://www.independent.co.uk/news/uk/rss",
    lanes: ["uk"],
    grade: "B3",
    bureau: LONDON,
  },
  {
    id: "bbc-politics",
    name: "BBC Politics",
    code: "BBC-POL",
    url: "https://feeds.bbci.co.uk/news/politics/rss.xml",
    lanes: ["uk"],
    grade: "B2",
    bureau: LONDON,
  },

  // US
  {
    id: "bbc-us",
    name: "BBC US & Canada",
    code: "BBC-US",
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    lanes: ["us", "intel"],
    grade: "B2",
    bureau: WASHINGTON,
  },
  {
    id: "npr-news",
    name: "NPR News",
    code: "NPR-US",
    url: "https://feeds.npr.org/1001/rss.xml",
    lanes: ["us"],
    grade: "B2",
    bureau: WASHINGTON,
  },
  {
    id: "politico",
    name: "Politico",
    code: "POLITICO",
    url: "https://rss.politico.com/politics-news.xml",
    lanes: ["us"],
    grade: "B2",
    bureau: WASHINGTON,
  },
  {
    id: "the-hill",
    name: "The Hill",
    code: "HILL",
    url: "https://thehill.com/news/feed/",
    lanes: ["us"],
    grade: "B3",
    bureau: WASHINGTON,
  },
  {
    id: "guardian-us",
    name: "The Guardian US",
    code: "GRD-US",
    url: "https://www.theguardian.com/us-news/rss",
    lanes: ["us"],
    grade: "B3",
    bureau: NEW_YORK,
  },

  // Technology
  {
    id: "ars-technica",
    name: "Ars Technica",
    code: "ARS",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    lanes: ["tech"],
    grade: "B1",
    bureau: { label: "Boston", lat: 42.3601, lng: -71.0589 },
  },
  {
    id: "the-register",
    name: "The Register",
    code: "REG",
    url: "https://www.theregister.com/headlines.atom",
    lanes: ["tech", "cyber"],
    grade: "B2",
    bureau: LONDON,
  },
  {
    id: "the-verge",
    name: "The Verge",
    code: "VERGE",
    url: "https://www.theverge.com/rss/index.xml",
    lanes: ["tech"],
    grade: "B3",
    bureau: NEW_YORK,
  },
  {
    id: "wired",
    name: "Wired",
    code: "WIRED",
    url: "https://www.wired.com/feed/rss",
    lanes: ["tech"],
    grade: "B2",
    bureau: SAN_FRANCISCO,
  },

  // Motorsport — kept, but a quarter of the general-news ingest cap.
  {
    id: "bbc-f1",
    name: "BBC Formula 1",
    code: "BBC-F1",
    url: "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
    lanes: ["sport"],
    grade: "B2",
    bureau: LONDON,
    weight: 0.25,
  },
  {
    id: "autosport-f1",
    name: "Autosport F1",
    code: "AUTO-F1",
    url: "https://www.autosport.com/rss/feed/f1",
    lanes: ["sport"],
    grade: "B2",
    bureau: LONDON,
    weight: 0.25,
  },
  {
    id: "motorsport-f1",
    name: "Motorsport.com F1",
    code: "MS-F1",
    url: "https://www.motorsport.com/rss/f1/news/",
    lanes: ["sport"],
    grade: "B2",
    bureau: { label: "Miami", lat: 25.7617, lng: -80.1918 },
    weight: 0.25,
  },
  {
    id: "the-race",
    name: "The Race",
    code: "RACE",
    url: "https://www.the-race.com/feed/",
    lanes: ["sport"],
    grade: "B2",
    bureau: LONDON,
    weight: 0.25,
  },

  // Markets
  {
    id: "ft-markets",
    name: "Financial Times Markets",
    code: "FT-MKT",
    url: "https://www.ft.com/markets?format=rss",
    lanes: ["markets"],
    grade: "A2",
    bureau: LONDON,
  },
  {
    id: "marketwatch",
    name: "MarketWatch",
    code: "MWATCH",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    lanes: ["markets"],
    grade: "B2",
    bureau: NEW_YORK,
  },
  {
    id: "nasdaq-markets",
    name: "Nasdaq Markets",
    code: "NASDAQ",
    url: "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
    lanes: ["markets"],
    grade: "B2",
    bureau: NEW_YORK,
  },

  // Military / defence / war
  {
    id: "pentagon",
    name: "U.S. Department of Defense",
    code: "US-DOD",
    lanes: ["uk-defence", "war", "us"],
    grade: "A1",
    bureau: WASHINGTON,
  },
  {
    id: "breaking-defense",
    name: "Breaking Defense",
    code: "BRKDEF",
    lanes: ["uk-defence", "war", "us"],
    grade: "B1",
    bureau: WASHINGTON,
  },
  {
    id: "war-zone",
    name: "The War Zone",
    code: "TWZ",
    lanes: ["war", "uk-defence", "us"],
    grade: "B2",
    bureau: WASHINGTON,
  },
  {
    id: "ukdj",
    name: "UK Defence Journal",
    code: "UKDJ",
    url: "https://ukdefencejournal.org.uk/feed/",
    lanes: ["uk-defence", "uk"],
    grade: "C2",
    bureau: { label: "Scotland", lat: 55.9533, lng: -3.1883 },
  },
  {
    id: "naval-news",
    name: "Naval News",
    code: "NAVAL",
    url: "https://www.navalnews.com/feed/",
    lanes: ["uk-defence", "war"],
    grade: "B2",
    bureau: PARIS,
  },
  {
    id: "isw",
    name: "Institute for the Study of War",
    code: "ISW",
    url: "https://understandingwar.org/feed/",
    lanes: ["war"],
    grade: "B1",
    bureau: WASHINGTON,
  },
  {
    id: "military-times",
    name: "Military Times",
    code: "MILT",
    lanes: ["war", "uk-defence", "us"],
    grade: "B2",
    bureau: { label: "Springfield, VA", lat: 38.7893, lng: -77.1872 },
  },
  {
    id: "france24",
    name: "France 24",
    code: "F24",
    url: "https://www.france24.com/en/rss",
    lanes: ["war", "intel"],
    grade: "B2",
    bureau: PARIS,
  },
  {
    id: "bbc-middle-east",
    name: "BBC Middle East",
    code: "BBC-ME",
    url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
    lanes: ["war", "intel"],
    grade: "B2",
    bureau: LONDON,
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
  tech: "Tech",
  us: "US",
  sport: "Sport",
};

export function feedByName(name: string): FeedConfig | undefined {
  return FEEDS.find((f) => f.name === name);
}

export function feedByCode(code: string): FeedConfig | undefined {
  return FEEDS.find((f) => f.code === code);
}

/**
 * How much of the ingest cap a feed may take. Sport-only outlets default to a
 * quarter so Autosport cannot match BBC item-for-item.
 */
export function ingestWeight(feed: FeedConfig | undefined): number {
  if (!feed) return 1;
  if (feed.weight != null) {
    return Math.min(1, Math.max(0.1, feed.weight));
  }
  if (feed.lanes.length === 1 && feed.lanes[0] === "sport") return 0.25;
  return 1;
}

export function ingestCap(feed: FeedConfig, maxPerFeed: number): number {
  return Math.max(1, Math.round(maxPerFeed * ingestWeight(feed)));
}
