import {
  Activity,
  ClipboardList,
  DatabaseZap,
  Flag,
  Gauge,
  Import,
  Landmark,
  Shield,
  Swords,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { requireAdminPage } from "@/lib/admin/auth";

const links = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/events", label: "Events", icon: Swords },
  { href: "/admin/fighters", label: "Fighters", icon: UserRound },
  { href: "/admin/data-sync", label: "Data sync", icon: DatabaseZap },
  { href: "/admin/import", label: "Import", icon: Import },
  { href: "/admin/moderation", label: "Moderation", icon: Shield },
  { href: "/admin/feature-flags", label: "Flags", icon: Flag },
  { href: "/admin/audit", label: "Audit", icon: ClipboardList },
  { href: "/admin/leaderboards", label: "Boards", icon: Activity },
  { href: "/admin/costs", label: "Costs", icon: Landmark },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage("/admin");
  return (
    <div className="shell py-8 sm:py-12">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">FightLobby operations</p>
          <p className="mt-1 text-sm text-fl-text-muted">
            Server-authorized · reason required · audit retained
          </p>
        </div>
        <span className="rounded-full border border-fl-danger/40 bg-fl-danger/10 px-3 py-1.5 font-mono text-[10px] tracking-[.08em] text-fl-danger uppercase">
          Admin
        </span>
      </div>
      <nav
        aria-label="Admin navigation"
        className="mb-8 flex gap-2 overflow-x-auto pb-2"
      >
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-lg border border-fl-border bg-fl-surface-1 px-3 py-2.5 text-xs font-bold text-fl-text-muted hover:border-fl-accent/50 hover:text-fl-text"
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" size={14} /> {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
