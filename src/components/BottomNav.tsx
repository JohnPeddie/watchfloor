"use client";

import { Icon } from "@/components/Icon";

/** The four panes, shown one at a time on a phone or foldable cover. */
export type PaneId = "brief" | "articles" | "map" | "markets";

const DESTINATIONS: { id: PaneId; label: string; icon: string }[] = [
  { id: "brief", label: "Brief", icon: "article" },
  { id: "articles", label: "Articles", icon: "radar" },
  { id: "map", label: "Globe", icon: "public" },
  { id: "markets", label: "Desk", icon: "dashboard" },
];

type BottomNavProps = {
  active: PaneId;
  onChange: (pane: PaneId) => void;
  /** Count of FLASH items, badged on the stream destination. */
  flashCount: number;
};

/**
 * Material navigation bar for a phone-sized cover. Wider inner screens use the
 * top-bar views instead.
 */
export function BottomNav({ active, onChange, flashCount }: BottomNavProps) {
  return (
    <nav
      className="flex shrink-0 items-stretch justify-around"
      style={{
        background: "var(--md-container)",
        boxShadow: "var(--elev-2)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "max(0.25rem, env(safe-area-inset-left))",
        paddingRight: "max(0.25rem, env(safe-area-inset-right))",
      }}
      aria-label="Dashboard sections"
    >
      {DESTINATIONS.map((destination) => {
        const isActive = destination.id === active;
        return (
          <button
            key={destination.id}
            type="button"
            onClick={() => onChange(destination.id)}
            aria-current={isActive ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2"
          >
            <span
              className="relative flex h-8 w-16 items-center justify-center rounded-full transition-colors"
              style={{
                background: isActive ? "var(--md-secondary-container)" : "transparent",
                color: isActive
                  ? "var(--md-on-secondary-container)"
                  : "var(--md-on-surface-variant)",
              }}
            >
              <Icon name={destination.icon} size={20} />
              {destination.id === "articles" && flashCount > 0 && (
                <span
                  className="md-mono absolute right-2 top-0 rounded-full px-1 text-[9px] font-medium"
                  style={{
                    background: "var(--md-error)",
                    color: "var(--md-on-error, #3b0907)",
                    minWidth: 15,
                    textAlign: "center",
                  }}
                >
                  {flashCount > 99 ? "99+" : flashCount}
                </span>
              )}
            </span>
            <span
              className="text-[11px] font-medium"
              style={{
                color: isActive ? "var(--md-on-surface)" : "var(--md-on-surface-variant)",
              }}
            >
              {destination.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
