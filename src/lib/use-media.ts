"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a media query.
 *
 * Starts false so server and first client render agree, then corrects after
 * mount. Layout itself is driven by CSS breakpoints; this is only for
 * behaviour that CSS cannot express, such as which pane to switch to when a
 * report is opened.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True below Tailwind's `md`, where panes are shown one at a time. */
export function useIsCompact(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
