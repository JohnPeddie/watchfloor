import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Watchfloor — Intelligence Dashboard",
  description:
    "Personal all-source intelligence dashboard: UK defence, energy, cyber, conflict and market reporting with geospatial plotting.",
  applicationName: "Watchfloor",
  appleWebApp: { capable: true, title: "Watchfloor", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The globe is a pan/zoom surface, so page-level pinch zoom fights with it.
  maximumScale: 1,
  themeColor: "#0b0e11",
  // Extends under the Fold punch-hole and rounded corners.
  viewportFit: "cover",
  // Keyboard on the cover should shrink the list, not overlay the field.
  interactiveWidget: "resizes-content",
};

/**
 * Applies the saved theme before first paint. Without this the page renders
 * dark and then snaps to light, which is worse than either scheme.
 */
const THEME_BOOTSTRAP = `
try {
  var saved = localStorage.getItem('watchfloor:theme');
  var theme = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${roboto.variable} ${robotoMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
