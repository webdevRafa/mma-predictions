import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { requireOnboardedSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

const navigation: [string, string][] = [
  ["/settings", "Account"],
  ["/settings/profile", "Public profile"],
  ["/settings/notifications", "Notifications"],
  ["/settings/privacy", "Privacy"],
  ["/settings/blocked-users", "Blocked users"],
];

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireOnboardedSession("/settings");
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <header>
        <p className="eyebrow">Private account area</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-6xl">
          SETTINGS
        </h1>
        <p className="mt-3 text-sm text-fl-text-muted">
          Signed in as @{session.handle}
        </p>
      </header>
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings"
          className="flex gap-2 overflow-x-auto lg:flex-col"
        >
          {navigation.map(([href, label]) => (
            <Link
              className="focus-ring shrink-0 rounded-lg border border-fl-border bg-fl-surface-1 px-4 py-3 text-sm font-semibold text-fl-text-muted transition hover:border-fl-accent hover:text-fl-text"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
