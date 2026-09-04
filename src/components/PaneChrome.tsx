"use client";

import { Icon } from "@/components/Icon";

/**
 * A pane collapsed out of the way. Stays on screen as a slim bar so the space
 * it gave up is obvious and it can be brought back where it was, rather than
 * vanishing and needing to be found again.
 */
export function MinimisedPane({
  title,
  detail,
  onRestore,
}: {
  title: string;
  detail?: string;
  onRestore: () => void;
}) {
  return (
    <section className="md-pane flex items-center gap-2 px-3 py-1.5">
      <button
        type="button"
        className="md-icon-btn shrink-0"
        style={{ width: 28, height: 28 }}
        onClick={onRestore}
        aria-label={`Restore ${title}`}
      >
        <Icon name="fullscreen" size={16} />
      </button>
      <span className="md-title-lg truncate">{title}</span>
      {detail && <span className="md-label-sm truncate">{detail}</span>}
      <button
        type="button"
        className="md-btn-text ml-auto shrink-0"
        onClick={onRestore}
      >
        Restore
      </button>
    </section>
  );
}

/**
 * Header control for giving a pane's space to its neighbour.
 *
 * On a phone the panes already fill the screen one at a time, so collapsing
 * one would achieve nothing; there the same button goes full-bleed instead,
 * hiding the app bar and navigation.
 */
export function PaneSizeButton({
  compact,
  active,
  label,
  onToggle,
}: {
  compact: boolean;
  active: boolean;
  label: string;
  onToggle: () => void;
}) {
  const description = compact
    ? active
      ? `Exit full screen for ${label}`
      : `Show ${label} full screen`
    : `Minimise ${label}`;

  return (
    <button
      type="button"
      className="md-icon-btn shrink-0"
      style={{ width: 28, height: 28 }}
      onClick={onToggle}
      aria-label={description}
      title={description}
    >
      <Icon
        name={compact ? (active ? "fullscreen_exit" : "fullscreen") : "minimise"}
        size={16}
      />
    </button>
  );
}
