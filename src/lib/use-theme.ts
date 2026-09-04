"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "watchfloor:theme";

/** Browser chrome colour, matched to each scheme's dimmed surface. */
const BROWSER_THEME_COLOR: Record<Theme, string> = {
  dark: "#0b0e11",
  light: "#efe8e1",
};

/**
 * Reads the theme the pre-paint script in the document head already applied,
 * rather than assuming a default and causing a flash on first render.
 */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", BROWSER_THEME_COLOR[next]);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing or blocked storage: the theme still applies for the
      // session, it just will not be remembered.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
