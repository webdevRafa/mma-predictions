import { cn } from "@/lib/cn";

type FightStatus = "live" | "up_next" | "scheduled" | "final" | "canceled";

const labels: Record<FightStatus, string> = {
  live: "Live",
  up_next: "Up next",
  scheduled: "Scheduled",
  final: "Final",
  canceled: "Canceled",
};

const classes: Record<FightStatus, string> = {
  live: "border-fl-live/40 bg-fl-live/12 text-[#ff7590]",
  up_next: "border-fl-warning/35 bg-fl-warning/10 text-fl-warning",
  scheduled: "border-fl-info/30 bg-fl-info/10 text-fl-info",
  final: "border-fl-success/30 bg-fl-success/10 text-fl-success",
  canceled: "border-fl-border bg-fl-surface-2 text-fl-text-muted",
};

export function StatusPill({ status }: { status: FightStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-full border px-3 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase",
        classes[status],
      )}
    >
      {status === "live" ? <span className="live-dot" aria-hidden="true" /> : null}
      {labels[status]}
    </span>
  );
}
