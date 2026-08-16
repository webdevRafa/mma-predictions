import { CircleUserRound, Search } from "lucide-react";
import Link from "next/link";

import { OfflineBanner } from "./offline-banner";

const navigation = [
  { href: "/events", label: "Events" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <OfflineBanner />
      <header className="sticky top-0 z-40 border-b border-fl-border/80 bg-fl-bg/92 backdrop-blur-xl">
        <div className="shell flex h-16 items-center gap-4 sm:h-[72px]">
          <Link aria-label="FightLobby home" className="group flex shrink-0 items-center gap-2" href="/">
            <span aria-hidden="true" className="h-5 w-1 rounded-full bg-fl-accent transition group-hover:h-7" />
            <span className="font-display text-xl leading-none font-extrabold tracking-[0.035em] text-fl-text sm:text-2xl">FIGHT<span className="text-fl-accent">LOBBY</span></span>
          </Link>
          <nav aria-label="Primary navigation" className="ml-6 hidden items-center gap-1 md:flex">
            {navigation.map((item) => (
              <Link className="focus-ring rounded-lg px-3 py-2 text-sm font-semibold text-fl-text-muted transition hover:bg-fl-surface-2 hover:text-fl-text" href={item.href} key={item.href}>{item.label}</Link>
            ))}
          </nav>
          <Link className="ml-auto hidden items-center gap-2 rounded-full border border-fl-live/30 bg-fl-live/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-[#ff8398] uppercase lg:flex" href="/events">
            <span aria-hidden="true" className="live-dot" /> Next UFC event
          </Link>
          <button aria-label="Search FightLobby" className="focus-ring ml-auto grid size-10 cursor-pointer place-items-center rounded-lg text-fl-text-muted hover:bg-fl-surface-2 hover:text-fl-text lg:ml-0" type="button"><Search aria-hidden="true" size={18} /></button>
          <Link aria-label="Sign in" className="focus-ring grid size-10 place-items-center rounded-lg border border-fl-border bg-fl-surface-1 text-fl-text-muted hover:border-fl-text-muted hover:text-fl-text" href="/login"><CircleUserRound aria-hidden="true" size={19} /></Link>
        </div>
      </header>
    </>
  );
}
