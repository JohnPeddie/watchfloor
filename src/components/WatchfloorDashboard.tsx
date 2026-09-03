"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FEEDS } from "../../config/feeds";
import { AppBar } from "@/components/AppBar";
import { LaneChips, NavRail } from "@/components/NavRail";
import { BottomNav, type PaneId } from "@/components/BottomNav";
import { BriefPane } from "@/components/BriefPane";
import { TrafficPane } from "@/components/TrafficPane";
import { InsightPane } from "@/components/InsightPane";
import { DetailSheet } from "@/components/DetailSheet";
import { Icon } from "@/components/Icon";
import { useIsCompact } from "@/lib/use-media";
import { useCollapsingHeader } from "@/lib/use-collapsing-header";
import type { MarketQuote } from "@/lib/markets";
import type {
  ArticleDTO,
  BriefDTO,
  BriefStoryDTO,
  GlobePin,
  SummarizerStatus,
} from "@/lib/serializers";

const GlobeView = dynamic(
  () => import("@/components/GlobeView").then((m) => m.GlobeView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <span className="md-label-sm">Loading geospatial plot…</span>
      </div>
    ),
  },
);

export function WatchfloorDashboard() {
  const [brief, setBrief] = useState<BriefDTO | null>(null);
  const [articles, setArticles] = useState<ArticleDTO[]>([]);
  const [allArticles, setAllArticles] = useState<ArticleDTO[]>([]);
  const [markets, setMarkets] = useState<MarketQuote[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [precedenceCounts, setPrecedenceCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [matched, setMatched] = useState(0);
  const [lastIngestAt, setLastIngestAt] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedStory, setSelectedStory] = useState<BriefStoryDTO | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDTO | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [showImagery, setShowImagery] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [pane, setPane] = useState<PaneId>("brief");
  const [summarizer, setSummarizer] = useState<SummarizerStatus | null>(null);
  const isCompact = useIsCompact();

  const loadFiltered = useCallback(async () => {
    const params = new URLSearchParams({ limit: "150" });
    if (activeTag) params.set("tag", activeTag);
    if (query.trim()) params.set("q", query.trim());
    const res = await fetch(`/api/articles?${params.toString()}`).then((r) => r.json());
    setArticles(res.articles ?? []);
    setTotal(res.total ?? 0);
    setMatched(res.matched ?? 0);
    setTagCounts(res.tagCounts ?? {});
    setPrecedenceCounts(res.precedenceCounts ?? {});
    setLastIngestAt(res.lastIngestAt ?? null);
  }, [activeTag, query]);

  const loadBase = useCallback(async () => {
    const [briefRes, allRes, marketsRes, summarizerRes] = await Promise.all([
      fetch("/api/brief").then((r) => r.json()),
      fetch("/api/articles?limit=200").then((r) => r.json()),
      fetch("/api/markets").then((r) => r.json()),
      // Non-critical: a failed probe should not blank the dashboard.
      fetch("/api/summarizer")
        .then((r) => r.json())
        .catch(() => null),
    ]);
    setBrief(briefRes.brief ?? null);
    setAllArticles(allRes.articles ?? []);
    setMarkets(marketsRes.markets ?? []);
    setSummarizer(summarizerRes ?? null);
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    const id = setTimeout(() => void loadFiltered(), query ? 250 : 0);
    return () => clearTimeout(id);
  }, [loadFiltered, query]);

  const pins: GlobePin[] = useMemo(() => {
    const storyPins: GlobePin[] =
      brief?.stories
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          id: `story:${s.id}`,
          kind: "story" as const,
          label: s.headline,
          lat: s.lat as number,
          lng: s.lng as number,
          placeLabel: s.placeLabel,
          precedence: s.precedence,
          imageUrl: s.imageUrl,
        })) ?? [];

    const articlePins: GlobePin[] = articles
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => ({
        id: `article:${a.id}`,
        kind: "article" as const,
        label: a.title,
        lat: a.lat as number,
        lng: a.lng as number,
        placeLabel: a.placeLabel,
        precedence: a.precedence,
        imageUrl: a.imageUrl,
      }));

    return [...storyPins, ...articlePins];
  }, [brief, articles]);

  const relatedArticles = useMemo(() => {
    if (!selectedStory) return [];
    if (selectedStory.relatedArticleIds.length > 0) {
      return allArticles.filter((a) => selectedStory.relatedArticleIds.includes(a.id));
    }
    const place = selectedStory.placeLabel?.toLowerCase();
    const words = selectedStory.headline
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4);
    const storyTags = new Set(selectedStory.tags);
    return allArticles
      .map((a) => {
        let score = 0;
        if (place && a.placeLabel?.toLowerCase() === place) score += 5;
        const hay = `${a.title} ${a.summary ?? ""}`.toLowerCase();
        score += words.filter((w) => hay.includes(w)).length * 2;
        score += a.tags.filter((t) => storyTags.has(t)).length;
        return { a, score };
      })
      .filter((x) => x.score >= 3)
      .sort((x, y) => y.score - x.score)
      .slice(0, 6)
      .map((x) => x.a);
  }, [selectedStory, allArticles]);

  const feedStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of allArticles) {
      counts.set(a.sourceCode, (counts.get(a.sourceCode) ?? 0) + 1);
    }
    return FEEDS.map((f) => ({
      code: f.code,
      name: f.name,
      count: counts.get(f.code) ?? 0,
      online: (counts.get(f.code) ?? 0) > 0,
    }));
  }, [allArticles]);

  const selectedPinId = selectedArticle
    ? `article:${selectedArticle.id}`
    : selectedStory
      ? `story:${selectedStory.id}`
      : null;

  function flyTo(lat: number | null | undefined, lng: number | null | undefined) {
    if (lat == null || lng == null) return;
    setFocus({ lat, lng });
  }

  // On compact layouts the detail sheet sits over the globe, so opening a
  // report has to bring the map pane forward or the sheet would be off-screen.
  function revealDetail() {
    if (isCompact) setPane("map");
  }

  function onSelectStory(story: BriefStoryDTO) {
    setSelectedStory(story);
    setSelectedArticle(null);
    flyTo(story.lat, story.lng);
    revealDetail();
  }

  function onSelectArticle(article: ArticleDTO) {
    setSelectedArticle(article);
    setSelectedStory(null);
    flyTo(article.lat, article.lng);
    revealDetail();
  }

  function onSelectPin(pin: GlobePin) {
    if (pin.kind === "story") {
      const story = brief?.stories.find((s) => s.id === pin.id.replace("story:", ""));
      if (story) onSelectStory(story);
      return;
    }
    const id = pin.id.replace("article:", "");
    const article = articles.find((a) => a.id === id) ?? allArticles.find((a) => a.id === id);
    if (article) onSelectArticle(article);
  }

  async function onIngest() {
    setIngesting(true);
    try {
      await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fetchImages: true, maxPerFeed: 8 }),
      });
      await Promise.all([loadBase(), loadFiltered()]);
    } finally {
      setIngesting(false);
    }
  }

  const plottedImages = pins.filter((p) => p.imageUrl).length;

  const { headerRef, hostRef, offset, hidden: headerHidden } = useCollapsingHeader(
    isCompact,
    pane,
  );

  /**
   * Below `md` only the selected pane is mounted, so the phone shows one thing
   * at a time. From `md` up every pane is visible and CSS grid placement takes
   * over: reporting on the left and the globe on the right for tablets, then a
   * third analysis column on desktop.
   */
  function paneClass(id: PaneId, placement: string): string {
    const visibility = pane === id ? "block" : "hidden";
    return `min-h-0 ${visibility} md:block ${placement}`;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div
        ref={headerRef}
        className="shrink-0 transition-[margin] duration-200 ease-out"
        style={{ marginTop: offset }}
        inert={headerHidden}
      >
        <AppBar
          query={query}
          onQueryChange={setQuery}
          onIngest={onIngest}
          ingesting={ingesting}
          lastIngestAt={lastIngestAt}
          total={total}
          flashCount={precedenceCounts.FLASH ?? 0}
        />

        <LaneChips activeTag={activeTag} onSelectTag={setActiveTag} counts={tagCounts} />
      </div>

      <div ref={hostRef} className="flex min-h-0 flex-1">
        <NavRail activeTag={activeTag} onSelectTag={setActiveTag} counts={tagCounts} />

        <main
          className="grid min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 md:grid-cols-2 md:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,336px)]"
        >
          <div
            className={paneClass(
              "brief",
              "md:col-start-1 md:row-start-1 xl:row-span-2 xl:row-start-1",
            )}
          >
            <BriefPane
              brief={brief}
              selectedStoryId={selectedStory?.id ?? null}
              onSelectStory={onSelectStory}
            />
          </div>

          <div
            className={paneClass(
              "map",
              "relative md:col-start-2 md:row-start-1 xl:col-start-2 xl:row-start-1",
            )}
          >
            <section className="md-pane relative h-full min-h-0 overflow-hidden">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(11,14,17,0.92) 0%, rgba(11,14,17,0.66) 55%, rgba(11,14,17,0) 100%)",
                }}
              >
                <div className="min-w-0">
                  <div className="md-title-lg">Geospatial plot</div>
                  <div className="md-label-sm truncate">
                    {`${pins.length} contacts · ${plottedImages} with imagery · live day/night`}
                  </div>
                </div>
                <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    className="md-chip md-chip-filter"
                    aria-pressed={showImagery}
                    onClick={() => setShowImagery((v) => !v)}
                  >
                    <Icon name="layers" size={13} />
                    <span className="hidden sm:inline">Imagery</span>
                  </button>
                  <button
                    type="button"
                    className="md-chip md-chip-filter"
                    aria-pressed={showBoundaries}
                    onClick={() => setShowBoundaries((v) => !v)}
                  >
                    <Icon name="public" size={13} />
                    <span className="hidden sm:inline">Borders</span>
                  </button>
                  {focus && (
                    <button
                      type="button"
                      className="md-chip md-chip-filter"
                      onClick={() => setFocus(null)}
                    >
                      <Icon name="public" size={13} />
                      <span className="hidden sm:inline">Reset view</span>
                    </button>
                  )}
                </div>
              </div>

              <GlobeView
                pins={pins}
                focus={focus}
                selectedId={selectedPinId}
                onSelectPin={onSelectPin}
                showImagery={showImagery}
                showBoundaries={showBoundaries}
              />

              <DetailSheet
                story={selectedArticle ? null : selectedStory}
                article={selectedArticle}
                relatedArticles={selectedArticle ? [] : relatedArticles}
                onClose={() => {
                  setSelectedStory(null);
                  setSelectedArticle(null);
                }}
                onOpenArticle={onSelectArticle}
              />
            </section>
          </div>

          <div
            className={paneClass(
              "traffic",
              "md:col-start-1 md:row-start-2 xl:col-start-2 xl:row-start-2",
            )}
          >
            <TrafficPane
              articles={articles}
              matched={matched}
              total={total}
              selectedArticleId={selectedArticle?.id ?? null}
              onSelectArticle={onSelectArticle}
              activeTag={activeTag}
            />
          </div>

          <div
            className={paneClass(
              "insight",
              "md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-span-2 xl:row-start-1",
            )}
          >
            <InsightPane
              markets={markets}
              tagCounts={tagCounts}
              activeTag={activeTag}
              onSelectTag={setActiveTag}
              precedenceCounts={precedenceCounts}
              feedStatus={feedStatus}
              summarizer={summarizer}
            />
          </div>
        </main>
      </div>

      <BottomNav
        active={pane}
        onChange={setPane}
        flashCount={precedenceCounts.FLASH ?? 0}
      />
    </div>
  );
}
