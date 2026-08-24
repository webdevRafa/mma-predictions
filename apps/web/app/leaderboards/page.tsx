import type { Metadata } from "next";

import { LeaderboardWorkspace } from "@/components/leaderboards/leaderboard-workspace";
import { listLeaderboards } from "@/lib/data/leaderboards";

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "FightLobby UFC prediction rankings for points, winner accuracy, exact reads, and active streaks.",
  alternates: { canonical: "/leaderboards" },
};

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string | string[] }>;
}) {
  const boards = await listLeaderboards();
  const requestedValue = (await searchParams).board;
  const requestedBoardId =
    typeof requestedValue === "string" ? requestedValue : undefined;
  const latestEventBoard = boards.find((board) => board.type === "event");
  const initialBoard =
    boards.find((board) => board.id === requestedBoardId) ??
    latestEventBoard ??
    boards[0];

  return (
    <main id="main-content">
      <section className="relative overflow-hidden border-b border-fl-border">
        <div
          aria-hidden="true"
          className="arena-grid absolute inset-0 opacity-40"
        />
        <div className="shell relative py-10 sm:py-12">
          <h1 className="max-w-4xl font-display text-5xl font-extrabold sm:text-6xl">
            LEADERBOARDS
          </h1>
        </div>
      </section>

      <LeaderboardWorkspace boards={boards} initialBoardId={initialBoard?.id} />
    </main>
  );
}
