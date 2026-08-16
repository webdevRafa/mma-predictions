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
  draft: "border-fl-border bg-fl-surface-2 text-fl-text-muted",
  live: "border-fl-live/40 bg-fl-live/12 text-[#ff7590]",
  up_next: "border-fl-warning/35 bg-fl-warning/10 text-fl-warning",
  scheduled: "border-fl-info/30 bg-fl-info/10 text-fl-info",
  prefight: "border-fl-warning/35 bg-fl-warning/10 text-fl-warning",
  walkouts: "border-fl-live/40 bg-fl-live/12 text-[#ff7590]",
  intros: "border-fl-live/40 bg-fl-live/12 text-[#ff7590]",
  in_progress: "border-fl-live/40 bg-fl-live/12 text-[#ff7590]",
  end_of_round: "border-fl-live/40 bg-fl-live/12 text-[#ff7590]",
  completed: "border-fl-success/30 bg-fl-success/10 text-fl-success",
  final: "border-fl-success/30 bg-fl-success/10 text-fl-success",
  postponed: "border-fl-warning/35 bg-fl-warning/10 text-fl-warning",
  canceled: "border-fl-border bg-fl-surface-2 text-fl-text-muted",
};

export function StatusPill({ status }: { status: StatusValue }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-full border px-3 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase",
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
