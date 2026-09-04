import type { Precedence, Tag } from "../classify";
import type { ArticleInput, StoryCluster } from "../summarize/types";

/** Article shape needed for clustering, as stored. */
export type ClusterCandidate = ArticleInput & {
  precedence: Precedence;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  publishedAt: Date | null;
};

const PRECEDENCE_RANK: Record<Precedence, number> = {
  FLASH: 4,
  IMMEDIATE: 3,
  PRIORITY: 2,
  ROUTINE: 1,
};

/**
 * Weighting reflects what this dashboard is for: UK and UK-adjacent defence
 * first, then the energy and conflict picture, then everything else.
 */
const TAG_WEIGHT: Partial<Record<Tag, number>> = {
  UK: 3.0,
  DEFENCE: 2.6,
  KINETIC: 2.2,
  ENERGY: 2.0,
  CYBER: 1.8,
  NUCLEAR: 1.8,
  MARITIME: 1.5,
  ESPIONAGE: 1.5,
  MARKETS: 1.4,
  TERROR: 1.4,
  SANCTIONS: 1.1,
  AIR: 1.0,
  SUPPLY: 0.9,
  TECH: 0.8,
  POLITICAL: 0.6,
};

/** Standing interest lanes the brief should try to represent. */
export const COVERAGE_LANES: Tag[] = [
  "UK",
  "DEFENCE",
  "KINETIC",
  "ENERGY",
  "CYBER",
  "MARKETS",
];

export const MIN_BRIEF_STORIES = 5;
/** Hard cap so a frantic news day cannot drown the product. */
export const BRIEF_CEILING = 12;
export const DEFAULT_MAX_BRIEF_STORIES = BRIEF_CEILING;
/** Distinct coverage lanes that count as a reasonably mixed product. */
export const MIN_COVERAGE_LANES = 3;

const TITLE_STOPWORDS = new Set([
  "after", "amid", "with", "from", "over", "into", "says", "said", "will",
  "that", "this", "their", "there", "than", "then", "have", "been", "more",
  "most", "what", "when", "which", "would", "could", "about", "against",
  "first", "year", "years", "week", "them", "they", "your", "just", "also",
]);

/**
 * Truncating to a stem folds the morphological variants that headline writers
 * reach for — Argentina/Argentine/Argentinian, sanction/sanctions — onto one
 * token. Seven characters is long enough to keep genuinely different words
 * apart (military/militant still diverge).
 */
const STEM_LENGTH = 7;

