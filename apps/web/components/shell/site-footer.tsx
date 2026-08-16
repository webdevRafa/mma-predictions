import Link from "next/link";

const links = [
  ["About", "/about"],
  ["Community guidelines", "/community-guidelines"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Data corrections", "/data-corrections"],
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-fl-border bg-fl-surface-1/45 pb-20 md:pb-0">
      <div className="shell grid gap-8 py-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-xl">
          <p className="font-display text-xl font-extrabold tracking-[0.04em]">
            FIGHT<span className="text-fl-accent">LOBBY</span>
          </p>
          <p className="mt-3 text-sm leading-6 text-fl-text-muted">
            An independent UFC fan community for predictions and discussion.
            FightLobby is not affiliated with, endorsed by, or sponsored by UFC
            or Zuffa.
          </p>
          <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-fl-text-dim uppercase">
            No wagering. No guaranteed picks. Just your record.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex max-w-2xl flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-fl-text-muted"
        >
          {links.map(([label, href]) => (
            <Link
              className="focus-ring rounded hover:text-fl-text"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
