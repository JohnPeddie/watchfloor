"use client";

import { PRECEDENCE_STYLES, TAG_STYLES, type Precedence, type Tag } from "@/lib/classify";

export function TagChip({ tag }: { tag: Tag }) {
  const style = TAG_STYLES[tag];
  if (!style) return null;
  return (
    <span
      className="md-chip"
      style={{ color: style.fg, background: style.bg, borderColor: style.border }}
    >
      {tag}
    </span>
  );
}

export function TagChips({ tags, max = 4 }: { tags: Tag[]; max?: number }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {tags.slice(0, max).map((t) => (
        <TagChip key={t} tag={t} />
      ))}
    </span>
  );
}

export function PrecedenceChip({
  precedence,
  dense,
}: {
  precedence: Precedence;
  dense?: boolean;
}) {
  const style = PRECEDENCE_STYLES[precedence] ?? PRECEDENCE_STYLES.ROUTINE;
  return (
    <span
      className={`md-chip ${precedence === "FLASH" ? "md-pulse" : ""}`}
      style={{
        color: style.fg,
        background: style.bg,
        borderColor: style.fg,
        height: dense ? 20 : 24,
        fontSize: dense ? 9.5 : 10,
      }}
    >
      {precedence}
    </span>
  );
}

export function GradeChip({ grade }: { grade: string }) {
  return (
    <span
      className="md-chip md-mono"
      title="Admiralty grading — source reliability / information credibility"
      style={{ height: 20, fontSize: 9.5, color: "var(--md-outline)" }}
    >
      {grade}
    </span>
  );
}
