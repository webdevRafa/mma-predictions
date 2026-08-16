import { CalendarDays, Home, Trophy, UserRound } from "lucide-react";
import Link from "next/link";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/leaderboards", label: "Ranks", icon: Trophy },
  { href: "/login", label: "Profile", icon: UserRound },
];

export function MobileNavigation() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-fl-border bg-fl-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid h-16 grid-cols-4">
        {items.map(({ href, icon: Icon, label }) => (
          <Link
            className="focus-ring flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-fl-text-muted hover:text-fl-text"
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" size={18} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
