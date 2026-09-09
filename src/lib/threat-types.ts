export type ThreatBand = "low" | "moderate" | "substantial" | "severe" | "critical";

export type ThreatPayload = {
  level: ThreatBand | null;
  meaning: string;
  northernIreland: ThreatBand | null;
  source: string;
  sourceUrl: string;
  changedAt: string | null;
  fetchedAt: string;
};

export const THREAT_MEANINGS: Record<ThreatBand, string> = {
  low: "An attack is highly unlikely",
  moderate: "An attack is possible, but not likely",
  substantial: "An attack is likely",
  severe: "An attack is highly likely",
  critical: "An attack is highly likely in the near future",
};

export const THREAT_SOURCE_URL = "https://www.mi5.gov.uk/threats-and-advice/terrorism-threat-levels";
