"use client";

import { GradeChip, PrecedenceChip, TagChips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { dtgShort } from "@/lib/dtg";
import type { ArticleDTO } from "@/lib/serializers";

type TrafficPaneProps = {
  articles: ArticleDTO[];
  matched: number;
  total: number;
  selectedArticleId: string | null;
  onSelectArticle: (article: ArticleDTO) => void;
  activeTag: string | null;
};

export function TrafficPane({
  articles,
  matched,
  total,
  selectedArticleId,
  onSelectArticle,
  activeTag,
}: TrafficPaneProps) {
  return (
    <section className="md-pane flex h-full min-h-0 flex-col">
      <div className="md-pane-head">
        <div>
          <div className="md-title-lg">Reporting stream</div>
          <div className="md-label-sm">
            {`${matched} of ${total} items${activeTag ? ` · ${activeTag}` : ""}`}
          </div>
        </div>
        <span className="md-label-sm md-mono">Click an item to read the summary</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {articles.length === 0 && (
          <p className="md-body px-3 py-6 text-center">
            No reporting matches the current filters. Try clearing the search or running a
            collection.
          </p>
        )}

        <div className="space-y-1">
          {articles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelectArticle(a)}
              className="md-state md-list-item items-start"
              data-selected={a.id === selectedArticleId}
            >
              <div
                className="h-[58px] w-[80px] shrink-0 overflow-hidden rounded-xl"
                style={{ background: "var(--md-container-high)" }}
              >
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--md-outline)]">
                    <Icon name="article" size={18} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <PrecedenceChip precedence={a.precedence} dense />
                  <span className="md-label-sm md-mono text-[var(--md-secondary)]">
                    {a.sourceCode}
                  </span>
                  <GradeChip grade={a.sourceGrade} />
                  <span className="md-label-sm md-mono ml-auto">
                    {a.publishedAt ? dtgShort(new Date(a.publishedAt)) : "—"}
                  </span>
                </div>

                <div className="md-title mb-1 line-clamp-2 leading-snug text-[var(--md-on-surface)]">
                  {a.title}
                </div>

                <p className="md-body mb-1.5 line-clamp-2 text-[12px]">
                  {a.analysis ?? a.summary ?? "No summary captured."}
                </p>

                <div className="flex items-center gap-2">
                  <TagChips tags={a.tags} max={3} />
                  {a.placeLabel && (
                    <span className="md-label-sm flex items-center gap-1 whitespace-nowrap">
                      <Icon name="place" size={12} />
                      {a.placeLabel}
                    </span>
                  )}
                  {a.images.length > 1 && (
                    <span className="md-label-sm ml-auto flex items-center gap-1 whitespace-nowrap">
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
