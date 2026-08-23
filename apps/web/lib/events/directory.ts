import type { Event } from "@fightlobby/domain";

export function sortEventsNewestFirst<T extends Pick<Event, "id" | "startsAt">>(
  events: readonly T[],
) {
  return [...events].sort((eventA, eventB) => {
    const dateDifference =
      Date.parse(eventB.startsAt) - Date.parse(eventA.startsAt);
    return dateDifference || eventB.id.localeCompare(eventA.id);
  });
}
