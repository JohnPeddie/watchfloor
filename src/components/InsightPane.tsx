"use client";

import { Fragment, type ReactNode } from "react";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { TAG_ORDER, type Tag } from "@/lib/classify";
import { CitySearch } from "@/components/CitySearch";
import { HelpButton } from "@/components/HelpButton";
import { Icon } from "@/components/Icon";
import type { MarketQuote } from "@/lib/markets";
import type { WeatherCityHit, WeatherPayload, WeatherWarning, WeatherWarningLevel } from "@/lib/weather-types";
import type { SummarizerStatus } from "@/lib/serializers";
import { providerDisplay } from "@/lib/model-label";
import {
  DEFAULT_SETTINGS,
  parseInsightOrder,
  type InsightCardId,
} from "@/lib/settings-types";

type InsightPaneProps = {
  markets: MarketQuote[];
  weather: WeatherPayload | null;
  onWeatherChange: (weather: WeatherPayload) => void;
  tagCounts: Record<string, number>;
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  precedenceCounts: Record<string, number>;
  feedStatus: Array<{ code: string; name: string; online: boolean; count: number }>;
  summarizer: SummarizerStatus | null;
  insightOrder?: InsightCardId[];
  /** Side-by-side cards under the tablet globe. */
  columns?: 1 | 2;
};

export function InsightPane({
  markets,
  weather,
  onWeatherChange,
  tagCounts,
  activeTag,
  onSelectTag,
  precedenceCounts,
  feedStatus,
  summarizer,
  insightOrder = DEFAULT_SETTINGS.insightOrder,
  columns = 1,
}: InsightPaneProps) {
  const oil = markets.filter((m) => m.kind === "energy");
  const rest = markets.filter((m) => m.kind === "benchmark");
  const sectors = markets.filter((m) => m.kind === "sector");
  const order = parseInsightOrder(insightOrder);

  const cards: Record<InsightCardId, ReactNode> = {
    weather: <WeatherCard weather={weather} span={columns === 2} onWeatherChange={onWeatherChange} />,
    energy: (
      <section className="md-pane shrink-0">
        <div className="md-pane-head">
          <div className="md-title-lg flex items-center gap-2">
            <Icon name="drop" size={18} className="text-[var(--md-primary)]" />
            Energy
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="md-label-sm">USD / bbl</span>
            <HelpButton topic="energy" />
          </div>
        </div>
        <div className="space-y-2 px-3 pb-3">
          {oil.map((q) => (
            <OilCard key={q.symbol} quote={q} />
          ))}
        </div>
      </section>
    ),
    markets: (
      <section className="md-pane shrink-0">
        <div className="md-pane-head">
          <div className="md-title-lg flex items-center gap-2">
            <Icon name="trending" size={18} className="text-[var(--md-secondary)]" />
            Markets
          </div>
          <HelpButton topic="markets" />
        </div>
        <div className="px-3 pb-3">
          <div className="md-card-outlined divide-y divide-[var(--md-outline-variant)]">
            {rest.map((q) => (
              <MarketRow key={q.symbol} quote={q} />
            ))}
          </div>
        </div>
      </section>
    ),
    sectors:
      sectors.length > 0 ? (
        <section className={`md-pane shrink-0${columns === 2 ? " col-span-2" : ""}`}>
          <div className="md-pane-head">
            <div className="md-title-lg flex items-center gap-2">
              <Icon name="layers" size={18} className="text-[var(--md-secondary)]" />
              Sectors
            </div>
            <HelpButton topic="sectors" />
          </div>
          <div className="px-3 pb-3">
            <div
              className={
                columns === 2
                  ? "grid grid-cols-2 gap-2"
                  : "md-card-outlined divide-y divide-[var(--md-outline-variant)]"
              }
            >
              {sectors.map((q) =>
                columns === 2 ? (
                  <div key={q.symbol} className="md-card-outlined">
                    <MarketRow quote={q} />
                  </div>
                ) : (
                  <MarketRow key={q.symbol} quote={q} />
                ),
              )}
            </div>
          </div>
        </section>
      ) : null,
    precedence: (
      <section className={`md-pane shrink-0${columns === 2 ? " col-span-2" : ""}`}>
        <div className="md-pane-head">
          <div className="md-title-lg">Precedence</div>
          <HelpButton topic="precedence" />
        </div>
        <div className="grid grid-cols-4 gap-2 px-3 pb-3">
          {(["FLASH", "IMMEDIATE", "PRIORITY", "ROUTINE"] as const).map((p) => (
            <div
              key={p}
              className="rounded-xl px-2 py-2 text-center"
              style={{ background: "var(--md-container)" }}
            >
              <div
                className="md-mono text-[18px] font-medium leading-tight"
                style={{
                  color:
                    p === "FLASH"
                      ? "var(--md-error)"
                      : p === "IMMEDIATE"
                        ? "var(--md-primary)"
                        : p === "PRIORITY"
                          ? "var(--md-secondary)"
                          : "var(--md-on-surface-variant)",
                }}
              >
                {precedenceCounts[p] ?? 0}
              </div>
              <div className="md-label-sm">{p.slice(0, 4)}</div>
            </div>
          ))}
        </div>
      </section>
    ),
    classification: (
      <section className={`md-pane shrink-0${columns === 2 ? " col-span-2" : ""}`}>
        <div className="md-pane-head">
          <div className="md-title-lg">Classification</div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className="md-btn-text" onClick={() => onSelectTag(null)}>
              Reset
            </button>
            <HelpButton topic="classification" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {TAG_ORDER.filter((t) => (tagCounts[t] ?? 0) > 0).map((tag) => (
            <TagFilter
              key={tag}
              tag={tag}
              count={tagCounts[tag] ?? 0}
              active={activeTag === tag}
              onClick={() => onSelectTag(activeTag === tag ? null : tag)}
            />
          ))}
        </div>
      </section>
    ),
    collection: (
      <section className="md-pane shrink-0">
        <div className="md-pane-head">
          <div className="md-title-lg">Collection</div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="md-label-sm">
              {`${feedStatus.filter((f) => f.online).length}/${feedStatus.length} online`}
            </span>
            <HelpButton topic="collection" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-3">
          {feedStatus.map((f) => (
            <div key={f.code} className="flex items-center gap-2" title={f.name}>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: f.online ? "var(--md-success)" : "var(--md-outline-variant)" }}
              />
              <span className="md-mono flex-1 truncate text-[11px] text-[var(--md-on-surface-variant)]">
                {f.code}
              </span>
              <span className="md-mono text-[10.5px] text-[var(--md-outline)]">{f.count}</span>
            </div>
          ))}
        </div>
      </section>
    ),
    summarisation: summarizer ? <SummarizerCard status={summarizer} /> : null,
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
      <div className={columns === 2 ? "grid grid-cols-2 gap-3" : "contents"}>
        {order.map((id) => {
          const node = cards[id];
          return node ? <Fragment key={id}>{node}</Fragment> : null;
        })}
      </div>
    </div>
  );
}

