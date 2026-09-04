"use client";

import type { ReactNode } from "react";
import { GradeChip, PrecedenceChip, TagChips } from "@/components/Chips";
import { HelpButton } from "@/components/HelpButton";
import { Icon } from "@/components/Icon";
import { MediaFrame } from "@/components/MediaFrame";
import { dtgShort } from "@/lib/dtg";
import type { ArticleDTO } from "@/lib/serializers";

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

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {articles.length === 0 && (
          <p className="md-body px-3 py-6 text-center">
            No reporting matches the current filters. Try clearing the search or running a
            collection.
          </p>
        )}

        <div className="space-y-0.5">
          {articles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelectArticle(a)}
              className="md-state md-list-item"
              data-selected={a.id === selectedArticleId}
            >
              <MediaFrame src={a.imageUrl} className="w-[88px] rounded-lg" />

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <PrecedenceChip precedence={a.precedence} dense />
                  <span className="md-label-sm md-mono truncate text-[var(--md-secondary)]">
                    {a.sourceCode}
                  </span>
                  <GradeChip grade={a.sourceGrade} />
                  <span className="md-label-sm md-mono ml-auto shrink-0">
                    {a.publishedAt ? dtgShort(new Date(a.publishedAt)) : "—"}
                  </span>
                </div>

                <div className="md-title line-clamp-2 leading-snug text-[var(--md-on-surface)]">
                  {a.title}
                </div>

                <p className="md-body mt-0.5 line-clamp-1 text-[12px]">
                  {a.analysis ?? a.summary ?? "No summary captured."}
                </p>

                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <TagChips tags={a.tags} max={3} wrap={false} />
                  {a.placeLabel && (
                    <span className="md-label-sm ml-auto flex min-w-0 items-center gap-1">
                      <Icon name="place" size={12} />
                      <span className="truncate">{a.placeLabel}</span>
                    </span>
                  )}
                  {a.images.length > 1 && (
                    <span className="md-label-sm flex shrink-0 items-center gap-1">
                      <Icon name="layers" size={12} />
                      {a.images.length}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
