"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { HelpButton } from "@/components/HelpButton";
import type { OpsSnapshot } from "@/lib/serializers";
import { DEFAULT_SETTINGS, INGEST_INTERVALS, type WatchfloorSettings } from "@/lib/settings-types";
import { hostLabel, humanizeModelName } from "@/lib/model-label";

type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
};

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-GB");
}

function fmtWhen(iso: string | null, timeZone: string): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function timeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [draft, setDraft] = useState<WatchfloorSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error(`Stats HTTP ${res.status}`);
    const data = (await res.json()) as OpsSnapshot;
    setSnapshot(data);
    setDraft(data.settings);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
    const id = setInterval(() => {
      void load().catch(() => undefined);
    }, 15_000);
    return () => clearInterval(id);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function save(next: WatchfloorSettings) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`Save HTTP ${res.status}`);
      setDraft(next);
      setSavedAt(Date.now());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function patch(partial: Partial<WatchfloorSettings>) {
    const next = { ...draft, ...partial };
    setDraft(next);
    void save(next);
  }

  if (!open) return null;

  const tz = snapshot?.timezone ?? "Europe/London";
  const llm = snapshot?.llm;
  const collection = snapshot?.collection;
  const brief = snapshot?.brief;
  const schedule = snapshot?.schedule;

  return (
    <div className="fixed inset-0 z-[130]" role="presentation">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "var(--md-scrim)" }}
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Watchfloor settings"
        className="absolute inset-y-0 left-0 flex w-[min(100%,420px)] flex-col overflow-hidden"
        style={{
          background: "var(--md-container-low)",
          boxShadow: "var(--elev-5)",
          animation: "md-drawer-in 180ms cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        <header
          className="flex shrink-0 items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--md-outline-variant)" }}
        >
          <div>
            <div className="md-title-lg">Settings</div>
            <div className="md-label-sm">Schedules and local LLM stats · {tz}</div>
          </div>
          <div className="flex items-center gap-1">
            <HelpButton topic="settings" />
            <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close settings">
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {error && (
            <p className="md-body rounded-xl px-3 py-2 text-[12px]" style={{ background: "var(--md-error-container)", color: "var(--md-error)" }}>
              {error}
            </p>
          )}

          <section className="md-pane shrink-0">
            <div className="md-pane-head">
              <div className="md-title-lg flex items-center gap-2">
                <Icon name="refresh" size={18} className="text-[var(--md-primary)]" />
                News sync
              </div>
              <button
                type="button"
                className="md-switch"
                role="switch"
                aria-checked={draft.ingestEnabled}
                aria-label="Periodic news refresh"
                onClick={() => patch({ ingestEnabled: !draft.ingestEnabled })}
              />
            </div>
            <div className="space-y-3 px-3 pb-3">
              <label className="block">
                <div className="md-label-sm mb-1">How often</div>
                <select
                  className="md-field"
                  disabled={!draft.ingestEnabled || saving}
                  value={draft.ingestIntervalMinutes}
                  onChange={(event) => patch({ ingestIntervalMinutes: Number(event.target.value) })}
                >
                  {INGEST_INTERVALS.map((option) => (
                    <option key={option.minutes} value={option.minutes}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <StatGrid
                items={[
                  { label: "Articles today", value: String(collection?.pulledToday ?? "—") },
                  { label: "New this cycle", value: String(collection?.createdToday ?? "—") },
                  { label: "Holdings", value: String(collection?.holdings ?? "—") },
                  { label: "Last sync", value: fmtDuration(collection?.lastIngestDurationMs) },
                ]}
              />
              <p className="md-label-sm">
                {draft.ingestEnabled
                  ? `Next ${schedule?.ingestDue ? "due now" : fmtWhen(schedule?.nextIngestAt ?? null, tz)}`
                  : "Periodic refresh is paused"}
                {schedule?.lastIngestAt ? ` · last ${fmtWhen(schedule.lastIngestAt, tz)}` : ""}
              </p>
            </div>
          </section>

          <section className="md-pane shrink-0">
            <div className="md-pane-head">
              <div className="md-title-lg flex items-center gap-2">
                <Icon name="schedule" size={18} className="text-[var(--md-secondary)]" />
                Daily briefing
              </div>
              <button
                type="button"
                className="md-switch"
                role="switch"
                aria-checked={draft.briefEnabled}
                aria-label="Scheduled briefing"
                onClick={() => patch({ briefEnabled: !draft.briefEnabled })}
              />
            </div>
            <div className="space-y-3 px-3 pb-3">
              <label className="block">
                <div className="md-label-sm mb-1">Run at (local morning)</div>
                <input
                  type="time"
                  className="md-field"
                  disabled={!draft.briefEnabled || saving}
                  value={timeValue(draft.briefHour, draft.briefMinute)}
                  onChange={(event) => {
                    const [hour, minute] = event.target.value.split(":").map(Number);
                    patch({
                      briefHour: Number.isFinite(hour) ? hour : 6,
                      briefMinute: Number.isFinite(minute) ? minute : 0,
                    });
                  }}
                />
              </label>
              <StatGrid
                items={[
                  { label: "Runs today", value: String(brief?.runsToday ?? "—") },
                  { label: "Last duration", value: fmtDuration(brief?.lastDurationMs) },
                  { label: "Stories", value: brief?.lastStories != null ? String(brief.lastStories) : "—" },
                  {
                    label: "Writer",
                    value: brief?.lastFellBack
                      ? "Rules engine (fallback)"
                      : brief?.lastModel
                        ? humanizeModelName(brief.lastModel)
                        : brief?.lastProvider
                          ? hostLabel(brief.lastProvider)
                          : "—",
                  },
                ]}
              />
              <p className="md-label-sm">
                {draft.briefEnabled
                  ? `Next ${schedule?.briefDue ? "due now" : fmtWhen(schedule?.nextBriefAt ?? null, tz)}`
                  : "Scheduled briefing is paused"}
                {schedule?.lastBriefAt ? ` · last ${fmtWhen(schedule.lastBriefAt, tz)}` : ""}
              </p>
            </div>
          </section>

          <section className="md-pane shrink-0">
            <div className="md-pane-head">
              <div className="md-title-lg flex items-center gap-2">
                <Icon name="insights" size={18} className="text-[var(--md-tertiary)]" />
                Local LLM
              </div>
              <span
                className="md-mono rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  background: llm?.reachable ? "var(--md-secondary-container)" : "var(--md-container-high)",
                  color: llm?.reachable ? "var(--md-on-secondary-container)" : "var(--md-on-surface-variant)",
                }}
              >
                {llm?.reachable ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>
            <div className="space-y-3 px-3 pb-3">
              <p className="md-body text-[12px] leading-relaxed">
                {llm?.label
                  ? `${llm.label}${
                      llm.lastModel || llm.model
                        ? ` · ${humanizeModelName(llm.lastModel ?? llm.model ?? "")}`
                        : ""
                    }`
                  : "No local model host configured"}
                {llm?.probeMs != null ? ` · probe ${fmtDuration(llm.probeMs)}` : ""}
              </p>
              {llm?.detail && !llm.reachable && (
                <p className="md-label-sm" style={{ color: "var(--md-error)" }}>
                  {llm.detail}
                </p>
              )}
              <StatGrid
                items={[
                  { label: "Calls today", value: String(llm?.callsToday ?? 0) },
                  { label: "Tokens today", value: fmtTokens(llm?.totalTokensToday ?? 0) },
                  { label: "Prompt tokens", value: fmtTokens(llm?.promptTokensToday ?? 0) },
                  { label: "Completion", value: fmtTokens(llm?.completionTokensToday ?? 0) },
                  { label: "LLM time today", value: fmtDuration(llm?.durationMsToday ?? 0) },
                  { label: "Last call", value: fmtDuration(llm?.lastCallMs) },
                ]}
              />
            </div>
          </section>

          <p className="md-label-sm px-1 pb-2">
            Schedules run while the Watchfloor server is up. They pause if you stop{" "}
            <span className="md-mono">npm run dev</span>.
            {savedAt ? " · Saved." : ""}
          </p>
        </div>
      </aside>
    </div>
  );
}

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl px-2.5 py-2"
          style={{ background: "var(--md-container)" }}
        >
          <div className="md-label-sm">{item.label}</div>
          <div className="md-mono truncate text-[14px] font-medium" title={item.value}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
