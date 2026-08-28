import { cn } from "@/lib/cn";

export type StatusValue =
  | "draft"
  | "scheduled"
  | "prefight"
  | "walkouts"
  | "intros"
  | "in_progress"
  | "end_of_round"
  | "live"
  | "up_next"
  | "completed"
  | "final"
  | "postponed"
  | "canceled";

const labels: Record<StatusValue, string> = {
  draft: "Draft",
  live: "Live",
  up_next: "Up next",
  scheduled: "Scheduled",
  prefight: "Pre-fight",
  walkouts: "Walkouts",
  intros: "Introductions",
  in_progress: "Live",
  end_of_round: "Round break",
  completed: "Final",
  final: "Final",
  postponed: "Postponed",
  canceled: "Canceled",
};

const classes: Record<StatusValue, string> = {
  draft: "border-fl-border/75 bg-fl-surface-2/55 text-fl-text-dim",
  live: "border-fl-live/25 bg-fl-live/[0.06] text-[#d7798a]",
  up_next: "border-fl-warning/20 bg-fl-warning/[0.05] text-fl-warning/75",
  scheduled: "border-fl-info/20 bg-fl-info/[0.05] text-fl-info/75",
  prefight: "border-fl-warning/20 bg-fl-warning/[0.05] text-fl-warning/75",
  walkouts: "border-fl-live/25 bg-fl-live/[0.06] text-[#d7798a]",
  intros: "border-fl-live/25 bg-fl-live/[0.06] text-[#d7798a]",
  in_progress: "border-fl-live/25 bg-fl-live/[0.06] text-[#d7798a]",
  end_of_round: "border-fl-live/25 bg-fl-live/[0.06] text-[#d7798a]",
  completed: "border-fl-success/15 bg-fl-success/[0.035] text-fl-success/70",
  final: "border-fl-success/15 bg-fl-success/[0.035] text-fl-success/70",
  postponed: "border-fl-warning/20 bg-fl-warning/[0.05] text-fl-warning/75",
  canceled: "border-fl-border/75 bg-fl-surface-2/55 text-fl-text-dim",
};

export function StatusPill({ status }: { status: StatusValue }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[9px] font-medium tracking-[0.1em] uppercase",
        classes[status],
      )}
    >
      {["live", "walkouts", "intros", "in_progress", "end_of_round"].includes(
        status,
      ) ? (
        <span className="live-dot" aria-hidden="true" />
      ) : null}
      {labels[status]}
    </span>
  );
}
