"use client";

import { useEffect, useState } from "react";
import { Icon, WatchfloorMark } from "@/components/Icon";
import { dtg } from "@/lib/dtg";

type AppBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  onIngest: () => void;
  ingesting: boolean;
  lastIngestAt: string | null;
  total: number;
  flashCount: number;
};

export function AppBar({
  query,
  onQueryChange,
  onIngest,
  ingesting,
  lastIngestAt,
  total,
  flashCount,
}: AppBarProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const ingestAge = lastIngestAt
    ? Math.round((Date.now() - new Date(lastIngestAt).getTime()) / 60000)
    : null;

  return (
    <header
      className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5"
      style={{
        background: "var(--md-container)",
        boxShadow: "var(--elev-2)",
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
      }}
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <WatchfloorMark />
        <div className="leading-tight">
          <div className="md-title-lg text-[var(--md-on-surface)]">Watchfloor</div>
          <div className="md-label-sm hidden sm:block">All-source intelligence</div>
        </div>
      </div>

      <div className="hidden max-w-[420px] flex-1 md:block">
        <label className="md-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search reporting, sources, locations"
            aria-label="Search reporting"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="md-icon-btn"
              style={{ width: 28, height: 28 }}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-4 lg:flex">
          <Stat label="Holdings" value={`${total}`} />
          <Stat
            label="Flash"
            value={flashCount > 0 ? `${flashCount}` : "0"}
            tone={flashCount > 0 ? "error" : undefined}
          />
          <Stat
            label="Synced"
            value={ingestAge == null ? "never" : `${ingestAge}m ago`}
            tone={ingestAge != null && ingestAge > 180 ? "warning" : undefined}
          />
          <div className="md-mono md-label-sm">{now ? dtg(now) : "—"}</div>
        </div>

        <div
          className="hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex"
          style={{ background: "var(--md-primary-container)" }}
        >
          <Icon name="shield" size={16} className="text-[var(--md-on-primary-container)]" />
          <span className="text-[11.5px] font-semibold text-[var(--md-on-primary-container)]">
            UK threat: Substantial
          </span>
        </div>

        <button
          type="button"
          className="md-btn-filled"
          onClick={onIngest}
          disabled={ingesting}
          aria-label={ingesting ? "Collecting" : "Collect"}
        >
          <Icon name="refresh" size={18} className={ingesting ? "md-pulse" : ""} />
          <span className="hidden sm:inline">{ingesting ? "Collecting" : "Collect"}</span>
        </button>
      </div>

      {/* Search moves to its own row on phones, where it cannot share the bar. */}
      <div className="w-full md:hidden">
        <label className="md-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search reporting"
            aria-label="Search reporting"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="md-icon-btn"
              style={{ width: 28, height: 28 }}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
      </div>

      {ingesting && (
        <div className="md-progress absolute inset-x-0 bottom-0 rounded-none">
          <span />
        </div>
      )}
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "error" | "warning";
}) {
  const color =
    tone === "error"
      ? "var(--md-error)"
      : tone === "warning"
        ? "var(--md-warning)"
        : "var(--md-on-surface)";
  return (
    <div className="leading-tight">
      <div className="md-label-sm">{label}</div>
      <div className="md-mono text-[13px] font-medium" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
