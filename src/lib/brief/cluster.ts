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

const TITLE_STOPWORDS = new Set([
  "after", "amid", "with", "from", "over", "into", "says", "said", "will",
  "that", "this", "their", "there", "than", "then", "have", "been", "more",
  "most", "what", "when", "which", "would", "could", "about", "against",
  "first", "year", "years", "week", "them", "they", "your", "just", "also",
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    (title.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter(
      (word) => !TITLE_STOPWORDS.has(word),
    ),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / Math.min(a.size, b.size);
}

type WorkingCluster = {
  members: ClusterCandidate[];
  tokens: Set<string>;
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
  { maxClusters = 7, minOverlap = 0.42 }: { maxClusters?: number; minOverlap?: number } = {},
): StoryCluster[] {
  const ordered = [...candidates].sort((a, b) => {
    const rank = PRECEDENCE_RANK[b.precedence] - PRECEDENCE_RANK[a.precedence];
    if (rank !== 0) return rank;
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  });

  const working: WorkingCluster[] = [];

  for (const article of ordered) {
    const tokens = titleTokens(article.title);
    let placed = false;

    for (const cluster of working) {
      const sim = overlap(tokens, cluster.tokens);
      if (sim < minOverlap) continue;

      const samePlace = cluster.members.some(
        (m) => m.placeLabel && article.placeLabel && m.placeLabel === article.placeLabel,
      );
      const sharedTag = cluster.members.some((m) =>
        m.tags.some((t) => article.tags.includes(t)),
      );
      if (!samePlace && !sharedTag) continue;

      cluster.members.push(article);
      for (const token of tokens) cluster.tokens.add(token);
      placed = true;
      break;
    }

    if (!placed) working.push({ members: [article], tokens });
  }

  return working
    .map(toStoryCluster)
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
  const members = cluster.members ?? [];
  const urgency = PRECEDENCE_RANK[cluster.precedence] * 2.2;
  const corroboration = Math.log2(1 + new Set(members.map((m) => m.sourceName)).size) * 1.8;
  const relevance = cluster.tags.reduce((sum, tag) => sum + (TAG_WEIGHT[tag] ?? 0), 0);
  const substance = members.some((m) => (m.bodyText?.length ?? 0) > 800) ? 0.8 : 0;
  return urgency + corroboration + relevance + substance;
}
