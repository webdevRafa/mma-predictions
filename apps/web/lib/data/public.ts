import "server-only";

import { cache } from "react";

import { getPublicRepository } from "@/lib/repositories";

// Keep database reads deduplicated within a server render. These public routes
// already inherit the shell's short route revalidation window. Persistently
// caching the repository call itself is unsafe on Vercel because Firebase
// Admin may resolve request-scoped workload credentials while opening the
// Firestore connection; Next rejects that work from inside a cache scope with
// DYNAMIC_SERVER_USAGE.
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
