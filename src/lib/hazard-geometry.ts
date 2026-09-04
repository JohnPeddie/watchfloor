export type HazardKind = "warzone" | "storm";
export type HazardSeverity = "high" | "extreme";

export type HazardMark = {
  id: string;
  kind: HazardKind;
  label: string;
  detail: string;
  lat: number;
  lng: number;
  radiusKm: number;
  severity: HazardSeverity;
};

export type HazardsPayload = {
  warzones: HazardMark[];
  storms: HazardMark[];
  fetchedAt: string;
};

/**
 * Approximate a filled disc on the globe for a warzone or storm radius.
 */
export function hazardDisc(mark: HazardMark, steps = 36): {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: number[][][] };
} {
  const R = 6371;
  const ring: number[][] = [];
  const φ1 = (mark.lat * Math.PI) / 180;
  const λ1 = (mark.lng * Math.PI) / 180;
  const δ = mark.radiusKm / R;
  for (let i = 0; i <= steps; i++) {
    const θ = (i / steps) * 2 * Math.PI;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 =
      λ1 +
      Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    ring.push([((λ2 * 180) / Math.PI + 540) % 360 - 180, (φ2 * 180) / Math.PI]);
  }
  return {
    type: "Feature",
    properties: {
      layer: mark.kind,
      severity: mark.severity,
      id: mark.id,
      label: mark.label,
    },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