function titleTokens(title: string): Set<string> {
  return new Set(
    (title.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? [])
      .filter((word) => !TITLE_STOPWORDS.has(word))
      .map((word) => word.replace(/['’-]/g, "").slice(0, STEM_LENGTH)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * Tokens rare across the day's reporting. Two headlines sharing "falkland" and
 * "argentin" are almost certainly the same event; sharing "defence" and
 * "minister" means nothing, because half the feed does.
 */
function rareTokens(candidates: ClusterCandidate[]): Set<string> {
  const frequency = new Map<string, number>();
  for (const candidate of candidates) {
    for (const token of titleTokens(candidate.title)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const ceiling = Math.max(3, Math.ceil(candidates.length * 0.08));
  return new Set(
    [...frequency.entries()].filter(([, count]) => count <= ceiling).map(([token]) => token),
  );
}

function sharedRareCount(a: Set<string>, b: Set<string>, rare: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word) && rare.has(word)) shared++;
  return shared;
}

type WorkingCluster = {
  members: ClusterCandidate[];
  /** Tokens from the first article only — a growing union would match everything. */
  leadTokens: Set<string>;
};

export type ClusterOptions = {
  maxClusters?: number;
  minOverlap?: number;
  /** Reports a cluster needs before it earns a place in the brief. */
  minSources?: number;
  /** Distinct outlets required, so one newsroom's run of stories is not mistaken for corroboration. */
  minOutlets?: number;
};

/**
 * Groups articles covering the same event.
 *
 * Deliberately conservative: headline word overlap must be strong, and a
 * shared location or theme is required as corroboration. Over-merging is worse
 * than under-merging, because a merged cluster produces one story that
 * conflates two unrelated events.
 */
export function clusterArticles(
  candidates: ClusterCandidate[],
  {
    maxClusters = BRIEF_CEILING,
    minOverlap = 0.38,
    minSources = 4,
    minOutlets = 1,
  }: ClusterOptions = {},
): StoryCluster[] {
  const ordered = [...candidates].sort((a, b) => {
    const rank = PRECEDENCE_RANK[b.precedence] - PRECEDENCE_RANK[a.precedence];
    if (rank !== 0) return rank;
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  });

  const rare = rareTokens(candidates);
  const working: WorkingCluster[] = [];

  for (const article of ordered) {
    const tokens = titleTokens(article.title);
    let placed = false;

    for (const cluster of working) {
      const sim = overlap(tokens, cluster.leadTokens);

      // Plain word overlap drops off as headlines vary, so a weaker overlap
      // still counts when the shared words are distinctive.
      const named = sharedRareCount(tokens, cluster.leadTokens, rare);
      if (sim < minOverlap && !(named >= 2 && sim >= minOverlap / 2)) continue;

      const samePlace = cluster.members.some(
        (m) => m.placeLabel && article.placeLabel && m.placeLabel === article.placeLabel,
      );
      const sharedTag = cluster.members.some((m) =>
        m.tags.some((t) => article.tags.includes(t)),
      );
      if (!samePlace && !sharedTag) continue;

      cluster.members.push(article);
      placed = true;
      break;
    }

    if (!placed) working.push({ members: [article], leadTokens: tokens });
  }

  return working
    .filter(
      (cluster) =>
        cluster.members.length >= minSources &&
        new Set(cluster.members.map((m) => m.sourceName)).size >= minOutlets,
    )
    .map(toStoryCluster)
    // Score decides which stories make the brief, then precedence decides the
    // running order, as it would on a real watchfloor.
    .sort((a, b) => clusterScore(b) - clusterScore(a))
    .slice(0, maxClusters)
    .map((cluster, index) => ({ ...cluster, key: `${index}:${cluster.key}` }));
}

function toStoryCluster(cluster: WorkingCluster): StoryCluster & { members: ClusterCandidate[] } {
  const members = cluster.members;
  const lead =
    members.find((m) => m.lat != null && m.lng != null) ?? members[0];

  const tagCounts = new Map<Tag, number>();
  for (const member of members) {
    for (const tag of member.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || (TAG_WEIGHT[b[0]] ?? 0) - (TAG_WEIGHT[a[0]] ?? 0))
    .slice(0, 4)
    .map(([tag]) => tag);

  const precedence = members.reduce<Precedence>(
    (worst, m) => (PRECEDENCE_RANK[m.precedence] > PRECEDENCE_RANK[worst] ? m.precedence : worst),
    "ROUTINE",
  );

  return {
    key: members[0]?.id ?? "cluster",
    tags,
    precedence,
    placeLabel: lead?.placeLabel ?? null,
    lat: lead?.lat ?? null,
    lng: lead?.lng ?? null,
    imageUrl: members.find((m) => m.imageUrl)?.imageUrl ?? null,
    articles: members,
    members,
  };
}

/**
 * Ranks clusters for inclusion in the brief: urgency first, then how widely
 * the story is being reported, then how much it matters to this dashboard's
 * standing requirements.
 */
function clusterScore(cluster: StoryCluster & { members?: ClusterCandidate[] }): number {
  const members = cluster.members ?? cluster.articles;
  const urgency = PRECEDENCE_RANK[cluster.precedence] * 2.2;
  const corroboration = Math.log2(1 + new Set(members.map((m) => m.sourceName)).size) * 1.8;
  const relevance = cluster.tags.reduce((sum, tag) => sum + (TAG_WEIGHT[tag] ?? 0), 0);
  const substance = members.some((m) => (m.bodyText?.length ?? 0) > 800) ? 0.8 : 0;
  return urgency + corroboration + relevance + substance;
}

const COVERAGE_SET = new Set<Tag>(COVERAGE_LANES);

export function coverageLanesOf(items: { tags: Tag[] }[]): Set<Tag> {
  const present = new Set<Tag>();
  for (const item of items) {
    for (const tag of item.tags) {
      if (COVERAGE_SET.has(tag)) present.add(tag);
    }
  }
  return present;
}

export function briefIsAdequate(items: { tags: Tag[] }[]): boolean {
  return items.length >= MIN_BRIEF_STORIES && coverageLanesOf(items).size >= MIN_COVERAGE_LANES;
}

/**
 * Picks stories from a scored pool, filling uncovered interest lanes first.
 * `limit` is a ceiling, not a target — a busy day keeps every strong cluster
 * up to that cap.
 */
export function pickBriefClusters<T extends { tags: Tag[] }>(
  pool: T[],
  limit = BRIEF_CEILING,
): T[] {
  const remaining = [...pool];
  const selected: T[] = [];

  while (remaining.length > 0 && selected.length < limit) {
    const have = coverageLanesOf(selected);
    let idx = 0;
    if (have.size < COVERAGE_LANES.length) {
      const fill = remaining.findIndex((item) =>
        item.tags.some((tag) => COVERAGE_SET.has(tag) && !have.has(tag)),
      );
      if (fill >= 0) idx = fill;
    }
    selected.push(remaining.splice(idx, 1)[0]!);
  }

  return selected;
}

function sharesArticles(a: StoryCluster, b: StoryCluster): boolean {
  const ids = new Set(a.articles.map((article) => article.id));
  return b.articles.some((article) => ids.has(article.id));
}

/**
 * Keeps every already-chosen story and only pulls extras from `pool` until
 * the brief has five items and mixed lanes. Used when relaxing tolerance
 * so a quiet day can fill, without replacing a busy day's strict set.
 */
export function fillBriefToFloor(
  selected: StoryCluster[],
  pool: StoryCluster[],
  limit = BRIEF_CEILING,
): StoryCluster[] {
  const combined = [...selected];
  const remaining = pool.filter(
    (candidate) => !combined.some((have) => sharesArticles(have, candidate)),
  );

  while (remaining.length > 0 && combined.length < limit && !briefIsAdequate(combined)) {
    const have = coverageLanesOf(combined);
    let idx = 0;
    if (have.size < MIN_COVERAGE_LANES) {
      const fill = remaining.findIndex((item) =>
        item.tags.some((tag) => COVERAGE_SET.has(tag) && !have.has(tag)),
      );
      if (fill >= 0) idx = fill;
    }
    combined.push(remaining.splice(idx, 1)[0]!);
  }

  return combined;
}
