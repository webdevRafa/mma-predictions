import { ArrowRight, CalendarDays, MessageCircle, Target, Trophy } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";

const benefits = [
  { icon: Target, label: "Make the call", copy: "Pick the winner, method, and finish detail before walkouts." },
  { icon: MessageCircle, label: "Join the room", copy: "Every matchup has a focused lobby for live reactions." },
  { icon: Trophy, label: "Keep receipts", copy: "Build an honest record of points, accuracy, and streaks." },
];

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="relative overflow-hidden border-b border-fl-border">
        <div aria-hidden="true" className="arena-grid absolute inset-0 opacity-45" />
        <div className="shell relative grid min-h-[calc(100vh-4.5rem)] items-center gap-12 py-16 lg:grid-cols-[1.04fr_.96fr] lg:py-24">
          <div className="max-w-3xl">
            <Badge tone="accent">UFC launch edition</Badge>
            <h1 className="mt-6 font-display text-[clamp(4rem,10vw,8.8rem)] leading-[0.78] font-extrabold tracking-[-0.035em] text-balance">EVERY FIGHT<span className="block text-fl-accent">HAS A LOBBY.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-fl-text-muted sm:text-lg">Make your pick before the walkout, reveal the community read, and own the record afterward.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-fl-accent px-5 text-sm font-bold text-fl-bg shadow-[0_10px_28px_rgba(255,90,54,0.18)] transition hover:bg-fl-accent-strong" href="/events">Explore the next card <ArrowRight aria-hidden="true" size={17} /></Link>
              <Link className="focus-ring inline-flex min-h-12 items-center rounded-[10px] border border-fl-border bg-fl-surface-1 px-5 text-sm font-bold text-fl-text transition hover:border-fl-text-muted hover:bg-fl-surface-2" href="/design-system">View the system</Link>
            </div>
          </div>
          <Card className="relative overflow-hidden lg:ml-auto lg:w-full lg:max-w-xl">
            <div className="flex items-center justify-between border-b border-fl-border px-5 py-4">
              <div><p className="eyebrow">Next event</p><h2 className="font-display text-2xl leading-none font-bold">Card loading</h2></div>
              <StatusPill status="scheduled" />
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-fl-border bg-fl-surface-2 p-4">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.08em] text-fl-text-muted uppercase"><CalendarDays aria-hidden="true" size={14} /> Fixture provider connecting next</div>
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                  <div><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-8 w-full" /></div><span className="font-display text-xl font-extrabold text-fl-text-dim">VS</span><div><Skeleton className="ml-auto h-3 w-20" /><Skeleton className="mt-3 h-8 w-full" /></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">{["Fight card", "Community", "Lobby"].map((label) => <div className="rounded-lg border border-fl-border bg-fl-surface-2 px-3 py-3 text-center text-[11px] font-semibold text-fl-text-muted" key={label}>{label}</div>)}</div>
            </div>
          </Card>
        </div>
      </section>
      <section className="shell py-16 sm:py-20">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-fl-border bg-fl-border md:grid-cols-3">
          {benefits.map(({ copy, icon: Icon, label }) => <article className="bg-fl-surface-1 p-6 sm:p-8" key={label}><Icon aria-hidden="true" className="text-fl-accent" size={22} /><h2 className="mt-5 font-display text-2xl font-bold">{label}</h2><p className="mt-2 text-sm leading-6 text-fl-text-muted">{copy}</p></article>)}
        </div>
      </section>
    </main>
  );
}
