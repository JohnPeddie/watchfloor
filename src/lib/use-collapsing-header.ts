"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hides the top chrome while scrolling down and restores it on the way back
 * up, so a phone gives most of its height to the reporting itself.
 *
 * Each pane scrolls in its own container rather than the document, so this
 * listens in the capture phase on a shared ancestor and picks up scroll from
 * whichever descendant is actually scrolling. The header is then pulled out of
 * flow with a negative margin, which keeps the panes below it full height.
 */
export function useCollapsingHeader(enabled: boolean, resetKey: unknown) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  // Track each scroller separately; switching panes must not read a stale
  // offset from the previous one.
  const lastOffsets = useRef(new WeakMap<EventTarget, number>());

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !enabled) return;

    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const current = target.scrollTop;
      const previous = lastOffsets.current.get(target) ?? 0;
      lastOffsets.current.set(target, current);

      const delta = current - previous;
      // Near the top the header is always shown, so a short list can never
      // leave it stranded off-screen.
      if (current <= 24) setCollapsed(false);
      else if (delta > 6) setCollapsed(true);
      else if (delta < -6) setCollapsed(false);
    };

    host.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => host.removeEventListener("scroll", onScroll, { capture: true });
  }, [enabled]);

  // Changing pane or leaving compact layout brings the chrome back.
  useEffect(() => {
    setCollapsed(false);
  }, [resetKey, enabled]);

  const hidden = enabled && collapsed;

  return { headerRef, hostRef, offset: hidden ? -height : 0, hidden };
}
