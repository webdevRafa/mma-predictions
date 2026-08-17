import "server-only";

import { cache } from "react";

import { getPublicRepository } from "@/lib/repositories";

export const listPublicEvents = cache(() => getPublicRepository().listEvents());

export const getPublicEvent = cache((slug: string) =>
  getPublicRepository().getEventBySlug(slug),
);

export const getPublicFight = cache((slug: string) =>
  getPublicRepository().getFightBySlug(slug),
);

export const getPublicFighter = cache((slug: string) =>
  getPublicRepository().getFighterBySlug(slug),
);

export const listPublicCards = cache(async () => {
  const events = await listPublicEvents();
  const cards = await Promise.all(
    events.map((event) => getPublicEvent(event.slug)),
  );
  return cards.filter((card) => card !== null);
});
