"use client";

import { Icon } from "@/components/Icon";
import type { Tag } from "@/lib/classify";

export type RailItem = {
  id: string;
  label: string;
  icon: string;
  tag: Tag | null;
};

export const RAIL_ITEMS: RailItem[] = [
  { id: "all", label: "All", icon: "public", tag: null },
  { id: "defence", label: "Defence", icon: "shield", tag: "DEFENCE" },
  { id: "uk", label: "UK", icon: "place", tag: "UK" },
  { id: "conflict", label: "Conflict", icon: "bolt", tag: "KINETIC" },
  { id: "cyber", label: "Cyber", icon: "security", tag: "CYBER" },
  { id: "energy", label: "Energy", icon: "drop", tag: "ENERGY" },
  { id: "markets", label: "Markets", icon: "trending", tag: "MARKETS" },
  { id: "intel", label: "Intel", icon: "radar", tag: "ESPIONAGE" },
];

type NavRailProps = {
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  counts: Record<string, number>;
};

export function NavRail({ activeTag, onSelectTag, counts }: NavRailProps) {
  return (
    <nav
      className="flex h-full shrink-0 flex-col items-center gap-1 py-3"
      style={{ width: 84, background: "var(--md-container-low)" }}
      aria-label="Intelligence lanes"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto pb-14">
        {RAIL_ITEMS.map((item) => {
          const active = (item.tag ?? null) === activeTag;
          const count = item.tag ? (counts[item.tag] ?? 0) : null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTag(item.tag)}
              className="group flex w-full flex-col items-center gap-1 py-1.5"
              aria-pressed={active}
            >
              <span
                className="relative flex h-8 w-14 items-center justify-center rounded-full transition-colors"
                style={{
                  background: active ? "var(--md-secondary-container)" : "transparent",
                  color: active ? "var(--md-on-secondary-container)" : "var(--md-on-surface-variant)",
                }}
              >
                <Icon name={item.icon} size={20} />
                {count != null && count > 0 && (
                  <span
                    className="md-mono absolute -right-0.5 -top-1 rounded-full px-1 text-[9px] font-medium"
                    style={{
                      background: "var(--md-primary)",
                      color: "var(--md-on-primary)",
                      minWidth: 15,
                      textAlign: "center",
                    }}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span
                className="text-[11px] font-medium"
                style={{
                  color: active ? "var(--md-on-surface)" : "var(--md-on-surface-variant)",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Lane selector for phones and tablets, where the vertical rail would cost too
 * much width. Scrolls horizontally so every lane stays reachable one-handed.
 */
export function LaneChips({ activeTag, onSelectTag, counts }: NavRailProps) {
  return (
    <nav
      className="md-hscroll flex shrink-0 items-center gap-2 px-3 py-1.5"
      style={{
        background: "var(--md-container-low)",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
      aria-label="Intelligence lanes"
    >
      {RAIL_ITEMS.map((item) => {
        const active = (item.tag ?? null) === activeTag;
        const count = item.tag ? (counts[item.tag] ?? 0) : null;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTag(item.tag)}
            aria-pressed={active}
            className="md-chip md-chip-filter shrink-0"
            style={
              active
                ? undefined
                : {
                    background: "var(--md-container-high)",
                    color: "var(--md-on-surface-variant)",
                  }
            }
          >
            <Icon name={item.icon} size={14} />
            {item.label}
            {count != null && count > 0 && <span style={{ opacity: 0.7 }}>{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
