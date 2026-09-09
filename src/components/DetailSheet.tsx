"use client";

import { useEffect, useState } from "react";
import { GradeChip, PrecedenceChip, TagChips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { MediaFrame } from "@/components/MediaFrame";
import { dtg } from "@/lib/dtg";
import type { ArticleDTO, BriefStoryDTO } from "@/lib/serializers";
import { isLlmImplicationSource } from "@/lib/serializers";

type DetailSheetProps = {
  story: BriefStoryDTO | null;
  article: ArticleDTO | null;
  relatedArticles: ArticleDTO[];
  onClose: () => void;
  onOpenArticle: (article: ArticleDTO) => void;
  onImplicationUpdated?: (
    articleId: string,
    implication: string,
    implicationSource: string,
  ) => void;
  /**
   * overlay — bottom sheet over the globe.
   * pane — fills its layout slot (cover and inner).
   */
  variant?: "overlay" | "pane" | "screen";
};

export function DetailSheet({
  story,
  article,
  relatedArticles,
  onClose,
  onOpenArticle,
  onImplicationUpdated,
  variant = "overlay",
}: DetailSheetProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [implicationBusy, setImplicationBusy] = useState(false);
  const [implicationError, setImplicationError] = useState<string | null>(null);

  useEffect(() => {
    setActiveImage(0);
    setImplicationBusy(false);
    setImplicationError(null);
  }, [article?.id, story?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function askWhyItMatters() {
    if (!article || implicationBusy) return;
    setImplicationBusy(true);
    setImplicationError(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/implication`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        implication?: string | null;
        implicationSource?: string | null;
        error?: string;
      };
      if (!res.ok || !data.implication) {
        throw new Error(data.error ?? "The local model could not rewrite this line.");
      }
      onImplicationUpdated?.(article.id, data.implication, data.implicationSource ?? "llm");
    } catch (error) {
      setImplicationError(error instanceof Error ? error.message : String(error));
    } finally {
      setImplicationBusy(false);
    }
  }

  if (!story && !article) return null;

  const isArticle = Boolean(article);
  const title = article?.title ?? story?.headline ?? "";
  const images = article?.images?.length
    ? article.images
    : article?.imageUrl
      ? [article.imageUrl]
      : story?.imageUrl
        ? [story.imageUrl]
        : [];
  const place = article?.placeLabel ?? story?.placeLabel ?? null;
  const tags = article?.tags ?? story?.tags ?? [];
  const precedence = article?.precedence ?? story?.precedence ?? "ROUTINE";

  const sources = story?.sources ?? [];
  const related = relatedArticles.length > 0 ? relatedArticles : [];
  const filling = variant === "pane" || variant === "screen";

  const shellClass =
    variant === "screen"
      ? "fixed inset-0 z-[110] flex flex-col overflow-hidden"
      : variant === "pane"
        ? "md-pane flex h-full min-h-0 flex-col overflow-hidden"
        : "md-sheet absolute inset-2 z-40 flex flex-col overflow-hidden rounded-3xl lg:inset-x-3 lg:bottom-3 lg:top-auto lg:max-h-[74%]";

  return (
    <div
      className={shellClass}
      style={{
        background: "var(--md-container)",
        boxShadow: variant === "pane" ? "var(--elev-2)" : "var(--elev-5)",
        paddingTop: variant === "screen" ? "env(safe-area-inset-top)" : undefined,
        paddingBottom: variant === "screen" ? "env(safe-area-inset-bottom)" : undefined,
      }}
      role="dialog"
      aria-modal={variant !== "overlay"}
      aria-label="Report detail"
    >
      <div
        className="flex items-start gap-2 px-3 pb-2 pt-3 sm:gap-3 sm:px-4"
        style={{ background: "var(--md-container-high)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <PrecedenceChip precedence={precedence} dense />
            {article && (
              <>
                <span className="md-label-sm md-mono text-[var(--md-secondary)]">
                  {article.sourceName}
                </span>
                <GradeChip grade={article.sourceGrade} />
                <span className="md-label-sm md-mono">
                  {article.publishedAt ? dtg(new Date(article.publishedAt)) : "DTG unknown"}
                </span>
                <span className="md-label-sm md-mono">{article.ref}</span>
              </>
            )}
            {!isArticle && <span className="md-label-sm">Daily brief item</span>}
          </div>
          <h2 className="md-headline pr-4 text-[var(--md-on-surface)]">{title}</h2>
          {place && (
            <div className="md-label-sm mt-1 flex items-center gap-1">
              <Icon name="place" size={13} />
              {place}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={
            filling
              ? "md-detail-body mx-auto grid max-w-[1180px] gap-5 p-4 sm:p-6"
              : "md-detail-body grid gap-4 p-3 sm:p-4"
          }
        >
          <div className="min-w-0 space-y-2">
            <MediaFrame
              src={images[Math.min(activeImage, Math.max(images.length - 1, 0))] ?? null}
              ratio="16 / 9"
              className="w-full rounded-2xl"
              iconSize={28}
              emptyLabel="No imagery captured"
            />

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className="shrink-0 rounded-xl transition"
                    style={{
                      width: 80,
                      outline:
                        i === activeImage ? "2px solid var(--md-primary)" : "1px solid var(--md-outline-variant)",
                      outlineOffset: -1,
                      opacity: i === activeImage ? 1 : 0.66,
                    }}
                    aria-label={`Image ${i + 1}`}
                  >
                    <MediaFrame src={src} className="w-full rounded-xl" />
                  </button>
                ))}
              </div>
            )}

            {article && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="md-btn-filled w-full justify-center"
              >
                <Icon name="open" size={18} />
                Read original article
              </a>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <TagChips tags={tags} max={6} />
            </div>

            {story && (
              <section className="space-y-2">
                <h3 className="md-label">Assessment</h3>
                {story.paragraphs.map((p, i) => (
                  <p key={i} className="md-body text-[13.5px] leading-relaxed">
                    {p}
                  </p>
                ))}
              </section>
            )}

            {article && (
              <>
                <section className="space-y-2">
                  <h3 className="md-label">Summary</h3>
                  <p className="md-body text-[13.5px] leading-relaxed text-[var(--md-on-surface)]">
                    {article.analysis ?? article.summary ?? "No summary captured from source."}
                  </p>
                </section>

                <section
                  className="rounded-2xl p-3"
                  style={{
                    background: "var(--md-primary-container)",
                    color: "var(--md-on-primary-container)",
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3
                      className="md-label flex items-center gap-1.5"
                      style={{ color: "var(--md-on-primary-container)" }}
                    >
                      <Icon name="insights" size={15} />
                      Why it matters
                    </h3>
                    <button
                      type="button"
                      className="md-icon-btn md-icon-btn-sm"
                      style={{ color: "inherit" }}
                      disabled={implicationBusy}
                      onClick={() => void askWhyItMatters()}
                      aria-label="Ask the local LLM why this matters"
                      title="Ask the local LLM why this matters"
                    >
                      <Icon
                        name={implicationBusy ? "refresh" : "spark"}
                        size={16}
                        className={implicationBusy ? "md-spin" : undefined}
                      />
                    </button>
                  </div>
                  {implicationError && (
                    <p className="mb-2 text-[12px] leading-snug">{implicationError}</p>
                  )}
                  {article.implication ? (
                    <p className="text-[13px] leading-relaxed">{article.implication}</p>
                  ) : (
                    <p className="text-[13px] leading-relaxed opacity-80">
                      {implicationBusy
                        ? "Asking the local model…"
                        : "No line yet. Ask the local model, or the tags may be too thin."}
                    </p>
                  )}
                  <p className="mt-2 text-[10.5px] opacity-75">
                    {isLlmImplicationSource(article.implicationSource)
                      ? implicationSourceLabel(article.implicationSource)
                      : `Derived from rules-based classification \u00b7 confidence ${article.confidence}%`}
                  </p>
                </section>

                {article.summary && article.summary !== article.analysis && (
                  <section className="space-y-1.5">
                    <h3 className="md-label">Source excerpt</h3>
                    <p className="md-body text-[12.5px] leading-relaxed">{article.summary}</p>
                  </section>
                )}
              </>
            )}

            {(related.length > 0 || sources.length > 0) && (
              <section className="space-y-2">
                <h3 className="md-label">
                  {`Sources (${Math.max(related.length, sources.length)})`}
                </h3>
                <div className="space-y-1">
                  {related.length > 0
                    ? related.map((a) => (
                        <div
                          key={a.id}
                          className="md-state md-list-item items-center"
                          style={{ background: "var(--md-container-low)" }}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenArticle(a)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <MediaFrame src={a.imageUrl} className="w-16 rounded-lg" />
                            <div className="min-w-0">
                              <div className="md-title line-clamp-1 text-[13px]">{a.title}</div>
                              <div className="md-label-sm md-mono">{a.sourceName}</div>
                            </div>
                          </button>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="md-icon-btn shrink-0"
                            aria-label="Open original"
                          >
                            <Icon name="open" size={17} />
                          </a>
                        </div>
                      ))
                    : sources.map((a) => (
                        <div
                          key={a.id}
                          className="md-list-item items-center"
                          style={{ background: "var(--md-container-low)" }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="md-title line-clamp-1 text-[13px]">{a.title}</div>
                            <div className="md-label-sm md-mono">
                              {`${a.sourceName}${a.placeLabel ? ` · ${a.placeLabel}` : ""}`}
                            </div>
                          </div>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="md-icon-btn shrink-0"
                            aria-label="Open original"
                          >
                            <Icon name="open" size={17} />
                          </a>
                        </div>
                      ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function implicationSourceLabel(source: string | null): string {
  if (!source || source === "rules") return "Local LLM";
  const model = source.includes(":") ? source.slice(source.indexOf(":") + 1) : source;
  return model ? `Local LLM \u00b7 ${model}` : "Local LLM";
}
