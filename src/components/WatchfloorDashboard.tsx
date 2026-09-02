"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FEEDS } from "../../config/feeds";
import { AppBar } from "@/components/AppBar";
import { NavRail } from "@/components/NavRail";
import { BriefPane } from "@/components/BriefPane";
import { TrafficPane } from "@/components/TrafficPane";
import { InsightPane } from "@/components/InsightPane";
import { DetailSheet } from "@/components/DetailSheet";
import { Icon } from "@/components/Icon";
import type { MarketQuote } from "@/lib/markets";
import type {
  ArticleDTO,
  BriefDTO,
  BriefStoryDTO,
  GlobePin,
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
    const [briefRes, allRes, marketsRes] = await Promise.all([
      fetch("/api/brief").then((r) => r.json()),
      fetch("/api/articles?limit=200").then((r) => r.json()),
      fetch("/api/markets").then((r) => r.json()),
    ]);
    setBrief(briefRes.brief ?? null);
    setAllArticles(allRes.articles ?? []);
    setMarkets(marketsRes.markets ?? []);
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

  function onSelectStory(story: BriefStoryDTO) {
    setSelectedStory(story);
    setSelectedArticle(null);
    flyTo(story.lat, story.lng);
  }

  function onSelectArticle(article: ArticleDTO) {
    setSelectedArticle(article);
    setSelectedStory(null);
    flyTo(article.lat, article.lng);
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppBar
        query={query}
        onQueryChange={setQuery}
        onIngest={onIngest}
        ingesting={ingesting}
        lastIngestAt={lastIngestAt}
        total={total}
        flashCount={precedenceCounts.FLASH ?? 0}
      />

      <div className="flex min-h-0 flex-1">
        <NavRail activeTag={activeTag} onSelectTag={setActiveTag} counts={tagCounts} />

        <main className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,336px)]">
          <div className="min-h-0">
            <BriefPane
              brief={brief}
              selectedStoryId={selectedStory?.id ?? null}
              onSelectStory={onSelectStory}
            />
          </div>

          <div className="grid min-h-0 grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
            <section className="md-pane relative min-h-0 overflow-hidden">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(11,14,17,0.92) 0%, rgba(11,14,17,0.66) 55%, rgba(11,14,17,0) 100%)",
                }}
              >
                <div>
                  <div className="md-title-lg">Geospatial plot</div>
                  <div className="md-label-sm">
                    {`${pins.length} contacts · ${plottedImages} with imagery · live day/night`}
                  </div>
                </div>
                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="md-chip md-chip-filter"
                    aria-pressed={showImagery}
                    onClick={() => setShowImagery((v) => !v)}
                  >
                    <Icon name="layers" size={13} />
                    Imagery
                  </button>
                  <button
                    type="button"
                    className="md-chip md-chip-filter"
                    aria-pressed={showBoundaries}
                    onClick={() => setShowBoundaries((v) => !v)}
                  >
                    <Icon name="public" size={13} />
                    Borders
                  </button>
                  {focus && (
                    <button
                      type="button"
                      className="md-chip md-chip-filter"
                      onClick={() => setFocus(null)}
                    >
                      <Icon name="public" size={13} />
                      Reset view
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

            <TrafficPane
              articles={articles}
              matched={matched}
              total={total}
              selectedArticleId={selectedArticle?.id ?? null}
              onSelectArticle={onSelectArticle}
              activeTag={activeTag}
            />
          </div>

          <div className="min-h-0">
            <InsightPane
              markets={markets}
              tagCounts={tagCounts}
              activeTag={activeTag}
              onSelectTag={setActiveTag}
              precedenceCounts={precedenceCounts}
              feedStatus={feedStatus}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
