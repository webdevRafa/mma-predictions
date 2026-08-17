"use client";

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
  const label =
    typeof window === "undefined"
      ? formatter(startsAt, venueTimezone)
      : formatter(startsAt);

  return (
    <time
      dateTime={startsAt}
      suppressHydrationWarning
      title={`Shown in your local time after page load. Venue time zone: ${venueTimezone}`}
    >
      {label}
    </time>
  );
}
