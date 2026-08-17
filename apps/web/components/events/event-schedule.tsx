import { CalendarDays } from "lucide-react";

import { LocalEventTime } from "@/components/events/local-event-time";

export function EventSchedule({
  prelimsStartsAt,
  mainCardStartsAt,
  venueTimezone,
}: {
  prelimsStartsAt: string;
  mainCardStartsAt: string;
  venueTimezone: string;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      <span className="inline-flex min-w-0 items-start gap-2">
        <CalendarDays
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          size={14}
        />
        <span className="min-w-0">
          <span className="block text-fl-text-dim">Prelims</span>
          <LocalEventTime
            compact
            startsAt={prelimsStartsAt}
            venueTimezone={venueTimezone}
          />
        </span>
      </span>
      <span className="inline-flex min-w-0 items-start gap-2 sm:justify-self-end sm:text-right">
        <span className="min-w-0">
          <span className="block text-fl-text-dim">Main card</span>
          <LocalEventTime
            compact
            startsAt={mainCardStartsAt}
            venueTimezone={venueTimezone}
          />
        </span>
      </span>
    </div>
  );
}
