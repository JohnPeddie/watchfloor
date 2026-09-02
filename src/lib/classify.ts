/**
 * Keyword classifier: assigns intelligence tags and handling precedence to
 * ingested items. Deliberately rules-based so it runs offline with no model.
 */

export type Tag =
  | "DEFENCE"
  | "UK"
  | "ENERGY"
  | "MARKETS"
  | "CYBER"
  | "KINETIC"
  | "MARITIME"
  | "AIR"
  | "NUCLEAR"
  | "TERROR"
  | "ESPIONAGE"
  | "SANCTIONS"
  | "POLITICAL"
  | "SUPPLY"
  | "TECH";

export type Precedence = "FLASH" | "IMMEDIATE" | "PRIORITY" | "ROUTINE";

export const TAG_ORDER: Tag[] = [
  "DEFENCE",
  "UK",
  "KINETIC",
  "CYBER",
  "ENERGY",
  "MARKETS",
  "ESPIONAGE",
  "NUCLEAR",
  "MARITIME",
  "AIR",
  "TERROR",
  "SANCTIONS",
  "SUPPLY",
  "POLITICAL",
  "TECH",
];

const TAG_RULES: Record<Tag, { terms: string[]; weight?: number }> = {
  DEFENCE: {
    terms: [
      "defence", "defense", "military", "army", "navy", "raf", "royal air force",
      "royal navy", "ministry of defence", "nato", "troops", "brigade",
      "regiment", "armed forces", "warship", "frigate", "destroyer", "submarine",
      "aircraft carrier", "typhoon jet", "f-35", "procurement", "rearmament",
      "conscription", "garrison", "barracks", "general staff", "pentagon",
      "trident", "ajax", "challenger 3", "dreadnought",
    ],
    weight: 3,
  },
  UK: {
    terms: [
      "uk", "u.k.", "united kingdom", "britain", "british", "england", "scotland",
      "wales", "northern ireland", "westminster", "whitehall", "downing street",
      "number 10", "hmrc", "nhs", "gchq", "mi5", "mi6",
      "sterling", "bank of england", "ofgem", "north sea", "royal navy",
      "royal air force", "ministry of defence",
    ],
    weight: 3,
  },
  ENERGY: {
    terms: [
      "oil", "crude", "brent", "wti", "opec", "gas", "lng", "pipeline",
      "refinery", "refining", "barrel", "drilling", "rig", "upstream",
      "downstream", "petroleum", "shale", "energy price", "gasoline", "diesel",
      "power grid", "electricity", "nord stream", "gazprom", "aramco",
      "bp", "exxon", "totalenergies", "equinor",
    ],
    weight: 3,
  },
  MARKETS: {
    terms: [
      "market", "markets", "stocks", "shares", "equities", "ftse", "s&p",
      "nasdaq", "dow", "bond", "yields", "inflation", "interest rate", "gdp",
      "recession", "central bank", "federal reserve", "ecb", "investors",
      "earnings", "profit", "revenue", "currency", "dollar", "euro", "trading",
      "commodity", "commodities",
    ],
    weight: 2,
  },
  CYBER: {
    terms: [
      "cyber", "hacker", "hacking", "ransomware", "malware", "phishing",
      "breach", "data leak", "vulnerability", "zero-day", "zero day", "exploit",
      "cve", "ddos", "botnet", "threat actor", "credentials",
      "infostealer", "backdoor", "spyware", "patch", "cisa", "ncsc",
      "cyberattack", "cyber attack", "encryption", "supply chain attack",
    ],
    weight: 3,
  },
  KINETIC: {
    terms: [
      "strike", "strikes", "missile", "missiles", "drone", "drones", "shelling",
      "artillery", "airstrike", "air strike", "offensive", "invasion",
      "killed", "casualties", "wounded", "explosion", "blast", "bombing",
      "gunfire", "firefight", "ceasefire", "front line", "frontline",
      "incursion", "war", "warfare", "combat", "battlefield", "mutiny", "coup",
      "insurgent", "militia", "rebels", "troop losses",
    ],
    weight: 3,
  },
  MARITIME: {
    terms: [
      "maritime", "shipping", "vessel", "tanker", "cargo ship", "strait",
      "hormuz", "red sea", "suez", "bab el-mandeb", "port of", "seabed",
      "undersea cable", "subsea", "naval", "convoy", "chokepoint", "freight rate",
    ],
    weight: 2,
  },
  AIR: {
    terms: [
      "airspace", "aircraft", "fighter jet", "jets", "scrambled", "radar",
      "no-fly", "airbase", "air base", "airport closure", "aviation", "helicopter",
      "unmanned aerial", "uav",
    ],
    weight: 2,
  },
  NUCLEAR: {
    terms: [
      "nuclear", "warhead", "enrichment", "uranium", "plutonium", "iaea",
      "reactor", "atomic", "icbm", "deterrent", "nonproliferation",
      "non-proliferation",
    ],
    weight: 3,
  },
  TERROR: {
    terms: [
      "terror", "terrorist", "terrorism", "jihadist", "islamic state", "isis",
      "al-qaeda", "al qaeda", "boko haram", "al-shabaab", "hamas", "hezbollah",
      "houthi", "extremist", "radicalisation", "radicalization", "proscribed",
    ],
    weight: 3,
  },
  ESPIONAGE: {
    terms: [
      "espionage", "spy", "spying", "spies", "intelligence agency", "covert",
      "sabotage", "hybrid warfare", "disinformation", "influence operation",
      "defector", "wiretap", "foreign interference", "gru", "fsb", "svr",
      "counterintelligence", "official secrets", "clandestine", "informant",
      "state-sponsored",
    ],
    weight: 3,
  },
  SANCTIONS: {
    terms: [
      "sanction", "sanctions", "ofac", "export control", "embargo", "tariff",
      "tariffs", "blacklist", "designated", "asset freeze", "restrictions on",
    ],
    weight: 2,
  },
  POLITICAL: {
    terms: [
      "election", "parliament", "prime minister", "president", "minister",
      "summit", "treaty", "diplomat", "diplomatic", "coalition", "referendum",
      "government", "policy", "legislation", "cabinet", "vote",
    ],
    weight: 1,
  },
  SUPPLY: {
    terms: [
      "supply chain", "shortage", "logistics", "stockpile", "semiconductor",
      "rare earth", "critical minerals", "export ban", "inventories",
      "manufacturing", "production halt",
    ],
    weight: 2,
  },
  TECH: {
    terms: [
      "artificial intelligence", "ai", "quantum", "satellite", "space launch",
      "starlink", "chip", "chips", "data centre", "data center", "algorithm",
      "autonomous", "robotics", "5g", "6g",
    ],
    weight: 1,
  },
};

