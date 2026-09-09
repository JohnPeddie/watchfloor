"use client";

import { useEffect, useState } from "react";
import { Icon, WatchfloorMark } from "@/components/Icon";
import { dtg } from "@/lib/dtg";
import { useTheme } from "@/lib/use-theme";
import { usePwa } from "@/lib/use-pwa";
import { FLOOR_VIEWS, type FloorView } from "@/lib/floor";
import { THREAT_SOURCE_URL, type ThreatPayload } from "@/lib/threat-types";

type AppBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  onIngest: () => void;
  ingesting: boolean;
  lastIngestAt: string | null;
  total: number;
  flashCount: number;
  view?: FloorView;
  onViewChange?: (view: FloorView) => void;
  showViews?: boolean;
  /** Cover screen, or the inner screen in landscape — keep to a single row. */
  dense?: boolean;
  /** True when the configured LLM host cannot be reached. */
  llmOffline?: boolean;
  onOpenSettings?: () => void;
  threat?: ThreatPayload | null;
};

export function AppBar({
  query,
  onQueryChange,
  onIngest,
  ingesting,
  lastIngestAt,
  total,
  flashCount,
  view,
  onViewChange,
  showViews = false,
  dense = false,
  llmOffline = false,
  onOpenSettings,
  threat = null,
}: AppBarProps) {
  const [now, setNow] = useState<Date | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { standalone, fullscreen, toggleFullscreen } = usePwa();

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
      className={`relative z-30 flex shrink-0 items-center gap-2 ${
        dense ? "px-2 py-1.5" : "gap-3 px-3 py-2 sm:px-4"
      }`}
      style={{
        background: "var(--md-container)",
        boxShadow: "var(--elev-2)",
        paddingTop: "max(0.4rem, env(safe-area-inset-top))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="flex shrink-0 items-center gap-2">
        <WatchfloorMark />
        <div className="leading-tight">
          <div className="md-title-lg text-[var(--md-on-surface)]">Watchfloor</div>
          {!dense && (
            <div className="md-label-sm hidden lg:block">All-source intelligence</div>
          )}
        </div>
      </div>

      {showViews && view && onViewChange && (
        <nav className="min-w-0 shrink-0" aria-label="Watchfloor views">
          <div
            className="flex items-center gap-0.5 overflow-x-auto rounded-full p-0.5"
            style={{ background: "var(--md-container-high)" }}
          >
            {FLOOR_VIEWS.map((item) => {
              const active = item.id === view;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  aria-current={active ? "page" : undefined}
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold"
                  style={{
                    background: active ? "var(--md-secondary-container)" : "transparent",
                    color: active
                      ? "var(--md-on-secondary-container)"
                      : "var(--md-on-surface-variant)",
                  }}
                >
                  <Icon name={item.icon} size={15} />
                  <span className="hidden min-[900px]:inline">{item.label}</span>
                  <span className="min-[900px]:hidden">{item.short}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <div className="min-w-0 flex-1">
        <SearchField query={query} onQueryChange={onQueryChange} compact={dense || showViews} />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
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

        <ThreatChip threat={threat} />

        {llmOffline && (
          <div
            className="md-mono max-w-[7.5rem] truncate rounded-full px-2.5 py-1 text-[10px] font-semibold sm:max-w-[16rem]"
            title="The configured local LLM host is unreachable. Watchfloor still runs; daily briefs fall back to the rules engine until it is back."
            style={{
              background: "var(--md-error-container)",
              color: "var(--md-error)",
            }}
          >
            {dense ? "LLM off" : "LLM offline — briefs use rules"}
          </div>
        )}

        <button
          type="button"
          className="md-icon-btn"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          <Icon name={theme === "light" ? "dark_mode" : "light_mode"} size={19} />
        </button>

        {onOpenSettings && (
          <button
            type="button"
            className="md-icon-btn"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
          >
            <Icon name="settings" size={19} />
          </button>
        )}

        {!standalone && (
          <button
            type="button"
            className="md-icon-btn"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "Show browser chrome" : "Hide address bar"}
            title={fullscreen ? "Exit fullscreen" : "Hide address bar"}
          >
            <Icon name={fullscreen ? "fullscreen_exit" : "fullscreen"} size={19} />
          </button>
        )}

        <button
          type="button"
          className="md-btn-filled"
          onClick={onIngest}
          disabled={ingesting}
          aria-label={ingesting ? "Collecting" : "Collect"}
          style={dense ? { height: 36, padding: "0 12px" } : undefined}
        >
          <Icon name="refresh" size={18} className={ingesting ? "md-pulse" : ""} />
          <span className="hidden min-[900px]:inline">{ingesting ? "Collecting" : "Collect"}</span>
        </button>
      </div>

      {ingesting && (
        <div className="md-progress absolute inset-x-0 bottom-0 rounded-none">
          <span />
        </div>
      )}
    </header>
  );
}

function threatStyle(level: ThreatPayload["level"]): { background: string; color: string } {
  if (level === "critical" || level === "severe") {
    return { background: "var(--md-error-container)", color: "var(--md-error)" };
  }
  if (level === "substantial") {
    return { background: "var(--md-primary-container)", color: "var(--md-on-primary-container)" };
  }
  if (level === "moderate") {
    return { background: "var(--md-secondary-container)", color: "var(--md-on-secondary-container)" };
  }
  return { background: "var(--md-container-high)", color: "var(--md-on-surface-variant)" };
}

function ThreatChip({ threat }: { threat: ThreatPayload | null }) {
  const level = threat?.level ?? null;
  const label = level ? level.toUpperCase() : "…";
  const tone = threatStyle(level);
  const titleParts = [
    level && threat?.meaning ? `${label}: ${threat.meaning}.` : "UK national terrorism threat level from MI5 / JTAC.",
    threat?.northernIreland ? `Northern Ireland-related terrorism: ${threat.northernIreland.toUpperCase()}.` : null,
    "Opens the MI5 terrorism threat levels page.",
  ].filter(Boolean);

  return (
    <a
      href={THREAT_SOURCE_URL}
      target="_blank"
      rel="noreferrer"
      className="hidden items-center gap-2 rounded-full px-3 py-1.5 lg:flex"
      style={{ background: tone.background, color: tone.color }}
      title={titleParts.join(" ")}
      aria-label={`UK threat level ${label}`}
    >
      <Icon name="shield" size={16} />
      <span className="text-[11.5px] font-semibold">UK threat: {label}</span>
    </a>
  );
}

function SearchField({
  query,
  onQueryChange,
  compact = false,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  compact?: boolean;
}) {
  return (
    <label className={`md-search ${compact ? "" : "max-w-[520px]"}`}>
      <Icon name="search" size={18} />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={compact ? "Search reporting" : "Search reporting, sources, locations"}
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
