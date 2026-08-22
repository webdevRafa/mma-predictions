import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { getPublicRepository } from "@/lib/repositories";

const listPublicEventsCached = unstable_cache(
  () => getPublicRepository().listEvents(),
  ["public-events-v2"],
  { revalidate: 30, tags: ["public-events", "public-data"] },
);

const getPublicEventCached = unstable_cache(
  (slug: string) => getPublicRepository().getEventBySlug(slug),
  ["public-event-v2"],
  { revalidate: 30, tags: ["public-events", "public-data"] },
);

const getPublicFightCached = unstable_cache(
  (slug: string) => getPublicRepository().getFightBySlug(slug),
  ["public-fight-v2"],
  { revalidate: 30, tags: ["public-fights", "public-data"] },
);

const getPublicFighterCached = unstable_cache(
  (slug: string) => getPublicRepository().getFighterBySlug(slug),
  ["public-fighter-v2"],
  { revalidate: 300, tags: ["public-fighters", "public-data"] },
);

export const listPublicEvents = cache(listPublicEventsCached);
export const getPublicEvent = cache(getPublicEventCached);
export const getPublicFight = cache(getPublicFightCached);
export const getPublicFighter = cache(getPublicFighterCached);

export const listPublicCards = cache(async () => {
  const events = await listPublicEvents();
  const cards = await Promise.all(
    events.map((event) => getPublicEvent(event.slug)),
  );
  return cards.filter((card) => card !== null);
});
