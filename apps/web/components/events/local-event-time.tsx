"use client";

import { useEffect, useState } from "react";

import { formatEventDate, formatEventDateCompact } from "@/lib/format";

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
  const [displayTimezone, setDisplayTimezone] = useState(venueTimezone);

  useEffect(() => {
    const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDisplayTimezone(visitorTimezone || venueTimezone);
  }, [venueTimezone]);

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
