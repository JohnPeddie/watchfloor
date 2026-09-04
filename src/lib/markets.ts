import { prisma } from "./db";

export type MarketPoint = { t: string; v: number };

export type MarketKind = "energy" | "benchmark" | "sector";

export type MarketQuote = {
  symbol: string;
  label: string;
  kind: MarketKind;
  price: number;
  changePct: number | null;
  series: MarketPoint[];
  fetchedAt: string;
};

type SymbolDef = {
  symbol: string;
  label: string;
  yahoo: string;
  kind: MarketKind;
};

/**
 * Live quotes. Energy is front-month crude. Benchmarks are the index and FX
 * pair. Sectors are liquid ETFs used as proxies for the industries that show
 * up in the reporting — not a substitute for watching individual names.
 */
const SYMBOLS: SymbolDef[] = [
  { symbol: "BZ=F", label: "Brent Crude", yahoo: "BZ=F", kind: "energy" },
  { symbol: "CL=F", label: "WTI Crude", yahoo: "CL=F", kind: "energy" },
  { symbol: "GBPUSD=X", label: "GBP/USD", yahoo: "GBPUSD=X", kind: "benchmark" },
  { symbol: "^FTSE", label: "FTSE 100", yahoo: "^FTSE", kind: "benchmark" },
  { symbol: "XLK", label: "Tech", yahoo: "XLK", kind: "sector" },
  { symbol: "ITA", label: "Defence", yahoo: "ITA", kind: "sector" },
  { symbol: "XLE", label: "Oil & Gas", yahoo: "XLE", kind: "sector" },
  { symbol: "AIQ", label: "AI", yahoo: "AIQ", kind: "sector" },
  { symbol: "CIBR", label: "Cyber", yahoo: "CIBR", kind: "sector" },
];

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
const FETCH_CONCURRENCY = 3;

function quoteFromCache(
  def: SymbolDef,
  cached: {
    symbol: string;
    price: number;
    changePct: number | null;
    seriesJson: string;
    fetchedAt: Date;
  },
): MarketQuote {
  return {
    symbol: cached.symbol,
    label: def.label,
    kind: def.kind,
    price: cached.price,
    changePct: cached.changePct,
    series: JSON.parse(cached.seriesJson) as MarketPoint[],
    fetchedAt: cached.fetchedAt.toISOString(),
  };
}

async function quoteForSymbol(def: SymbolDef, force: boolean): Promise<MarketQuote> {
  const cached = await prisma.marketSnapshot.findUnique({
    where: { symbol: def.symbol },
  });
  const age = cached ? Date.now() - cached.fetchedAt.getTime() : Infinity;
  if (!force && cached && age < CACHE_MS && cached.price > 0) {
    return quoteFromCache(def, cached);
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
    return {
      symbol: saved.symbol,
      label: def.label,
      kind: def.kind,
      price: saved.price,
      changePct: saved.changePct,
      series,
      fetchedAt: saved.fetchedAt.toISOString(),
    };
  } catch {
    if (cached && cached.price > 0) return quoteFromCache(def, cached);
    return {
      symbol: def.symbol,
      label: def.label,
      kind: def.kind,
      price: 0,
      changePct: null,
      series: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function getMarkets(force = false): Promise<MarketQuote[]> {
  return mapPool(SYMBOLS, FETCH_CONCURRENCY, (def) => quoteForSymbol(def, force));
}
