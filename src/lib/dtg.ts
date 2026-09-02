const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** Military date-time group, e.g. 311845Z AUG 26 */
export function dtg(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  const mon = MONTHS[date.getUTCMonth()];
  const y = String(date.getUTCFullYear()).slice(2);
  return `${d}${h}${m}Z ${mon} ${y}`;
}

/** Compact DTG for dense tables, e.g. 311845Z */
export function dtgShort(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  return `${d}${h}${m}Z`;
}

/** Serial reference, e.g. WF/26-0831/0142 */
export function serialRef(seed: string, date: Date, index: number): string {
  const y = String(date.getUTCFullYear()).slice(2);
  const md =
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");
  const n = String(Math.abs(hash(seed) + index) % 9999).padStart(4, "0");
  return `WF/${y}-${md}/${n}`;
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return h;
}
