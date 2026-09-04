"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks a media query.
 *
 * Reads synchronously on the client so the first browser render already has
 * the right breakpoint. The server snapshot is false, which matches the
 * narrowest layout — the panes are empty until data loads, so correcting the
 * layout at hydration is not visible.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below `md`: one pane at a time, driven by the bottom navigation bar. */
export function useIsCompact(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** `md` to `xl`: two columns, reporting on the left and the globe on the right. */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1279px)");
}
