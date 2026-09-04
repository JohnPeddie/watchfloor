"use client";

import { TAG_STYLES, type Precedence, type Tag } from "@/lib/classify";

/**
 * Colour comes from a per-hue CSS class rather than inline styles, so the
 * chips re-tint themselves when the theme changes. See `.md-chip-hue`.
 */
export function TagChip({ tag }: { tag: Tag }) {
  if (!TAG_STYLES[tag]) return null;
  return <span className={`md-chip md-chip-hue hue-${tag}`}>{tag}</span>;
}

export function TagChips({
  tags,
  max = 4,
  wrap = true,
}: {
  tags: Tag[];
  max?: number;
  wrap?: boolean;
}) {
  return (
    <span className={`inline-flex gap-1.5 ${wrap ? "flex-wrap" : "max-w-full flex-nowrap overflow-hidden"}`}>
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
  return (
    <span
      className={`md-chip md-chip-hue is-strong hue-${precedence} ${
        precedence === "FLASH" ? "md-pulse" : ""
      }`}
      style={{ height: dense ? 20 : 24, fontSize: dense ? 9.5 : 10 }}
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
