import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

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
  metadataBase: new URL("https://fightlobby.com"),
  title: {
    default: "FightLobby — Every fight has a lobby",
    template: "%s | FightLobby",
  },
  description:
    "Make UFC predictions, compare the community consensus, and join a lobby built for every matchup.",
  applicationName: "FightLobby",
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
        <SiteHeader />
        {children}
        <SiteFooter />
        <MobileNavigation />
      </body>
    </html>
  );
}