/**
 * Shows which summariser is in use and whether it is reachable, so it is
 * obvious when the dashboard has degraded to offline extraction.
 */
function SummarizerCard({ status }: { status: SummarizerStatus }) {
  const active = status.providers.find((p) => p.id === status.configured);
  const usingRules = status.configured === "rules" || status.degraded;

  return (
    <section className="md-pane shrink-0">
      <div className="md-pane-head">
        <div className="md-title-lg flex items-center gap-2">
          <Icon name="insights" size={18} className="text-[var(--md-secondary)]" />
          Summarisation
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="md-mono rounded-full px-2 py-0.5 text-[10px]"
            style={{
              background: usingRules
                ? "var(--md-container-high)"
                : "var(--md-primary-container)",
              color: usingRules
                ? "var(--md-on-surface-variant)"
                : "var(--md-on-primary-container)",
            }}
          >
            {usingRules ? "RULES" : "LLM"}
          </span>
          <HelpButton topic="summarisation" />
        </div>
      </div>

      <div className="space-y-1.5 px-3 pb-3">
        {status.providers.map((provider) => (
          <div key={provider.id} className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: provider.reachable
                  ? "var(--md-success)"
                  : "var(--md-outline-variant)",
              }}
            />
            <span className="md-mono flex-1 truncate text-[11px] text-[var(--md-on-surface-variant)]">
              {providerDisplay(provider.id, provider.model)}
            </span>
            {provider.id === status.configured && (
              <span className="md-label-sm md-mono text-[var(--md-secondary)]">active</span>
            )}
          </div>
        ))}

        {status.degraded && active?.detail && (
          <p className="md-body pt-1 text-[11px] leading-snug text-[var(--md-warning)]">
            {active.detail}
          </p>
        )}
      </div>
    </section>
  );
}

function weatherGlyph(code: number): "light_mode" | "drop" | "bolt" | "radar" {
  if (code >= 95) return "bolt";
  if (code >= 51) return "drop";
  if (code <= 3) return "light_mode";
  return "radar";
}

