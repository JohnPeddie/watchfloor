import { prisma } from "./db";

export type MarketPoint = { t: string; v: number };

export type MarketQuote = {
  symbol: string;
  label: string;
  price: number;
  changePct: number | null;
  series: MarketPoint[];
  fetchedAt: string;
};

const SYMBOLS = [
  { symbol: "BZ=F", label: "Brent Crude", yahoo: "BZ=F" },
  { symbol: "CL=F", label: "WTI Crude", yahoo: "CL=F" },
  { symbol: "GBPUSD=X", label: "GBP/USD", yahoo: "GBPUSD=X" },
  { symbol: "^FTSE", label: "FTSE 100", yahoo: "^FTSE" },
] as const;

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

async function fetchYahooSeries(yahooSymbol: string): Promise<{
  series: MarketPoint[];
  price: number;
  changePct: number | null;
}> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?interval=1d&range=3mo`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "WATCHFLOOR/1.0",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo ${yahooSymbol}: HTTP ${res.status}`);
  const data = (await res.json()) as YahooChart;
  const result = data.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(`Yahoo ${yahooSymbol}: empty series`);

  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const series: MarketPoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = closes[i];
    if (close == null || Number.isNaN(close)) continue;
    const t = new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10);
    series.push({ t, v: close });
  }

  const price = result.meta?.regularMarketPrice ?? series.at(-1)?.v ?? 0;
  const prev =
    result.meta?.previousClose ??
    result.meta?.chartPreviousClose ??
    series.at(-2)?.v ??
    null;
  const changePct = prev && prev !== 0 ? ((price - prev) / prev) * 100 : null;
  return { series, price, changePct };
}

const CACHE_MS = 30 * 60 * 1000;

export async function getMarkets(force = false): Promise<MarketQuote[]> {
  const quotes: MarketQuote[] = [];

  for (const def of SYMBOLS) {
    const cached = await prisma.marketSnapshot.findUnique({
      where: { symbol: def.symbol },
    });
    const age = cached ? Date.now() - cached.fetchedAt.getTime() : Infinity;
    if (!force && cached && age < CACHE_MS && cached.price > 0) {
      quotes.push({
        symbol: cached.symbol,
        label: cached.label,
        price: cached.price,
        changePct: cached.changePct,
        series: JSON.parse(cached.seriesJson) as MarketPoint[],
        fetchedAt: cached.fetchedAt.toISOString(),
      });
      continue;
    }

    try {
      const { series, price, changePct } = await fetchYahooSeries(def.yahoo);
      const saved = await prisma.marketSnapshot.upsert({
        where: { symbol: def.symbol },
        create: {
          symbol: def.symbol,
          label: def.label,
          price,
          changePct,
          seriesJson: JSON.stringify(series),
          fetchedAt: new Date(),
        },
        update: {
          label: def.label,
          price,
          changePct,
          seriesJson: JSON.stringify(series),
          fetchedAt: new Date(),
        },
      });
      quotes.push({
        symbol: saved.symbol,
        label: saved.label,
        price: saved.price,
        changePct: saved.changePct,
        series,
        fetchedAt: saved.fetchedAt.toISOString(),
      });
    } catch {
      if (cached && cached.price > 0) {
        quotes.push({
          symbol: cached.symbol,
          label: cached.label,
          price: cached.price,
          changePct: cached.changePct,
          series: JSON.parse(cached.seriesJson) as MarketPoint[],
          fetchedAt: cached.fetchedAt.toISOString(),
        });
      } else {
        quotes.push({
          symbol: def.symbol,
          label: def.label,
          price: 0,
          changePct: null,
          series: [],
          fetchedAt: new Date().toISOString(),
        });
      }
    }
  }

  return quotes;
}
