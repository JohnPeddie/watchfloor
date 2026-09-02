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

const IMPLICATIONS: Partial<Record<Tag, string>> = {
  DEFENCE:
    "Bears on force posture and procurement commitments; expect follow-on statements from allied defence ministries and shifts in readiness levels.",
  UK: "Direct UK relevance — watch for Whitehall response, parliamentary scrutiny, and knock-on effects for domestic policy or sterling.",
  KINETIC:
    "Escalation risk in theatre; monitor for spillover into shipping lanes, energy corridors, and allied force movements.",
  CYBER:
    "Raises exposure for connected networks and third-party suppliers; check vendor advisories, patch status, and NCSC/CISA guidance.",
  ENERGY:
    "Feeds directly into crude and gas pricing; monitor Brent and WTI reaction plus any disruption to import routes and refinery throughput.",
  MARKETS:
    "Shapes rate expectations and risk appetite; watch index, currency, and yield reaction over the next sessions.",
  ESPIONAGE:
    "Indicates hybrid or covert activity; expect attribution disputes, diplomatic expulsions, or counter-intelligence responses.",
  NUCLEAR:
    "Carries strategic deterrence implications; watch IAEA reporting, enrichment declarations, and alliance signalling.",
  MARITIME:
    "Affects chokepoint transit risk; monitor insurance rates, convoy activity, and rerouting of tanker traffic.",
  AIR: "Affects airspace control and air defence readiness; watch NOTAMs, intercept reporting, and civil aviation diversions.",
  TERROR:
    "Elevates threat-to-life and public-space risk; watch national threat-level reviews and policing posture.",
  SANCTIONS:
    "Compliance and trade-flow consequences; watch designations, licence carve-outs, and re-routing through third countries.",
  SUPPLY:
    "Supply-chain and inventory consequences; monitor lead times, substitute sourcing, and input-cost pass-through.",
  POLITICAL:
    "Political consequence for policy direction and coalition stability; watch subsequent votes, appointments, and legislative timetables.",
  TECH: "Technology-capability shift with dual-use potential; watch export controls, procurement pipelines, and infrastructure dependencies.",
};

/** Rules-based "so what" line. Replaced by the local LLM later. */
export function deriveImplication(tags: Tag[], placeLabel: string | null): string | null {
  const chosen = tags.map((t) => IMPLICATIONS[t]).filter(Boolean).slice(0, 2) as string[];
  if (chosen.length === 0) return null;
  const geo = placeLabel ? `Focus area: ${placeLabel}. ` : "";
  return geo + chosen.join(" ");
}
