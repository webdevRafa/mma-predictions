import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { EventsDirectory } from "@/features/events/events-directory";
import { listPublicEvents } from "@/lib/data/public";
import { sortEventsNewestFirst } from "@/lib/events/directory";

export const metadata: Metadata = {
  title: "UFC Events",
  description:
    "Browse upcoming and completed UFC cards, community prediction totals, and every FightLobby matchup room.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "UFC Events and Fight Cards",
    description:
      "Find the next UFC card, make predictions, and enter every matchup lobby.",
    url: "/events",
  },
  twitter: { card: "summary_large_image" },
};

export default async function EventsPage() {
  const events = sortEventsNewestFirst(
    (await listPublicEvents()).filter(
      (event) => event.status !== "draft" && event.dataQuality !== "blocked",
    ),
  );

  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Events" }]}
      />
      <EventsDirectory events={events} />
    </main>
  );
}
