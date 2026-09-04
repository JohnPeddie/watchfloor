export type FloorView = "brief" | "articles" | "markets";

export const FLOOR_VIEWS: { id: FloorView; label: string; short: string; icon: string }[] = [
  { id: "brief", label: "Daily brief", short: "Brief", icon: "article" },
  { id: "articles", label: "Articles", short: "Articles", icon: "radar" },
  { id: "markets", label: "Markets", short: "Markets", icon: "trending" },
];
