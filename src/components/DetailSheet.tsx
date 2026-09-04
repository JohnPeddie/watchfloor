"use client";

import { useEffect, useState } from "react";
import { GradeChip, PrecedenceChip, TagChips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { dtg } from "@/lib/dtg";
import type { ArticleDTO, BriefStoryDTO } from "@/lib/serializers";

type DetailSheetProps = {
  story: BriefStoryDTO | null;
  article: ArticleDTO | null;
  relatedArticles: ArticleDTO[];
  onClose: () => void;
  onOpenArticle: (article: ArticleDTO) => void;
};

export function DetailSheet({
  story,
  article,
  relatedArticles,
  onClose,
  onOpenArticle,
}: DetailSheetProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [maximised, setMaximised] = useState(false);

  useEffect(() => {
    setActiveImage(0);
  }, [article?.id, story?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape backs out one step: leave full screen first, then close.
      if (maximised) setMaximised(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, maximised]);

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

  return (
    <div
      /* Docked: near full-height on phones so the report is readable, and a
         bottom sheet over the globe from `lg` up where the map stays useful
         alongside. Maximised: fixed to the viewport so it escapes the pane
         that would otherwise clip it. */
      className={
        maximised
          ? "md-sheet fixed inset-0 z-[110] flex flex-col overflow-hidden"
          : "md-sheet absolute inset-2 z-40 flex flex-col overflow-hidden rounded-3xl lg:inset-x-3 lg:bottom-3 lg:top-auto lg:max-h-[74%]"
      }
      style={{ background: "var(--md-container)", boxShadow: "var(--elev-5)" }}
      role="dialog"
      aria-modal={maximised}
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
          <button
            type="button"
            className="md-icon-btn"
            onClick={() => setMaximised((v) => !v)}
            aria-label={maximised ? "Exit full screen" : "Open full screen"}
            title={maximised ? "Exit full screen" : "Open full screen"}
          >
            <Icon name={maximised ? "fullscreen_exit" : "fullscreen"} size={19} />
          </button>
          <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          /* Full screen earns the two-column split sooner, and caps the line
             length so the assessment stays readable on a wide monitor. */
          className={
            maximised
              ? "mx-auto grid max-w-[1180px] gap-5 p-4 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] sm:p-6"
              : "grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]"
          }
        >
          <div className="space-y-2">
            <div
              className="aspect-video w-full overflow-hidden rounded-2xl"
              style={{ background: "var(--md-container-high)" }}
            >
              {images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[Math.min(activeImage, images.length - 1)]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--md-outline)]">
                  <Icon name="article" size={28} />
                  <span className="md-label-sm">No imagery captured</span>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className="h-14 w-20 shrink-0 overflow-hidden rounded-xl transition"
                    style={{
                      outline:
                        i === activeImage ? "2px solid var(--md-primary)" : "1px solid var(--md-outline-variant)",
                      outlineOffset: -1,
                      opacity: i === activeImage ? 1 : 0.66,
                    }}
                    aria-label={`Image ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
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

          <div className="space-y-4">
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

                {article.implication && (
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
                      Why it matters
                    </h3>
                    <p className="text-[13px] leading-relaxed">{article.implication}</p>
                    <p className="mt-2 text-[10.5px] opacity-75">
                      Derived from rules-based classification &middot; confidence{" "}
                      {article.confidence}%
                    </p>
                  </section>
                )}

                {article.summary && article.summary !== article.analysis && (
                  <section className="space-y-1.5">
                    <h3 className="md-label">Source excerpt</h3>
                    <p className="md-body text-[12.5px] leading-relaxed">{article.summary}</p>
                  </section>
                )}
              </>
            )}

            {relatedArticles.length > 0 && (
              <section className="space-y-2">
                <h3 className="md-label">Related reporting</h3>
                <div className="space-y-1">
                  {relatedArticles.map((a) => (
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
                        <div
                          className="h-10 w-14 shrink-0 overflow-hidden rounded-lg"
                          style={{ background: "var(--md-container-high)" }}
                        >
                          {a.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
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