const FLASH_TERMS = [
  "missile", "airstrike", "air strike", "invasion", "nuclear", "killed",
  "explosion", "attack on", "state of emergency", "coup", "assassinat",
  "mass casualty", "declares war", "evacuation order",
];

const IMMEDIATE_TERMS = [
  "strike", "breach", "ransomware", "outage", "sabotage", "shot down",
  "seized", "detained", "scrambled", "zero-day", "critical vulnerability",
  "warns", "escalation", "mutiny", "incursion", "airspace violation",
];

export type Classification = {
  tags: Tag[];
  precedence: Precedence;
  /** 0-100 confidence that tagging is meaningful (keyword density based). */
  confidence: number;
};

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const regexCache = new Map<string, RegExp>();

/**
 * Word-boundary matching. Substring matching produced false positives
 * (e.g. "uk" inside "Ukrainians"), so terms must match as whole words.
 */
function buildRegex(terms: string[]): RegExp {
  const key = terms.join("|");
  const cached = regexCache.get(key);
  if (cached) return cached;
  const pattern = terms
    .map((t) => escapeRegex(t.trim()))
    .sort((a, b) => b.length - a.length)
    .join("|");
  const re = new RegExp(`(?<![a-z0-9])(?:${pattern})(?![a-z0-9])`, "gi");
  regexCache.set(key, re);
  return re;
}

function countMatches(haystack: string, terms: string[]): number {
  const re = buildRegex(terms);
  re.lastIndex = 0;
  const found = new Set<string>();
  for (const match of haystack.matchAll(re)) {
    found.add(match[0].toLowerCase());
  }
  return found.size;
}

