"use client";

import { useEffect, useState } from "react";

import {
  eventPhaseLabel,
  getEventTimingPhase,
  type EventScheduleInput,
} from "@/lib/events/timing";

export function EventPhaseLabel({
  renderedAt,
  ...event
}: EventScheduleInput & { renderedAt: number }) {
  const [now, setNow] = useState(renderedAt);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span data-event-phase={getEventTimingPhase(event, now)}>
      {eventPhaseLabel(getEventTimingPhase(event, now))}
    </span>
  );
}
