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
import { HelpButton } from "@/components/HelpButton";
import { MinimisedPane, PaneSizeButton } from "@/components/PaneChrome";
import { Icon } from "@/components/Icon";
import { useIsCompact, useIsTablet } from "@/lib/use-media";
import { buildSourceWeb } from "@/lib/source-web";
import type { MarketQuote } from "@/lib/markets";
import type {
  ArticleDTO,
  BriefDTO,
  BriefStoryDTO,
  GlobeLink,
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
  const [focus, setFocus] = useState<{ lat: number; lng: number; altitude?: number } | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [showImagery, setShowImagery] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [pane, setPane] = useState<PaneId>("brief");
  const [summarizer, setSummarizer] = useState<SummarizerStatus | null>(null);
  // Collapsed panes on tablet and desktop; full-bleed pane on a phone.
  const [minimised, setMinimised] = useState({ map: false, traffic: false });
  const [immersive, setImmersive] = useState(false);
  const [detailMaximised, setDetailMaximised] = useState(false);
  const isCompact = useIsCompact();
  const isTablet = useIsTablet();

  // Full-bleed only makes sense while one pane owns the screen.
  useEffect(() => {
    if (!isCompact) setImmersive(false);
  }, [isCompact]);

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

  const relatedArticles = useMemo(() => {
    if (!selectedStory) return [];
    const ids = new Set(
      selectedStory.sources.length > 0
        ? selectedStory.sources.map((s) => s.id)
        : selectedStory.relatedArticleIds,
    );
    if (ids.size === 0) return [];
    return allArticles.filter((a) => ids.has(a.id));
  }, [selectedStory, allArticles]);

  /**
   * Selected brief item: one hub at the subject, then a spoke per source so
   * the globe shows both where the story is and where the reporting came from.
   */
  const sourceWeb = useMemo(
    () => (selectedStory ? buildSourceWeb(selectedStory) : null),
    [selectedStory],
  );

  const globePins: GlobePin[] = useMemo(() => {
    if (sourceWeb && sourceWeb.links.length > 0) {
      return sourceWeb.pins;
    }

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
  }, [brief, articles, sourceWeb]);

  const globeLinks: GlobeLink[] = sourceWeb?.links ?? [];

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

  const reading = Boolean(selectedStory || selectedArticle);

  function flyTo(
    lat: number | null | undefined,
    lng: number | null | undefined,
    altitude = 1.5,
  ) {
    if (lat == null || lng == null) return;
    setFocus({ lat, lng, altitude });
  }

  function closeDetail() {
    setSelectedStory(null);
    setSelectedArticle(null);
    setDetailMaximised(false);
  }

  /**
   * The assessment takes the reporting-stream slot so the globe stays on
   * screen with the source web. The globe is restored if it had been minimised.
   */
  function onSelectStory(story: BriefStoryDTO) {
    setSelectedStory(story);
    setSelectedArticle(null);
    setDetailMaximised(false);
    const web = buildSourceWeb(story);
    if (web.hub) flyTo(web.hub.lat, web.hub.lng, 2.35);
    else flyTo(story.lat, story.lng, 2.35);
    setMinimised((m) => (m.map ? { ...m, map: false } : m));
    if (isCompact) setPane("map");
  }

  function onSelectArticle(article: ArticleDTO) {
    setSelectedArticle(article);
    setSelectedStory(null);
    setDetailMaximised(false);
    flyTo(article.lat, article.lng);
    setMinimised((m) => (m.map ? { ...m, map: false } : m));
  }

  function onSelectPin(pin: GlobePin) {
    if (pin.kind === "story") {
      const story = brief?.stories.find((s) => s.id === pin.id.replace("story:", ""));
      if (story) onSelectStory(story);
      return;
    }
    const articleId = pin.articleId ?? pin.id.replace(/^article:/, "").replace(/^source:[^:]+:/, "");
    const article =
      articles.find((a) => a.id === articleId) ?? allArticles.find((a) => a.id === articleId);
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

  const plottedImages = globePins.filter((p) => p.imageUrl).length;
  const globeCaption =
    globeLinks.length > 0
      ? `${globeLinks.length} sources feeding ${selectedStory?.placeLabel ?? "this item"}`
      : `${globePins.length} contacts · ${plottedImages} with imagery · live day/night`;

  /** A column child either shares the space or shrinks to its own height. */
  const fill = (collapsed: boolean) =>
    collapsed ? "shrink-0" : "min-h-0 flex-1";

  const briefPane = (
    <BriefPane
      brief={brief}
      selectedStoryId={selectedStory?.id ?? null}
      onSelectStory={onSelectStory}
    />
  );

  const trafficPane =
    minimised.traffic && !isCompact && !reading ? (
      <MinimisedPane
        title="Reporting stream"
        detail={`${matched} items`}
        onRestore={() => setMinimised((m) => ({ ...m, traffic: false }))}
      />
    ) : (
      <TrafficPane
        articles={articles}
        matched={matched}
        total={total}
        selectedArticleId={selectedArticle?.id ?? null}
        onSelectArticle={onSelectArticle}
        activeTag={activeTag}
        actions={
          <PaneSizeButton
            compact={isCompact}
            active={immersive}
            label="reporting stream"
            onToggle={() =>
              isCompact
                ? setImmersive((v) => !v)
                : setMinimised((m) => ({ ...m, traffic: true }))
            }
          />
        }
      />
    );

  const mapPane =
    minimised.map && !isCompact ? (
      <MinimisedPane
        title="Geospatial plot"
        detail={`${globePins.length} contacts`}
        onRestore={() => setMinimised((m) => ({ ...m, map: false }))}
      />
    ) : (
      <section className="md-pane relative h-full min-h-0 overflow-hidden">
        <div
          className="on-globe pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,14,17,0.92) 0%, rgba(11,14,17,0.66) 55%, rgba(11,14,17,0) 100%)",
          }}
        >
          <div className="min-w-0">
            <div className="md-title-lg">Geospatial plot</div>
            <div className="md-label-sm truncate">{globeCaption}</div>
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
            <HelpButton topic="globe" />
            <PaneSizeButton
              compact={isCompact}
              active={immersive}
              label="globe"
              onToggle={() =>
                isCompact
                  ? setImmersive((v) => !v)
                  : setMinimised((m) => ({ ...m, map: true }))
              }
            />
          </div>
        </div>

        <GlobeView
          pins={globePins}
          links={globeLinks}
          focus={focus}
          selectedId={selectedPinId}
          onSelectPin={onSelectPin}
          showImagery={showImagery && globeLinks.length === 0}
          showBoundaries={showBoundaries}
        />
      </section>
    );

  const reader = (
    <DetailSheet
      variant="pane"
      story={selectedArticle ? null : selectedStory}
      article={selectedArticle}
      relatedArticles={selectedArticle ? [] : relatedArticles}
      onClose={closeDetail}
      onOpenArticle={onSelectArticle}
      maximised={detailMaximised}
      onToggleMaximise={() => setDetailMaximised((v) => !v)}
    />
  );

  const belowGlobe = reading ? reader : trafficPane;

  const insightPane = (
    <InsightPane
      markets={markets}
      tagCounts={tagCounts}
      activeTag={activeTag}
      onSelectTag={setActiveTag}
      precedenceCounts={precedenceCounts}
      feedStatus={feedStatus}
      summarizer={summarizer}
    />
  );

  const panesById: Record<PaneId, React.ReactNode> = {
    brief: briefPane,
    map: mapPane,
    traffic: trafficPane,
    insight: insightPane,
  };

  const middle = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
      {reading && detailMaximised ? (
        <div className="min-h-0 flex-1">{reader}</div>
      ) : (
        <>
          <div className={fill(minimised.map)}>{mapPane}</div>
          <div className={fill(minimised.traffic && !reading)}>{belowGlobe}</div>
        </>
      )}
    </div>
  );

  /**
   * Each column is its own flex stack rather than a shared grid, so collapsing
   * one pane hands its space to the pane above or below it and leaves the
   * other column alone.
   */
  let layout: React.ReactNode;
  if (isCompact) {
    layout = reading ? (
      detailMaximised ? (
        <div className="min-h-0 flex-1">{reader}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="min-h-0 flex-[1.2]">{mapPane}</div>
          <div className="min-h-0 flex-1">{reader}</div>
        </div>
      )
    ) : (
      <div className="min-h-0 flex-1">{panesById[pane]}</div>
    );
  } else if (isTablet) {
    layout = (
      <div className="flex min-h-0 flex-1 gap-2 sm:gap-3">
        <div className="flex min-h-0 w-[min(42%,400px)] shrink-0 flex-col">
          {briefPane}
        </div>
        {middle}
      </div>
    );
  } else {
    layout = (
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-0 w-[320px] shrink-0">{briefPane}</div>
        {middle}
        <div className="min-h-0 w-[336px] shrink-0">{insightPane}</div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {!immersive && (
        <div className="shrink-0">
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
      )}

      <div className="flex min-h-0 flex-1">
        {!immersive && (
          <NavRail activeTag={activeTag} onSelectTag={setActiveTag} counts={tagCounts} />
        )}

        <main className="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-3">
          {layout}
        </main>
      </div>

      {!immersive && !reading && (
        <BottomNav
          active={pane}
          onChange={setPane}
          flashCount={precedenceCounts.FLASH ?? 0}
        />
      )}
    </div>
  );
}
