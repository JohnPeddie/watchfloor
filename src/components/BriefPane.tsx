"use client";

import { PrecedenceChip, TagChips } from "@/components/Chips";
import { HelpButton } from "@/components/HelpButton";
import { Icon } from "@/components/Icon";
import type { BriefDTO, BriefStoryDTO } from "@/lib/serializers";
import { briefGeneratorLabel } from "@/lib/model-label";

type BriefPaneProps = {
  brief: BriefDTO | null;
  selectedStoryId: string | null;
  onSelectStory: (story: BriefStoryDTO) => void;
  rebuilding?: boolean;
  loading?: boolean;
  onRebuild?: () => void;
};

export function BriefPane({
  brief,
  selectedStoryId,
  onSelectStory,
  rebuilding = false,
  loading = false,
  onRebuild,
}: BriefPaneProps) {
  const generator = brief ? briefGeneratorLabel(brief.source) : null;
  const waiting = !brief && loading;

  return (
    <section className="md-pane flex h-full min-h-0 flex-col">
      <div className="md-pane-head">
        <div className="min-w-0">
          <div className="md-title-lg">Daily brief</div>
          <div className="md-label-sm truncate">
            {brief ? brief.title : waiting ? "Opening today's brief…" : "No product loaded"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="md-mono rounded-full px-2 py-0.5 text-[10.5px]"
            style={{
              background: "var(--md-container-high)",
              color: "var(--md-on-surface-variant)",
            }}
          >
            {brief ? `${brief.stories.length} items` : "0"}
          </span>
          {onRebuild && (
            <button
              type="button"
              className="md-btn-text"
              onClick={onRebuild}
              disabled={rebuilding}
              title="Rebuild today's brief from current holdings"
              aria-label={rebuilding ? "Rebuilding brief" : "Rebuild brief"}
            >
              <Icon name="refresh" size={16} className={rebuilding ? "md-pulse" : ""} />
              <span className="hidden sm:inline">{rebuilding ? "Rebuilding" : "Rebuild"}</span>
            </button>
          )}
          <HelpButton topic="brief" />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {waiting && (
          <p className="md-body px-1 py-4">Opening today&apos;s brief…</p>
        )}

        {!brief && !loading && (
          <p className="md-body px-1 py-4">
            No brief in holdings. Use <strong>Rebuild</strong> to generate today&apos;s Global
            Radar Report, or run <code>npm run brief</code>.
          </p>
        )}

        {brief?.bluf && (
          <section
            className="rounded-2xl p-3"
            style={{
              background: "var(--md-primary-container)",
              color: "var(--md-on-primary-container)",
            }}
          >
            <h3
              className="md-label mb-1 flex items-center gap-1.5"
              style={{ color: "var(--md-on-primary-container)" }}
            >
              <Icon name="insights" size={15} />
              Bottom line
            </h3>
            <p className="text-[12.5px] leading-relaxed">{brief.bluf}</p>
            {generator && brief.source !== "authored" && (
              <p className="md-mono mt-2 text-[10px] opacity-75" title={generator.title}>
                {generator.caption}
              </p>
            )}
          </section>
        )}

        {brief?.stories.map((story, idx) => {
          const active = story.id === selectedStoryId;
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onSelectStory(story)}
              className="md-state block w-full rounded-2xl p-3 text-left"
              style={{
                background: active ? "var(--md-container-high)" : "var(--md-container)",
                boxShadow: active ? "var(--elev-2)" : "var(--elev-1)",
                borderLeft: active
                  ? "3px solid var(--md-primary)"
                  : "3px solid transparent",
              }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="md-label-sm md-mono">
                  {`Item ${String(idx + 1).padStart(2, "0")}`}
                </span>
                <PrecedenceChip precedence={story.precedence} dense />
              </div>

              <div className="md-title mb-1.5 leading-snug text-[var(--md-on-surface)]">
                {story.headline}
              </div>

              <p className="md-body mb-2 line-clamp-2 text-[12.5px]">
                {story.paragraphs[0]}
              </p>

              <div className="flex items-center justify-between gap-2">
                <TagChips tags={story.tags} max={3} />
                <span className="md-label-sm flex items-center gap-2 whitespace-nowrap">
                  {story.placeLabel && (
                    <span className="flex items-center gap-1">
                      <Icon name="place" size={13} />
                      {story.placeLabel}
                    </span>
                  )}
                  <span className="md-mono">
                    {`${Math.max(story.sources.length, story.relatedArticleIds.length) || 0} src`}
                  </span>
                </span>
              </div>

              {generator && (
                <span
                  className="md-label-sm md-mono mt-2 block truncate"
                  title={generator.title}
                >
                  {generator.caption}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
