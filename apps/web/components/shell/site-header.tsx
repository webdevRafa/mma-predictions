import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { listPublicEvents } from "@/lib/data/public";
import { AuthMenu } from "@/features/auth/auth-menu";

import { OfflineBanner } from "./offline-banner";

const navigation = [
  { href: "/events", label: "Events" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export async function SiteHeader() {
  const events = await listPublicEvents();
  const activeEvent =
    events.find((event) => event.status === "live") ??
    events.find((event) => event.status === "scheduled");
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <OfflineBanner />
      <header className="sticky top-0 z-40 border-b border-fl-border/80 bg-fl-bg/92 backdrop-blur-xl">
        <div className="shell flex h-16 items-center gap-4 sm:h-[72px]">
          <Link
            aria-label="FightLobby home"
            className="group flex shrink-0 items-center rounded-xl"
            href="/"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(224,12,15,0.2)] transition duration-200 group-hover:scale-[1.04] group-hover:drop-shadow-[0_0_16px_rgba(224,12,15,0.34)] sm:h-14"
              height={2802}
              preload
              sizes="(max-width: 639px) 49px, 57px"
              src="/brand/fightlobby-mark.png"
              width={2859}
            />
          </Link>
          <nav
            aria-label="Primary navigation"
            className="ml-6 hidden items-center gap-1 md:flex"
          >
            {navigation.map((item) => (
              <Link
                className="focus-ring rounded-lg px-3 py-2 text-sm font-semibold text-fl-text-muted transition hover:bg-fl-surface-2 hover:text-fl-text"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {activeEvent ? (
            <Link
              className="ml-auto hidden items-center gap-2 rounded-full border border-fl-live/30 bg-fl-live/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-[#ff8398] uppercase lg:flex"
              href={`/events/${activeEvent.slug}`}
            >
              {activeEvent.status === "live" ? (
                <span aria-hidden="true" className="live-dot" />
              ) : null}
              {activeEvent.status === "live" ? "Live now" : "Next UFC event"}
            </Link>
          ) : null}
          <Link
            aria-label="Search FightLobby"
            className="focus-ring ml-auto grid size-10 cursor-pointer place-items-center rounded-lg text-fl-text-muted hover:bg-fl-surface-2 hover:text-fl-text lg:ml-0"
            href="/search"
          >
            <Search aria-hidden="true" size={18} />
          </Link>
          <AuthMenu />
        </div>
      </header>
    </>
  );
}
