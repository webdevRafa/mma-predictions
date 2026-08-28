"use client";

import { useSyncExternalStore } from "react";

import { formatEventDate, formatEventDateCompact } from "@/lib/format";

const subscribeToTimezone = () => () => undefined;

export function LocalEventTime({
  startsAt,
  venueTimezone,
  compact = false,
}: {
  startsAt: string;
  venueTimezone: string;
  compact?: boolean;
}) {
  const formatter = compact ? formatEventDateCompact : formatEventDate;
  const displayTimezone = useSyncExternalStore(
    subscribeToTimezone,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || venueTimezone,
    () => venueTimezone,
  );

  const label = formatter(startsAt, displayTimezone);

  return (
    <time
      data-time-zone={displayTimezone}
      dateTime={startsAt}
      suppressHydrationWarning
      title={`Shown in ${displayTimezone}. Venue time zone: ${venueTimezone}`}
    >
      {label}
    </time>
  );
}
