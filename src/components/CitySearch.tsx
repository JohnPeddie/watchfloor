"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as InputKeyEvent } from "react";
import { Icon } from "@/components/Icon";
import type { WeatherCityHit } from "@/lib/weather-types";

const PANEL_WIDTH = 272;
const VIEWPORT_MARGIN = 8;

type CitySearchProps = {
  city: string;
  disabled?: boolean;
  /** Icon sits in a pane header; field is the full-width Settings control. */
  variant?: "field" | "icon";
  onSelect: (hit: WeatherCityHit) => Promise<void> | void;
};

export function CitySearch({ city, disabled, variant = "field", onSelect }: CitySearchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<WeatherCityHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    setQuery("");
    setHits([]);
    setError(null);
    setSaving(false);
  }, []);

  const openSearch = useCallback(() => {
    const button = buttonRef.current;
    if (variant === "icon" && button) {
      const rect = button.getBoundingClientRect();
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, rect.right - PANEL_WIDTH),
        window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN,
      );
      setPosition({ top: rect.bottom + 6, left });
    }
    setOpen(true);
  }, [variant]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      close();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void fetch(`/api/weather/cities?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => res.json())
        .then((data) => {
          setHits(Array.isArray(data.cities) ? data.cities : []);
          setActive(0);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setHits([]);
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, query]);

  async function pick(hit: WeatherCityHit) {
    setSaving(true);
    setError(null);
    try {
      await onSelect(hit);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set city");
      setSaving(false);
    }
  }

  function onKeyDown(event: InputKeyEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(hits.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[active];
      if (hit) void pick(hit);
    }
  }

  const results = (
    <>
      {error && (
        <p className="md-label-sm px-1 py-2" style={{ color: "var(--md-error)" }}>
          {error}
        </p>
      )}
      {saving && <p className="md-label-sm px-1 py-2">Updating…</p>}
      {!saving && loading && <p className="md-label-sm px-1 py-2">Searching…</p>}
      {!saving && !loading && query.trim().length < 2 && (
        <p className="md-label-sm px-1 py-2">Type a city name</p>
      )}
      {!saving && !loading && query.trim().length >= 2 && hits.length === 0 && (
        <p className="md-label-sm px-1 py-2">No matching cities</p>
      )}
      {!saving &&
        hits.map((hit, index) => (
          <button
            key={`${hit.id}-${hit.lat}-${hit.lng}`}
            type="button"
            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left"
            style={{
              background: index === active ? "var(--md-hover)" : "transparent",
            }}
            onMouseEnter={() => setActive(index)}
            onClick={() => void pick(hit)}
          >
            <Icon name="place" size={14} className="mt-0.5 shrink-0 text-[var(--md-secondary)]" />
            <span className="md-body min-w-0 text-[12px] leading-snug">{hit.label}</span>
          </button>
        ))}
    </>
  );

  const searchField = (
    <input
      ref={inputRef}
      type="search"
      className="md-field"
      value={query}
      disabled={saving}
      placeholder="Search for a city"
      autoComplete="off"
      spellCheck={false}
      aria-label="Search for a weather city"
      aria-expanded
      aria-controls="weather-city-results"
      onChange={(event) => setQuery(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );

  if (variant === "icon") {
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          className="md-icon-btn shrink-0"
          style={{ width: 26, height: 26 }}
          disabled={disabled}
          aria-label={`Change weather city, currently ${city}`}
          aria-expanded={open}
          onClick={() => (open ? close() : openSearch())}
        >
          <Icon name="search" size={15} />
        </button>
        {open && position && (
          <div
            ref={panelRef}
            id="weather-city-results"
            role="dialog"
            aria-label="Change weather city"
            className="md-sheet fixed z-[120] rounded-2xl p-3"
            style={{
              top: position.top,
              left: position.left,
              width: PANEL_WIDTH,
              background: "var(--md-container-high)",
              boxShadow: "var(--elev-4)",
            }}
          >
            {searchField}
            <div className="mt-1 max-h-56 overflow-y-auto">{results}</div>
          </div>
        )}
      </>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="md-field flex cursor-pointer items-center justify-between gap-2 text-left"
        disabled={disabled}
        onClick={openSearch}
        aria-label={`Change weather city, currently ${city}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon name="search" size={16} />
          <span className="truncate">{city}</span>
        </span>
        <span className="md-label-sm shrink-0">Change</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="min-w-0">
      {searchField}
      <div
        id="weather-city-results"
        className="mt-1 max-h-56 overflow-y-auto rounded-xl py-1"
        style={{ background: "var(--md-container-high)", boxShadow: "var(--elev-2)" }}
      >
        {results}
      </div>
    </div>
  );
}
