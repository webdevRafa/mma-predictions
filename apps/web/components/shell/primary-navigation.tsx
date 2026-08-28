"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { isNavigationPathActive } from "@/lib/navigation";

const navigation = [
  {
    href: "/events",
    label: "Events",
    paths: ["/events", "/fights", "/fighters"],
  },
  {
    href: "/articles",
    label: "Articles",
    paths: ["/articles"],
  },
  {
    href: "/discussions",
    label: "Discussions",
    paths: ["/discussions"],
  },
  {
    href: "/leaderboards",
    label: "Leaderboards",
    paths: ["/leaderboards"],
  },
];

function PrimaryNavigationLinks({ pathname }: { pathname?: string }) {
  return (
    <nav
      aria-label="Primary navigation"
      className="ml-6 hidden items-center gap-1 md:flex"
    >
      {navigation.map((item) => {
        const active = pathname
          ? isNavigationPathActive(pathname, item.paths)
          : false;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring rounded-lg px-3 py-2 text-sm font-semibold transition",
              active
                ? "bg-fl-accent-soft text-fl-accent"
                : "text-fl-text-muted hover:bg-fl-surface-2 hover:text-fl-text",
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PrimaryNavigation() {
  return <PrimaryNavigationLinks pathname={usePathname()} />;
}

export function PrimaryNavigationFallback() {
  return <PrimaryNavigationLinks />;
}
