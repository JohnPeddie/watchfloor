"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FEEDS } from "../../config/feeds";
import { AppBar } from "@/components/AppBar";
import { LaneChips, NavRail } from "@/components/NavRail";
import { BottomNav, type PaneId } from "@/components/BottomNav";
import { BriefPane } from "@/components/BriefPane";
import { TrafficPane } from "@/components/TrafficPane";
import { InsightPane } from "@/components/InsightPane";
import { DetailSheet } from "@/components/DetailSheet";
import { HelpButton } from "@/components/HelpButton";
import { Icon } from "@/components/Icon";
import { SettingsSheet } from "@/components/SettingsSheet";
import { useFloorKind, useIsShortInner } from "@/lib/use-media";
import { buildSourceWeb } from "@/lib/source-web";
import type { FloorView } from "@/lib/floor";
import type { MarketQuote } from "@/lib/markets";
import type { HazardsPayload } from "@/lib/hazard-geometry";
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
  const [hazards, setHazards] = useState<HazardsPayload>({
    warzones: [],
    storms: [],
    fetchedAt: "",
  });
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
  const [rebuilding, setRebuilding] = useState(false);
  const [showImagery, setShowImagery] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [pane, setPane] = useState<PaneId>("brief");
  const [view, setView] = useState<FloorView>("brief");
  const [summarizer, setSummarizer] = useState<SummarizerStatus | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const floor = useFloorKind();
  const shortInner = useIsShortInner();
  const isCompact = floor === "cover";
  const isInner = floor === "inner";
  const isDesktop = floor === "desktop";
  const denseChrome = isCompact || (isInner && shortInner);
  const llmOffline = Boolean(
    summarizer && summarizer.configured !== "rules" && summarizer.degraded,
  );

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
      fetch("/api/articles?limit=300").then((r) => r.json()),
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
    void fetch("/api/hazards")
      .then((r) => r.json())
      .then((hazardsRes) => {
        if (hazardsRes?.warzones || hazardsRes?.storms) {
          setHazards({
            warzones: hazardsRes.warzones ?? [],
            storms: hazardsRes.storms ?? [],
            fetchedAt: hazardsRes.fetchedAt ?? "",
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    const probe = () => {
      void fetch("/api/summarizer")
        .then((r) => r.json())
        .then((status) => setSummarizer(status))
        .catch(() => {
          setSummarizer((prev) =>
            prev && prev.configured !== "rules" ? { ...prev, degraded: true } : prev,
          );
        });
    };
    const id = window.setInterval(probe, 45_000);
    return () => window.clearInterval(id);
  }, []);

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
    if (selectedStory && sourceWeb && sourceWeb.links.length > 0) {
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

    if (isInner && view === "articles") return articlePins;
    if (isInner && view === "brief") return storyPins;
    return [...storyPins, ...articlePins];
  }, [brief, articles, sourceWeb, selectedStory, isInner, view]);

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
  }

  function changeView(next: FloorView) {
    setView(next);
    setPane(next);
    if (next === "markets") {
      setSelectedStory(null);
      setSelectedArticle(null);
    } else if (next === "brief") {
      setSelectedArticle(null);
    } else {
      setSelectedStory(null);
    }
  }

  function onSelectStory(story: BriefStoryDTO) {
    setSelectedStory(story);
    setSelectedArticle(null);
    setView("brief");
    setPane("brief");
    const web = buildSourceWeb(story);
    if (web.hub) flyTo(web.hub.lat, web.hub.lng, 2.35);
    else flyTo(story.lat, story.lng, 2.35);
  }

  function onSelectArticle(article: ArticleDTO) {
    setSelectedArticle(article);
    setSelectedStory(null);
    setView("articles");
    setPane("articles");
    flyTo(article.lat, article.lng);
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

  async function onRebuildBrief() {
    setRebuilding(true);
    try {
      await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto: true }),
      });
      await loadBase();
    } finally {
      setRebuilding(false);
    }
  }

  const plottedImages = globePins.filter((p) => p.imageUrl).length;
  const globeCaption =
    globeLinks.length > 0
      ? `${globeLinks.length} sources feeding ${selectedStory?.placeLabel ?? "this item"}`
      : `${globePins.length} contacts · ${plottedImages} with imagery · ${
          showHazards
            ? `${hazards.warzones.length} warzones · ${hazards.storms.length} storms · `
            : ""
        }live day/night`;

  const briefPane = (
    <BriefPane
      brief={brief}
      selectedStoryId={selectedStory?.id ?? null}
      onSelectStory={onSelectStory}
      rebuilding={rebuilding}
      onRebuild={onRebuildBrief}
    />
  );

  const trafficPane = (
    <TrafficPane
      articles={articles}
      matched={matched}
      total={total}
      selectedArticleId={selectedArticle?.id ?? null}
      onSelectArticle={onSelectArticle}
      activeTag={activeTag}
    />
  );

  const mapPane = (
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
            <span className="globe-chip-label">Imagery</span>
          </button>
          <button
            type="button"
            className="md-chip md-chip-filter"
            aria-pressed={showBoundaries}
            onClick={() => setShowBoundaries((v) => !v)}
          >
            <Icon name="public" size={13} />
            <span className="globe-chip-label">Borders</span>
          </button>
          <button
            type="button"
            className="md-chip md-chip-filter"
            aria-pressed={showHazards}
            onClick={() => setShowHazards((v) => !v)}
          >
            <Icon name="radar" size={13} />
            <span className="globe-chip-label">Hazards</span>
          </button>
          {focus && (
            <button
              type="button"
              className="md-chip md-chip-filter"
              onClick={() => setFocus(null)}
            >
              <Icon name="public" size={13} />
              <span className="globe-chip-label">Reset</span>
            </button>
          )}
          <HelpButton topic="globe" />
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
        showHazards={showHazards}
        hazards={hazards}
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
    />
  );

  const insightPane = (
    <InsightPane
      markets={markets}
      tagCounts={tagCounts}
      activeTag={activeTag}
      onSelectTag={setActiveTag}
      precedenceCounts={precedenceCounts}
      feedStatus={feedStatus}
      summarizer={summarizer}
      columns={isInner && view === "markets" ? 2 : 1}
    />
  );

  const listPane = view === "articles" ? trafficPane : briefPane;
  const readingThisView =
    (view === "brief" && Boolean(selectedStory)) ||
    (view === "articles" && Boolean(selectedArticle));

  function splitWithGlobe(list: ReactNode) {
    return (
      <div className={`flex min-h-0 flex-1 ${denseChrome ? "gap-1.5" : "gap-2 sm:gap-3"}`}>
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={{
            flex: "0 0 auto",
            width: readingThisView ? "min(60%, 560px)" : "min(52%, 440px)",
          }}
        >
          <StackSlot grow={1}>
            <KeepScrollSwap showFirst={!readingThisView} first={list} second={reader} />
          </StackSlot>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <StackSlot grow={1}>{mapPane}</StackSlot>
        </div>
      </div>
    );
  }

  /** Original PC shell: globe on top, stream (or the open item) underneath. */
  function pcMiddle() {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <StackSlot grow={1.35}>{mapPane}</StackSlot>
        <StackSlot grow={1}>
          <KeepScrollSwap showFirst={!reading} first={trafficPane} second={reader} />
        </StackSlot>
      </div>
    );
  }

  const panesById: Record<PaneId, ReactNode> = {
    brief: briefPane,
    articles: trafficPane,
    map: mapPane,
    markets: insightPane,
  };

  let layout: ReactNode;
  if (floor === "cover") {
    const coverReading = reading && (pane === "brief" || pane === "articles");
    layout = (
      <div className="relative min-h-0 flex-1">
        <KeepScrollSwap
          showFirst={!coverReading}
          first={panesById[pane]}
          second={reader}
        />
      </div>
    );
  } else if (floor === "inner") {
    layout =
      view === "markets" ? (
        <div className="min-h-0 flex-1">{insightPane}</div>
      ) : (
        splitWithGlobe(listPane)
      );
  } else if (floor === "laptop") {
    layout = (
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 w-[min(42%,400px)] shrink-0 flex-col">{briefPane}</div>
        {pcMiddle()}
      </div>
    );
  } else {
    layout = (
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-0 w-[320px] shrink-0">{briefPane}</div>
        {pcMiddle()}
        <div className="min-h-0 w-[336px] shrink-0 overflow-y-auto">{insightPane}</div>
      </div>
    );
  }

  const showLaneChips =
    floor === "laptop" || (floor === "inner" && view === "articles") || (floor === "cover" && pane === "articles" && !reading);

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden"
      data-floor={floor === "laptop" ? "desktop" : floor}
      data-short={shortInner ? "true" : undefined}
    >
      <div className="shrink-0">
        <AppBar
          query={query}
          onQueryChange={setQuery}
          onIngest={onIngest}
          ingesting={ingesting}
          lastIngestAt={lastIngestAt}
          total={total}
          flashCount={precedenceCounts.FLASH ?? 0}
          view={view}
          onViewChange={changeView}
          showViews={isInner}
          dense={denseChrome}
          llmOffline={llmOffline}
        />

        {llmOffline && (
          <div
            className={`leading-snug ${denseChrome ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"}`}
            role="status"
            style={{
              background: "var(--md-error-container)",
              color: "var(--md-error)",
            }}
          >
            {denseChrome
              ? "Local LLM summaries offline — briefs use rules until the workstation is back."
              : "Local LLM summaries are offline. Watchfloor still runs; daily briefs use the rules engine until LM Studio on the workstation is reachable."}
          </div>
        )}

        {showLaneChips && (
          <LaneChips activeTag={activeTag} onSelectTag={setActiveTag} counts={tagCounts} />
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {isDesktop && (
          <NavRail activeTag={activeTag} onSelectTag={setActiveTag} counts={tagCounts} />
        )}
        <main
          className={`flex min-h-0 flex-1 flex-col ${
            denseChrome ? "gap-1.5 p-1.5" : "gap-2 p-2 sm:gap-3 sm:p-3"
          }`}
          style={{
            paddingLeft: "max(0.4rem, env(safe-area-inset-left))",
            paddingRight: "max(0.4rem, env(safe-area-inset-right))",
          }}
        >
          {layout}
        </main>
      </div>

      {isCompact && (
        <BottomNav
          active={pane}
          onChange={(next) => {
            setPane(next);
            if (next === "markets") closeDetail();
            if (next !== "map") setView(next);
          }}
          flashCount={precedenceCounts.FLASH ?? 0}
        />
      )}

      {!(isCompact && reading && (pane === "brief" || pane === "articles")) && (
        <button
          type="button"
          className="md-icon-btn"
          style={{
            position: "fixed",
            left: "max(12px, env(safe-area-inset-left))",
            bottom: isCompact
              ? "calc(12px + 3.5rem + env(safe-area-inset-bottom))"
              : "max(12px, env(safe-area-inset-bottom))",
            zIndex: 80,
            width: 40,
            height: 40,
            background: "var(--md-container-high)",
            boxShadow: "var(--elev-3)",
            color: "var(--md-on-surface-variant)",
          }}
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" size={18} />
        </button>
      )}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/** Flex child that keeps pane overflow inside a tablet column. */
function StackSlot({ children, grow }: { children: ReactNode; grow: number }) {
  return (
    <div className="relative min-h-0 overflow-hidden" style={{ flex: `${grow} 1 0%` }}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

/**
 * Swaps to a reader without unmounting the list, so overflow-y scroll position
 * is still there when the item is closed.
 */
function KeepScrollSwap({
  showFirst,
  first,
  second,
}: {
  showFirst: boolean;
  first: ReactNode;
  second: ReactNode;
}) {
  return (
    <div className="relative h-full min-h-0">
      <div
        className="h-full min-h-0"
        style={
          showFirst
            ? undefined
            : { position: "absolute", inset: 0, visibility: "hidden", pointerEvents: "none" }
        }
        aria-hidden={!showFirst}
      >
        {first}
      </div>
      {!showFirst && <div className="absolute inset-0">{second}</div>}
    </div>
  );
}
