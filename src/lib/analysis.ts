import type { Tag } from "./classify";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "for",
  "with", "as", "by", "at", "from", "that", "this", "these", "those", "is",
  "are", "was", "were", "be", "been", "being", "it", "its", "he", "she", "they",
  "them", "his", "her", "their", "we", "you", "i", "not", "no", "has", "have",
  "had", "will", "would", "can", "could", "should", "may", "might", "said",
  "says", "also", "than", "then", "there", "which", "who", "what", "when",
  "how", "about", "after", "before", "into", "over", "more", "most", "other",
  "some", "such", "only", "own", "same", "so", "too", "very", "just", "one",
  "two", "new", "up", "out", "off", "down", "our", "us", "do", "does", "did",
]);

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"“'])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 45 && s.length <= 400);
}

/**
 * Extractive summary: frequency-scored sentences with a lead bias, returned in
 * original order so the result still reads as prose.
 */
export function summariseExtractive(
  bodyText: string | null,
  fallback: string | null,
  maxSentences = 4,
): string | null {
  const source = (bodyText && bodyText.length > 200 ? bodyText : fallback) ?? "";
  const list = sentences(source);
  if (list.length === 0) {
    return fallback?.trim() ? fallback.trim() : null;
  }
  if (list.length <= maxSentences) return list.join(" ");

  const freq = new Map<string, number>();
  for (const sentence of list) {
    for (const word of sentence.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (STOPWORDS.has(word)) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  const scored = list.map((sentence, index) => {
    const words = (sentence.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).filter(
      (w) => !STOPWORDS.has(w),
    );
    if (words.length === 0) return { sentence, index, score: 0 };
    const density = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / words.length;
    const leadBonus = index === 0 ? 1.5 : index === 1 ? 1.2 : index === 2 ? 1.08 : 1;
    const numericBonus = /\b\d/.test(sentence) ? 1.08 : 1;
    return { sentence, index, score: density * leadBonus * numericBonus };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence)
    .join(" ");
}

const IMPLICATION_PRIORITY: Tag[] = [
  "KINETIC",
  "NUCLEAR",
  "TERROR",
  "CYBER",
  "DEFENCE",
  "ENERGY",
  "MARITIME",
  "ESPIONAGE",
  "SANCTIONS",
  "AIR",
  "SUPPLY",
  "MARKETS",
  "TECH",
];

function primarySubstance(tags: Tag[]): Tag | null {
  return IMPLICATION_PRIORITY.find((tag) => tags.includes(tag)) ?? null;
}

function deskPlace(placeLabel: string | null, uk: boolean): string | null {
  if (!placeLabel) return null;
  const lower = placeLabel.toLowerCase();
  if (
    uk &&
    (lower === "london" ||
      lower === "united kingdom" ||
      lower === "uk" ||
      lower === "britain" ||
      lower === "england")
  ) {
    return null;
  }
  return placeLabel;
}

function fightingWhere(place: string | null): string {
  return place ? `Fighting around ${place}` : "The fighting";
}

/**
 * One tight "so what" for a UK watchfloor. Tags pick the frame; UK/US only
 * change whose desk it is. Never glue two canned paragraphs together.
 */
export function deriveImplication(tags: Tag[], placeLabel: string | null): string | null {
  if (tags.length === 0) return null;

  const uk = tags.includes("UK");
  const usOnly = tags.includes("US") && !uk;
  const place = deskPlace(placeLabel, uk);
  const primary = primarySubstance(tags);

  if (!primary) {
    if (tags.includes("POLITICAL")) {
      return uk
        ? "UK political consequence. The follow-through is the next vote, appointment, or item on the legislative timetable."
        : usOnly
          ? "US political story. It matters here only if it shifts alliance policy, defence spending, or sterling."
          : "Political development. Watch whether it shifts policy, coalitions, or a timetable that binds allies.";
    }
    if (uk) {
      return "UK domestic development. The follow-through is Whitehall, Parliament, or sterling — not a theatre problem until it becomes one.";
    }
    if (usOnly) {
      return "US domestic story. It matters here only if it changes alliance policy, US defence spending, or the sterling session.";
    }
    if (tags.includes("SPORT")) {
      return "Sporting development. Treat as background unless it crosses sanctions, state sponsorship, or a UK political row.";
    }
    return null;
  }

  return frameImplication(primary, { uk, usOnly, place });
}

function frameImplication(
  primary: Tag,
  ctx: { uk: boolean; usOnly: boolean; place: string | null },
): string {
  const { uk, usOnly, place } = ctx;

  switch (primary) {
    case "KINETIC":
      if (uk) {
        return `${fightingWhere(place)} can spill into shipping, energy routes, or allied deployments. That is a UK desk problem if it does.`;
      }
      return `${fightingWhere(place)} can spread into shipping, energy corridors, and force movements. Track spillover, not the day’s tactical noise.`;

    case "NUCLEAR":
      return uk
        ? "Nuclear and deterrence stakes. Watch IAEA reporting and how NATO and the UK deterrent enterprise respond."
        : "Nuclear and deterrence stakes. Watch IAEA reporting, enrichment claims, and alliance signalling.";

    case "TERROR":
      return uk
        ? "Threat-to-life and public-space risk with a UK angle. Watch the national threat level and policing posture."
        : "Threat-to-life and public-space risk. Watch threat-level reviews and whether UK policing or aviation posture shifts.";

    case "CYBER":
      return "Live network risk. Check patch status and whether NCSC or CISA guidance applies to UK operators and their suppliers.";

    case "DEFENCE":
      if (uk) {
        return "UK force posture and the equipment programme. The next signal is Whitehall or an allied ministry on readiness, basing, or kit.";
      }
      if (usOnly) {
        return "US force-posture story. Second-order for the UK unless it changes NATO tasking, Five Eyes access, or a programme Britain is on.";
      }
      return "Force posture and procurement. Watch allied defence ministries and whether readiness or tasking actually moves.";

    case "ENERGY":
      return place
        ? `Energy-market story centred on ${place}. Watch Brent and WTI, and whether import routes or refining are actually disrupted.`
        : "This feeds crude and gas prices. Watch Brent and WTI, and whether import routes or refining are actually disrupted.";

    case "MARITIME":
      return place
        ? `${place} is a transit risk: hull insurance, convoys, and tanker rerouting.`
        : "Chokepoint and shipping risk. Watch insurance, convoys, and whether tankers actually reroute.";

    case "ESPIONAGE":
      return uk
        ? "Hybrid or covert activity with a UK stake. Attribution rows, expulsions, or a counter-intelligence response are the usual next steps."
        : "Hybrid or covert activity. Attribution disputes, expulsions, or a counter-intelligence response are the usual next steps.";

    case "SANCTIONS":
      return "Trade and compliance hit. Watch designations, licences, and rerouting through third countries — including UK exposure.";

    case "AIR":
      return "Airspace and air-defence issue. Watch NOTAMs, intercepts, and civil aviation diversions.";

    case "SUPPLY":
      return "Inventory and lead times. Watch substitutes and whether costs pass through to UK buyers.";

    case "MARKETS":
      if (usOnly) {
        return "US market move. Watch whether it shows up in sterling, gilts, or UK-listed names this session.";
      }
      return uk
        ? "UK market and sterling story. Watch index, gilt, and currency reaction over the next sessions."
        : "This can move rates, currencies, and risk appetite. Watch index and yield reaction over the next sessions.";

    case "TECH":
      return "Capability and dual-use issue. Watch export controls and whether UK procurement or infrastructure depends on it.";

    default:
      return uk
        ? "UK-relevant development. Watch Whitehall response and whether policy or sterling follows."
        : "Worth tracking for policy follow-through, not as a theatre event.";
  }
}
