import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { AnalyticsRuntime } from "@/features/analytics/analytics-runtime";
import { ConsentProvider } from "@/features/privacy/consent-provider";
import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

import "./globals.css";

const bodyFont = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body",
});
const displayFont = Barlow_Condensed({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});
const monoFont = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
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
