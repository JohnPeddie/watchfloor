import type { MetadataRoute } from "next";

/**
 * Chrome on Android will only honour this as a real installed app (no URL bar)
 * when the page is served over HTTPS. On plain HTTP, Add to Home screen is a
 * bookmark — use the in-app fullscreen control instead.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Watchfloor",
    short_name: "Watchfloor",
    description:
      "Personal all-source intelligence dashboard: UK defence, energy, cyber, conflict and market reporting.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    prefer_related_applications: false,
    orientation: "any",
    background_color: "#0b0e11",
    theme_color: "#0b0e11",
    categories: ["news", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