export function classify(input: {
  title: string;
  summary?: string | null;
  feedLanes?: string[];
  publishedAt?: Date | null;
}): Classification {
  const title = (input.title ?? "").toLowerCase();
  const body = (input.summary ?? "").toLowerCase();
  const haystack = ` ${title} ${body} `;

  const scores = new Map<Tag, number>();
  for (const [tag, rule] of Object.entries(TAG_RULES) as Array<[Tag, { terms: string[]; weight?: number }]>) {
    const titleHits = countMatches(title, rule.terms);
    const bodyHits = countMatches(body, rule.terms);
    const score = (titleHits * 3 + bodyHits) * (rule.weight ?? 1);
    if (score > 0) scores.set(tag, score);
  }

  /**
   * Feed provenance maps only to sector tags. Theatre tags (KINETIC, ESPIONAGE,
   * TERROR, NUCLEAR) must be earned from the wording, or a world-news feed would
   * label a court ruling as armed conflict.
   */
  const laneTagMap: Record<string, Tag> = {
    uk: "UK",
    "uk-defence": "DEFENCE",
    war: "POLITICAL",
    "oil-gas": "ENERGY",
    markets: "MARKETS",
    cyber: "CYBER",
    intel: "POLITICAL",
  };
  const laneTags = (input.feedLanes ?? [])
    .map((lane) => laneTagMap[lane])
    .filter(Boolean) as Tag[];

  for (const tag of laneTags) {
    if (scores.has(tag)) scores.set(tag, (scores.get(tag) ?? 0) + 3);
  }

  // Theatre-level tags need stronger evidence than sector tags, otherwise a
  // "legal battle" reads as armed conflict.
  const HIGH_BAR: Partial<Record<Tag, number>> = {
    KINETIC: 6,
    ESPIONAGE: 6,
    TERROR: 6,
    NUCLEAR: 6,
  };

  let tags = [...scores.entries()]
    .filter(([tag, score]) => score >= (HIGH_BAR[tag] ?? 3))
    .sort((a, b) => b[1] - a[1] || TAG_ORDER.indexOf(a[0]) - TAG_ORDER.indexOf(b[0]))
    .slice(0, 4)
    .map(([tag]) => tag)
    .sort((a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b));

  // Nothing matched textually: fall back to the collecting feed's remit.
  if (tags.length === 0 && laneTags.length > 0) {
    tags = [...new Set(laneTags)]
      .slice(0, 2)
      .sort((a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b));
  }

  const ageHours = input.publishedAt
    ? (Date.now() - input.publishedAt.getTime()) / 36e5
    : 999;

  const flashTitleHits = countMatches(title, FLASH_TERMS);
  const flashHits = countMatches(haystack, FLASH_TERMS);
  const immediateHits = countMatches(haystack, IMMEDIATE_TERMS);

  let precedence: Precedence = "ROUTINE";
  if (flashTitleHits >= 2 && ageHours <= 12) precedence = "FLASH";
  else if (flashTitleHits >= 1 && ageHours <= 24) precedence = "IMMEDIATE";
  else if (flashHits >= 2 || immediateHits >= 2) precedence = "PRIORITY";
  else if (
    (immediateHits >= 1 || flashHits >= 1) &&
    tags.some((t) => t === "DEFENCE" || t === "CYBER" || t === "ENERGY" || t === "KINETIC")
  ) {
    precedence = "PRIORITY";
  }

  const topScore = Math.max(0, ...scores.values());
  const confidence = Math.max(15, Math.min(92, Math.round(30 + topScore * 4)));

  return { tags, precedence, confidence };
}

export const TAG_STYLES: Record<Tag, { fg: string; bg: string; border: string }> = {
  DEFENCE: { fg: "#ffcf5c", bg: "rgba(255,176,0,0.10)", border: "rgba(255,176,0,0.45)" },
  UK: { fg: "#9dc4ff", bg: "rgba(90,140,255,0.10)", border: "rgba(120,160,255,0.42)" },
  ENERGY: { fg: "#f0a35e", bg: "rgba(224,122,40,0.10)", border: "rgba(224,122,40,0.45)" },
  MARKETS: { fg: "#8fd9b6", bg: "rgba(70,180,130,0.10)", border: "rgba(70,180,130,0.42)" },
  CYBER: { fg: "#7fe0d4", bg: "rgba(70,200,190,0.10)", border: "rgba(70,200,190,0.42)" },
  KINETIC: { fg: "#ff9a8a", bg: "rgba(220,80,60,0.12)", border: "rgba(220,80,60,0.48)" },
  MARITIME: { fg: "#86c8e8", bg: "rgba(70,150,200,0.10)", border: "rgba(70,150,200,0.40)" },
  AIR: { fg: "#b9c6d6", bg: "rgba(150,170,200,0.10)", border: "rgba(150,170,200,0.35)" },
  NUCLEAR: { fg: "#e8e07f", bg: "rgba(215,205,60,0.10)", border: "rgba(215,205,60,0.42)" },
  TERROR: { fg: "#f08a8a", bg: "rgba(200,60,60,0.12)", border: "rgba(200,60,60,0.45)" },
  ESPIONAGE: { fg: "#c9a6e8", bg: "rgba(150,100,200,0.10)", border: "rgba(150,100,200,0.40)" },
  SANCTIONS: { fg: "#d8b98a", bg: "rgba(190,150,90,0.10)", border: "rgba(190,150,90,0.40)" },
  POLITICAL: { fg: "#a8b6c8", bg: "rgba(130,150,175,0.10)", border: "rgba(130,150,175,0.32)" },
  SUPPLY: { fg: "#b3cf94", bg: "rgba(140,180,100,0.10)", border: "rgba(140,180,100,0.38)" },
  TECH: { fg: "#a5bede", bg: "rgba(120,150,200,0.10)", border: "rgba(120,150,200,0.34)" },
};

export const PRECEDENCE_STYLES: Record<Precedence, { fg: string; bg: string }> = {
  FLASH: { fg: "#ff6b57", bg: "rgba(255,80,60,0.16)" },
  IMMEDIATE: { fg: "#ffb000", bg: "rgba(255,176,0,0.14)" },
  PRIORITY: { fg: "#5eb3b3", bg: "rgba(94,179,179,0.12)" },
  ROUTINE: { fg: "#7f92a8", bg: "rgba(127,146,168,0.10)" },
};
