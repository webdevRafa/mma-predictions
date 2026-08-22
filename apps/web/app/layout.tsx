import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { AnalyticsRuntime } from "@/features/analytics/analytics-runtime";
import { ConsentProvider } from "@/features/privacy/consent-provider";
import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

import "./globals.css";

// Public route shells may be shared briefly. Authenticated widgets establish
// their own client/server sessions, while admin and account routes opt into
// dynamic rendering in their route segments.
export const revalidate = 30;

const bodyFont = localFont({
  display: "swap",
  fallback: ["Arial", "sans-serif"],
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-body",
  weight: "100 900",
});
const displayFont = localFont({
  display: "swap",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
  src: [
    {
      path: "./fonts/barlow-condensed-latin-600-normal.woff2",
      style: "normal",
      weight: "600",
    },
    {
      path: "./fonts/barlow-condensed-latin-700-normal.woff2",
      style: "normal",
      weight: "700",
    },
    {
      path: "./fonts/barlow-condensed-latin-800-normal.woff2",
      style: "normal",
      weight: "800",
    },
  ],
  variable: "--font-display",
});
const monoFont = localFont({
  display: "swap",
  fallback: ["Consolas", "Courier New", "monospace"],
  src: [
    {
      path: "./fonts/ibm-plex-mono-latin-500-normal.woff2",
      style: "normal",
      weight: "500",
    },
    {
      path: "./fonts/ibm-plex-mono-latin-600-normal.woff2",
      style: "normal",
      weight: "600",
    },
  ],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FightLobby — UFC predictions and live fight chat",
    template: "%s | FightLobby",
  },
  description:
    "Make UFC predictions, compare picks, and join live matchup chats with the FightLobby community.",
  applicationName: "FightLobby",
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "FightLobby",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080A0D",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
    >
      <body>
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${absoluteUrl("/")}#organization`,
              name: "FightLobby",
              url: absoluteUrl("/"),
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${absoluteUrl("/")}#website`,
              name: "FightLobby",
              url: absoluteUrl("/"),
              publisher: { "@id": `${absoluteUrl("/")}#organization` },
            },
          ]}
        />
        <ConsentProvider>
          <AnalyticsRuntime />
          <SiteHeader />
          {children}
          <SiteFooter />
          <MobileNavigation />
        </ConsentProvider>
      </body>
    </html>
  );
}
