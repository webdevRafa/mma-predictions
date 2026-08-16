import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-fl-border bg-fl-surface-1 shadow-[0_24px_70px_rgba(0,0,0,0.22)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <header className="border-b border-fl-border px-5 py-4 sm:px-6">
      {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
      <h2 className="font-display text-2xl leading-none font-bold tracking-[0.01em] text-fl-text">
        {title}
      </h2>
      {description ? (
        <div className="mt-2 text-sm text-fl-text-muted">{description}</div>
      ) : null}
    </header>
  );
}
