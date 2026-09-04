"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { HELP } from "@/lib/help";

const PANEL_WIDTH = 272;
const VIEWPORT_MARGIN = 8;

/**
 * Question-mark button that explains the panel it sits in.
 *
 * The panels clip their overflow, so the popover is positioned fixed against
 * the button's measured position rather than nested inside it. It closes on
 * outside click, on Escape and on scroll, which also avoids it drifting away
 * from the button it belongs to.
 */
export function HelpButton({ topic }: { topic: keyof typeof HELP }) {
  const entry = HELP[topic];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => setPosition(null), []);

  const open = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();

    // Prefer sitting under the button and right-aligned to it, but never let
    // the panel run off either edge of a narrow screen.
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN,
    );
    setPosition({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!position) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position, close]);

  if (!entry) return null;
  const isOpen = position !== null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="md-icon-btn shrink-0"
        style={{ width: 26, height: 26 }}
        aria-label={`What is ${entry.title}?`}
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
      >
        <Icon name="help" size={15} />
      </button>

      {position && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${entry.title} — explanation`}
          className="md-sheet fixed z-[120] rounded-2xl p-3"
          style={{
            top: position.top,
            left: position.left,
            width: PANEL_WIDTH,
            background: "var(--md-container-high)",
            boxShadow: "var(--elev-4)",
          }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="md-label" style={{ color: "var(--md-primary)" }}>
              {entry.title}
            </h3>
            <button
              type="button"
              className="md-icon-btn"
              style={{ width: 24, height: 24 }}
              onClick={close}
              aria-label="Close explanation"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <p className="md-body text-[12px] leading-relaxed">{entry.body}</p>
        </div>
      )}
    </>
  );
}
