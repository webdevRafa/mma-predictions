"use client";

import { useEffect, useState } from "react";

import {
  eventCountdownLabel,
  type EventScheduleInput,
} from "@/lib/events/timing";

export function EventCountdown({
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
    <time dateTime={event.prelimsStartsAt ?? event.startsAt}>
      {eventCountdownLabel(event, now)}
    </time>
  );
}
