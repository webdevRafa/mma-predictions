"use client";

import {
  CalendarDays,
  Home,
  MessageSquareText,
  Newspaper,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { isNavigationPathActive } from "@/lib/navigation";

const items = [
  { href: "/", label: "Home", icon: Home, paths: ["/"] },
  {
    href: "/events",
    label: "Events",
    icon: CalendarDays,
    paths: ["/events", "/fights", "/fighters"],
  },
  {
    href: "/articles",
    label: "Articles",
    icon: Newspaper,
    paths: ["/articles"],
  },
  {
    href: "/discussions",
    label: "Discuss",
    icon: MessageSquareText,
    paths: ["/discussions"],
  },
  {
    href: "/leaderboards",
    label: "Ranks",
    icon: Trophy,
    paths: ["/leaderboards"],
  },
];

function MobileNavigationLinks({ pathname }: { pathname?: string }) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-fl-border bg-fl-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        {items.map(({ href, icon: Icon, label, paths }) => {
          const active = pathname
            ? isNavigationPathActive(pathname, paths)
            : false;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition",
                active
                  ? "bg-gradient-to-b from-fl-accent-soft to-transparent text-fl-accent"
                  : "text-fl-text-muted hover:text-fl-text",
              )}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileNavigation() {
  return <MobileNavigationLinks pathname={usePathname()} />;
}

export function MobileNavigationFallback() {
  return <MobileNavigationLinks />;
}