function warningTone(level: WeatherWarningLevel): { color: string; bg: string } {
  if (level === "red") return { color: "var(--md-error)", bg: "var(--md-error-container)" };
  if (level === "amber") return { color: "var(--md-warning)", bg: "var(--md-container-high)" };
  if (level === "yellow") return { color: "var(--md-primary)", bg: "var(--md-container)" };
  return { color: "var(--md-on-surface-variant)", bg: "var(--md-container)" };
}

function forecastLabel(date: string, index: number, timeZone: string): string {
  if (index === 0) return "Today";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const zone = timeZone && timeZone !== "auto" ? timeZone : undefined;
  try {
    return parsed.toLocaleDateString("en-GB", { weekday: "short", timeZone: zone });
  } catch {
    return parsed.toLocaleDateString("en-GB", { weekday: "short" });
  }
}

function formatTemp(value: number): string {
  return `${Math.round(value)}°`;
}

function WeatherCard({
  weather,
  span,
  onWeatherChange,
}: {
  weather: WeatherPayload | null;
  span: boolean;
  onWeatherChange: (weather: WeatherPayload) => void;
}) {
  const city = weather?.location || "London";
  const current = weather?.current ?? null;
  const forecast = weather?.forecast ?? [];
  const warnings = weather?.warnings ?? [];
  const timeZone = weather?.timezone || "UTC";

  async function chooseCity(hit: WeatherCityHit) {
    const res = await fetch("/api/weather", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weatherCity: hit.name,
        weatherLat: hit.lat,
        weatherLng: hit.lng,
        weatherTimezone: hit.timezone,
        weatherCountry: hit.countryCode,
      }),
    });
    if (!res.ok) throw new Error("Could not set city");
    onWeatherChange((await res.json()) as WeatherPayload);
  }

  return (
    <section className={`md-pane shrink-0${span ? " col-span-2" : ""}`}>
      <div className="md-pane-head">
        <div className="md-title-lg flex items-center gap-2">
          <Icon name="radar" size={18} className="text-[var(--md-secondary)]" />
          Weather
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="md-label-sm max-w-[7.5rem] truncate">{city}</span>
          <CitySearch variant="icon" city={city} onSelect={chooseCity} />
          <HelpButton topic="weather" />
        </div>
      </div>

      <div className="space-y-3 px-3 pb-3">
        {!weather ? (
          <p className="md-body text-[12px] text-[var(--md-on-surface-variant)]">
            Checking conditions…
          </p>
        ) : current ? (
          <div className="md-card p-3" style={{ background: "var(--md-container)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Icon
                    name={weatherGlyph(current.weatherCode)}
                    size={22}
                    className="text-[var(--md-primary)]"
                  />
                  <span className="md-label">{current.summary}</span>
                </div>
                <div className="md-mono md-display mt-0.5 text-[var(--md-primary)]">
                  {formatTemp(current.tempC)}
                </div>
                <div className="md-label-sm mt-0.5">Feels like {formatTemp(current.feelsLikeC)}</div>
              </div>
              <div className="md-mono space-y-1 text-right text-[11px] text-[var(--md-on-surface-variant)]">
                <div>Wind {Math.round(current.windKph)} km/h</div>
                <div>Humidity {Math.round(current.humidity)}%</div>
                <div>Rain {current.precipMm.toFixed(1)} mm</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="md-body text-[12px] text-[var(--md-on-surface-variant)]">
            Conditions for {city} are unavailable.
          </p>
        )}

        {forecast.length > 0 && (
          <div className="grid grid-cols-5 gap-1.5">
            {forecast.map((day, index) => (
              <div
                key={day.date || index}
                className="rounded-xl px-1.5 py-2 text-center"
                style={{ background: "var(--md-container)" }}
              >
                <div className="md-label-sm truncate">{forecastLabel(day.date, index, timeZone)}</div>
                <Icon
                  name={weatherGlyph(day.weatherCode)}
                  size={16}
                  className="mx-auto mt-1 text-[var(--md-secondary)]"
                />
                <div className="md-mono mt-1 text-[13px] text-[var(--md-on-surface)]">
                  {formatTemp(day.maxC)}
                </div>
                <div className="md-mono text-[11px] text-[var(--md-on-surface-variant)]">
                  {formatTemp(day.minC)}
                </div>
                <div className="md-label-sm mt-0.5">{Math.round(day.rainChance)}%</div>
              </div>
            ))}
          </div>
        )}

        {weather && (
        <div>
          <div className="md-label-sm mb-1.5">UK warnings</div>
          {warnings.length === 0 ? (
            <p className="md-body text-[12px] text-[var(--md-on-surface-variant)]">
              No active warnings.
            </p>
          ) : (
            <div className="space-y-1.5">
              {warnings.map((warning) => (
                <WarningRow key={warning.id} warning={warning} city={city} />
              ))}
            </div>
          )}
        </div>
        )}

        <p className="md-label-sm text-[var(--md-outline)]">
          Forecast:{" "}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[var(--md-outline-variant)] underline-offset-2"
          >
            Open-Meteo
          </a>
          . Warnings:{" "}
          <a
            href="https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[var(--md-outline-variant)] underline-offset-2"
          >
            Met Office
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function WarningRow({ warning, city }: { warning: WeatherWarning; city: string }) {
  const tone = warningTone(warning.level);
  return (
    <a
      href={warning.link}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl px-3 py-2"
      style={{ background: "var(--md-container)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="md-mono rounded-full px-1.5 py-0.5 text-[10px] uppercase"
          style={{ color: tone.color, background: tone.bg }}
        >
          {warning.level === "unknown" ? "alert" : warning.level}
        </span>
        {warning.local && (
          <span className="md-mono truncate text-[10px] text-[var(--md-secondary)]">{city}</span>
        )}
        <Icon name="open" size={12} className="ml-auto shrink-0 text-[var(--md-outline)]" />
      </div>
      <div className="md-label-sm mt-1 leading-snug text-[var(--md-on-surface)]">{warning.title}</div>
      {warning.summary ? (
        <p className="md-body mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--md-on-surface-variant)]">
          {warning.summary}
        </p>
      ) : null}
    </a>
  );
}

function OilCard({ quote }: { quote: MarketQuote }) {
  const up = (quote.changePct ?? 0) >= 0;
  return (
    <div className="md-card p-3" style={{ background: "var(--md-container)" }}>
      <div className="flex items-baseline justify-between">
        <span className="md-label">{quote.label}</span>
        <span
          className="md-mono text-[12px] font-medium"
          style={{ color: up ? "var(--md-success)" : "var(--md-error)" }}
        >
          {quote.changePct == null
            ? "—"
            : `${up ? "▲" : "▼"} ${Math.abs(quote.changePct).toFixed(2)}%`}
        </span>
      </div>
      <div className="md-mono md-display mt-0.5 text-[var(--md-primary)]">
        {quote.price ? quote.price.toFixed(2) : "—"}
      </div>
      <div className="mt-1 h-[62px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={quote.series.slice(-45)} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
            <defs>
              <linearGradient id={`fill-${quote.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--md-primary)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--md-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Tooltip
              contentStyle={{
                background: "var(--md-container-high)",
                border: "none",
                borderRadius: 12,
                fontSize: 11,
                boxShadow: "var(--elev-3)",
              }}
              labelStyle={{ color: "var(--md-on-surface-variant)" }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--md-primary)"
              strokeWidth={2}
              fill={`url(#fill-${quote.symbol})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function priceDecimals(quote: MarketQuote): number {
  if (quote.symbol.includes("=X")) return 4;
  if (quote.kind === "sector" || quote.kind === "energy") return 2;
  return 0;
}

function MarketRow({ quote }: { quote: MarketQuote }) {
  const up = (quote.changePct ?? 0) >= 0;
  const decimals = priceDecimals(quote);
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="md-label-sm truncate">
          {quote.label}
          {quote.kind === "sector" && (
            <span className="md-mono ml-1.5 text-[var(--md-outline)]">{quote.symbol}</span>
          )}
        </div>
        <div className="md-mono text-[15px] text-[var(--md-on-surface)]">
          {quote.price ? quote.price.toFixed(decimals) : "—"}
        </div>
      </div>
      <div className="h-[30px] w-[76px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={quote.series.slice(-40)}>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Line
              type="monotone"
              dataKey="v"
              stroke={up ? "var(--md-success)" : "var(--md-error)"}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div
        className="md-mono w-[58px] text-right text-[12px]"
        style={{ color: up ? "var(--md-success)" : "var(--md-error)" }}
      >
        {quote.changePct == null ? "—" : `${up ? "+" : ""}${quote.changePct.toFixed(2)}%`}
      </div>
    </div>
  );
}

function TagFilter({
  tag,
  count,
  active,
  onClick,
}: {
  tag: Tag;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`md-chip md-chip-filter md-chip-hue hue-${tag}`}
    >
      {tag}
      <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}
