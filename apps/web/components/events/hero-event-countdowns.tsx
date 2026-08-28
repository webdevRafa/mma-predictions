"use client";

import { useEffect, useState } from "react";

import {
  heroEventCountdownRows,
  type EventScheduleInput,
} from "@/lib/events/timing";

export function HeroEventCountdowns({
  renderedAt,
  ...event
}: EventScheduleInput & { renderedAt: number }) {
  const [now, setNow] = useState(renderedAt);
  const rows = heroEventCountdownRows(event, now);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      aria-label="Event countdowns"
      className="border-y border-fl-border lg:ml-auto lg:w-full lg:max-w-xl"
    >
      {rows.map((row, index) => (
        <div
          className={`flex min-h-28 items-center justify-between gap-6 py-7 sm:min-h-32 sm:py-8 ${index > 0 ? "border-t border-fl-border" : ""}`}
          key={row.label}
        >
          <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-fl-text-dim uppercase sm:text-xs">
            {row.label}
          </span>
          <time
            className="text-right font-display text-[clamp(1.75rem,3vw,2.75rem)] leading-none font-semibold tracking-[-0.015em] text-fl-text/90"
            dateTime={row.dateTime}
          >
            {row.value}
          </time>
        </div>
      ))}
    </div>
  );
}
