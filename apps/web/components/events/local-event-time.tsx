"use client";

import { formatEventDate } from "@/lib/format";

export function LocalEventTime({
  startsAt,
  venueTimezone,
}: {
  startsAt: string;
  venueTimezone: string;
}) {
  const label =
    typeof window === "undefined"
      ? formatEventDate(startsAt, venueTimezone)
      : formatEventDate(startsAt);

  return (
    <time
      dateTime={startsAt}
      suppressHydrationWarning
      title={`Venue time zone: ${venueTimezone}`}
    >
      {label}
    </time>
  );
}
