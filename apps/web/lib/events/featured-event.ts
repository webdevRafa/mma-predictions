import type { Event } from "@fightlobby/domain";

function startsAt(event: Event) {
  return new Date(event.startsAt).getTime();
}

/**
 * Picks the public card that should lead time-sensitive surfaces.
 * Live wins first, then the nearest future card, then the newest completed card.
 */
export function selectFeaturedEvent(
  events: ReadonlyArray<Event>,
  renderedAt: number,
) {
  const live = events
    .filter((event) => event.status === "live")
    .sort((left, right) => startsAt(right) - startsAt(left))[0];
  if (live) return live;

  const upcoming = events
    .filter(
      (event) => event.status === "scheduled" && startsAt(event) >= renderedAt,
    )
    .sort((left, right) => startsAt(left) - startsAt(right))[0];
  if (upcoming) return upcoming;

  const staleScheduled = events
    .filter((event) => event.status === "scheduled")
    .sort((left, right) => startsAt(right) - startsAt(left))[0];
  if (staleScheduled) return staleScheduled;

  return [...events].sort((left, right) => startsAt(right) - startsAt(left))[0];
}
