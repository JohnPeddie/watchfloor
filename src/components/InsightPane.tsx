"use client";

import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { TAG_ORDER, type Tag } from "@/lib/classify";
import { HelpButton } from "@/components/HelpButton";
import { Icon } from "@/components/Icon";
import type { MarketQuote } from "@/lib/markets";
import type { SummarizerStatus } from "@/lib/serializers";
import { providerDisplay } from "@/lib/model-label";

type InsightPaneProps = {
  markets: MarketQuote[];
  tagCounts: Record<string, number>;
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  precedenceCounts: Record<string, number>;
  feedStatus: Array<{ code: string; name: string; online: boolean; count: number }>;
  summarizer: SummarizerStatus | null;
  /** Side-by-side cards under the tablet globe. */
  columns?: 1 | 2;
};

export function InsightPane({
  markets,
  tagCounts,
  activeTag,
  onSelectTag,
  precedenceCounts,
  feedStatus,
  summarizer,
  columns = 1,
}: InsightPaneProps) {
  const oil = markets.filter((m) => m.label.includes("Crude"));
  const rest = markets.filter((m) => !m.label.includes("Crude"));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
      <div className={columns === 2 ? "grid grid-cols-2 gap-3" : "contents"}>
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

      {summarizer && <SummarizerCard status={summarizer} />}
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

function MarketRow({ quote }: { quote: MarketQuote }) {
  const up = (quote.changePct ?? 0) >= 0;
  const decimals = quote.symbol.includes("=X") ? 4 : 0;
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="md-label-sm truncate">{quote.label}</div>
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
