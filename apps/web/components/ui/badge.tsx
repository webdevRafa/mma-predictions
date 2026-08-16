import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-fl-border bg-fl-surface-2 text-fl-text-muted",
  accent: "border-fl-accent/30 bg-fl-accent-soft text-[#ff8b73]",
  success: "border-fl-success/30 bg-fl-success/10 text-fl-success",
  warning: "border-fl-warning/30 bg-fl-warning/10 text-fl-warning",
  info: "border-fl-info/30 bg-fl-info/10 text-fl-info",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 font-mono text-[10px] leading-none font-semibold tracking-[0.08em] uppercase",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
