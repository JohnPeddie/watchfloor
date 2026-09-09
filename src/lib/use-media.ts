"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Foldable cover vs inner screen, or any phone-sized viewport.
 *
 * Cover (folded / phone): CSS typically under ~540 on the short side.
 * Inner (open tablet): larger, often 4:3.
 *
 * PCs and laptops are detected separately (fine pointer + hover) so a
 * desktop window never inherits the compact shell.
 */
export const FOLD8_COVER_MAX_MIN_SIDE = 540;
const COVER_LANDSCAPE_MAX_WIDTH = 760;
const COVER_LANDSCAPE_MAX_HEIGHT = 500;

export type FloorKind = "cover" | "inner" | "laptop" | "desktop";

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

function subscribeViewport(onChange: () => void) {
  const on = () => onChange();
  window.addEventListener("resize", on);
  window.addEventListener("orientationchange", on);
  window.visualViewport?.addEventListener("resize", on);
  window.screen.orientation?.addEventListener("change", on);
  const posture = (
    navigator as Navigator & { devicePosture?: EventTarget }
  ).devicePosture;
  posture?.addEventListener("change", on);
  const queries = [
    "(device-posture: folded)",
    "(hover: hover)",
    "(pointer: fine)",
  ]
    .map((q) => {
      try {
        return window.matchMedia(q);
      } catch {
        return undefined;
      }
    })
    .filter((q): q is MediaQueryList => Boolean(q));
  for (const q of queries) q.addEventListener("change", on);
  return () => {
    window.removeEventListener("resize", on);
    window.removeEventListener("orientationchange", on);
    window.visualViewport?.removeEventListener("resize", on);
    window.screen.orientation?.removeEventListener("change", on);
    posture?.removeEventListener("change", on);
    for (const q of queries) q.removeEventListener("change", on);
  };
}

function readIsPc(): boolean {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return window.innerWidth >= 1280;
  }
}

function readIsCover(): boolean {
  try {
    if (window.matchMedia("(device-posture: folded)").matches) return true;
  } catch {
    /* older browsers */
  }

  const screenMin = Math.min(window.screen.width, window.screen.height);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (vw >= FOLD8_COVER_MAX_MIN_SIDE && vh >= COVER_LANDSCAPE_MAX_HEIGHT) return false;
  if (screenMin > 0 && screenMin < FOLD8_COVER_MAX_MIN_SIDE) return true;
  if (vw < FOLD8_COVER_MAX_MIN_SIDE) return true;
  if (vh < COVER_LANDSCAPE_MAX_HEIGHT && vw < COVER_LANDSCAPE_MAX_WIDTH) return true;
  return false;
}

function readFloorKind(): FloorKind {
  const vw = window.innerWidth;
  if (readIsPc()) {
    if (vw < 768) return "cover";
    if (vw < 1280) return "laptop";
    return "desktop";
  }
  return readIsCover() ? "cover" : "inner";
}

/** Cover screen of a foldable, or any phone-sized viewport. */
export function useIsCompact(): boolean {
  return useSyncExternalStore(
    subscribeViewport,
    () => readFloorKind() === "cover",
    () => true,
  );
}

/** Which shell to render. Server snapshot is cover (narrowest). */
export function useFloorKind(): FloorKind {
  return useSyncExternalStore(subscribeViewport, readFloorKind, () => "cover");
}

/**
 * Inner screen in landscape (4:3, height is tight). Used to collapse chrome
 * so the list | globe split still has room to breathe.
 */
export function useIsShortInner(): boolean {
  return useSyncExternalStore(
    subscribeViewport,
    () => readFloorKind() === "inner" && window.innerHeight <= 740,
    () => false,
  );
}

export function useIsTablet(): boolean {
  return useSyncExternalStore(
    subscribeViewport,
    () => {
      const kind = readFloorKind();
      return kind === "inner" || kind === "laptop";
    },
    () => false,
  );
}
