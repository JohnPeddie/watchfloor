import type { NextConfig } from "next";

/**
 * Every address a client on this network can legitimately reach the dev server
 * from: RFC1918, Docker bridges, CGNAT overlays, and .local hostnames.
 */
const privateDevOrigins = [
  "10.*.*.*",
  "192.168.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  "100.*.*.*",
  "*.local",
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Dev-only. Next blocks cross-origin requests for /_next/* assets unless the
  // origin is listed, which otherwise breaks loading the dev server from a
  // phone or tablet by IP or hostname.
  allowedDevOrigins: privateDevOrigins,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [{ key: "Permissions-Policy", value: "fullscreen=(self)" }],
      },
    ];
  },
};

export default nextConfig;
