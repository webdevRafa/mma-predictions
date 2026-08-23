import type { Event } from "@fightlobby/domain";

type SearchableEvent = Pick<Event, "name" | "shortName" | "status" | "venue">;

export function sortEventsNewestFirst<T extends Pick<Event, "id" | "startsAt">>(
  events: readonly T[],
) {
  return [...events].sort((eventA, eventB) => {
    const dateDifference =
      Date.parse(eventB.startsAt) - Date.parse(eventA.startsAt);
    return dateDifference || eventB.id.localeCompare(eventA.id);
  });
}

export function filterEvents<T extends SearchableEvent>(
  events: readonly T[],
  query: string,
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...events];

  return events.filter((event) => {
    const searchableText = [
      event.name,
      event.shortName,
      event.status,
      event.venue?.name,
      event.venue?.city,
      event.venue?.region,
      event.venue?.countryCode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

    return terms.every((term) => searchableText.includes(term));
  });
}
