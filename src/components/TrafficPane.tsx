"use client";

import { useMemo, useState, type ReactNode } from "react";
import { GradeChip, PrecedenceChip, TagChips } from "@/components/Chips";
import { HelpButton } from "@/components/HelpButton";
import { Icon } from "@/components/Icon";
import { MediaFrame } from "@/components/MediaFrame";
import { TAG_ORDER, type Precedence, type Tag } from "@/lib/classify";
import { dtgShort } from "@/lib/dtg";
import type { ArticleDTO } from "@/lib/serializers";

type StreamSort = "recent" | "urgency" | "tags";

const SORTS: { id: StreamSort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "urgency", label: "Urgency" },
  { id: "tags", label: "Tags" },
];

const PRECEDENCE_RANK: Record<Precedence, number> = {
  FLASH: 0,
  IMMEDIATE: 1,
  PRIORITY: 2,
  ROUTINE: 3,
};

type TrafficPaneProps = {
  articles: ArticleDTO[];
  matched: number;
  total: number;
  selectedArticleId: string | null;
  onSelectArticle: (article: ArticleDTO) => void;
  activeTag: string | null;
  /** Header controls supplied by the layout, such as the minimise button. */
  actions?: ReactNode;
  /** Tighter rows for the tablet stream column. */
  dense?: boolean;
};

export function TrafficPane({
  articles,
  matched,
  total,
  selectedArticleId,
  onSelectArticle,
  activeTag,
  actions,
}: TrafficPaneProps) {
  const [sort, setSort] = useState<StreamSort>("recent");

  const rows = useMemo(() => orderArticles(articles, sort), [articles, sort]);

  return (
    <section className="md-pane flex h-full min-h-0 flex-col">
      <div className="md-pane-head">
        <div className="min-w-0">
          <div className="md-title-lg">Reporting stream</div>
          <div className="md-label-sm truncate">
            {`${matched} of ${total} items${activeTag ? ` · ${activeTag}` : ""}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <HelpButton topic="stream" />
          {actions}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-0.5 px-3 pb-2"
        role="group"
        aria-label="Sort reporting stream"
      >
        {SORTS.map((item) => {
          const active = item.id === sort;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSort(item.id)}
              aria-pressed={active}
              className="md-chip md-chip-filter"
              style={{
                height: 24,
                fontSize: 10,
                color: active ? undefined : "var(--md-on-surface-variant)",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {articles.length === 0 && (
          <p className="md-body px-3 py-6 text-center">
            No reporting matches the current filters. Try clearing the search or running a
            collection.
          </p>
        )}

        <div className="space-y-0.5">
          {rows.map((row) =>
            row.kind === "group" ? (
              <div
                key={`g:${row.label}`}
                className="md-label sticky top-0 z-10 px-2 pb-1 pt-2"
                style={{ background: "var(--md-container-low)" }}
              >
                {row.label}
              </div>
            ) : (
              <ArticleRow
                key={row.article.id}
                article={row.article}
                selected={row.article.id === selectedArticleId}
                onSelect={onSelectArticle}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function ArticleRow({
  article,
  selected,
  onSelect,
}: {
  article: ArticleDTO;
  selected: boolean;
  onSelect: (article: ArticleDTO) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(article)}
      className="md-state md-list-item"
      data-selected={selected}
    >
      <MediaFrame src={article.imageUrl} className="w-[88px] rounded-lg" />

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <PrecedenceChip precedence={article.precedence} dense />
          <span className="md-label-sm md-mono truncate text-[var(--md-secondary)]">
            {article.sourceCode}
          </span>
          <GradeChip grade={article.sourceGrade} />
          <span className="md-label-sm md-mono ml-auto shrink-0">
            {article.publishedAt ? dtgShort(new Date(article.publishedAt)) : "—"}
          </span>
        </div>

        <div className="md-title line-clamp-2 leading-snug text-[var(--md-on-surface)]">
          {article.title}
        </div>

        <p className="md-body mt-0.5 line-clamp-1 text-[12px]">
          {article.analysis ?? article.summary ?? "No summary captured."}
        </p>

        <div className="mt-1 flex min-w-0 items-center gap-2">
          <TagChips tags={article.tags} max={3} wrap={false} />
          {article.placeLabel && (
            <span className="md-label-sm ml-auto flex min-w-0 items-center gap-1">
              <Icon name="place" size={12} />
              <span className="truncate">{article.placeLabel}</span>
            </span>
          )}
          {article.images.length > 1 && (
            <span className="md-label-sm flex shrink-0 items-center gap-1">
              <Icon name="layers" size={12} />
              {article.images.length}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

type StreamRow =
  | { kind: "group"; label: string }
  | { kind: "article"; article: ArticleDTO };

function publishedTime(article: ArticleDTO): number {
  return article.publishedAt ? new Date(article.publishedAt).getTime() : 0;
}

function primaryTag(tags: Tag[]): Tag | null {
  return TAG_ORDER.find((tag) => tags.includes(tag)) ?? null;
}

function tagRank(tags: Tag[]): number {
  const tag = primaryTag(tags);
  return tag ? TAG_ORDER.indexOf(tag) : TAG_ORDER.length;
}

function tagGroupLabel(tags: Tag[]): string {
  const tag = primaryTag(tags);
  if (!tag) return "UNTAGGED";
  return tag === "KINETIC" ? "CONFLICT" : tag;
}

function orderArticles(articles: ArticleDTO[], sort: StreamSort): StreamRow[] {
  const sorted = [...articles].sort((a, b) => {
    if (sort === "urgency") {
      const rank = PRECEDENCE_RANK[a.precedence] - PRECEDENCE_RANK[b.precedence];
      if (rank !== 0) return rank;
    }
    if (sort === "tags") {
      const rank = tagRank(a.tags) - tagRank(b.tags);
      if (rank !== 0) return rank;
    }
    return publishedTime(b) - publishedTime(a);
  });

  if (sort === "recent") {
    return sorted.map((article) => ({ kind: "article" as const, article }));
  }

  const rows: StreamRow[] = [];
  let last = "";
  for (const article of sorted) {
    const label = sort === "urgency" ? article.precedence : tagGroupLabel(article.tags);
    if (label !== last) {
      rows.push({ kind: "group", label });
      last = label;
    }
    rows.push({ kind: "article", article });
  }
  return rows;
}
