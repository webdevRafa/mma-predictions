import type { Metadata } from "next";
import { Award, Flame, Medal, Trophy } from "lucide-react";
import Link from "next/link";

import { EventBoardSelect } from "@/components/leaderboards/event-board-select";
import { Card } from "@/components/ui/card";
import { TrackAnalyticsEvent } from "@/features/analytics/analytics-runtime";
import { listLeaderboards } from "@/lib/data/leaderboards";
import { percentage } from "@/lib/format";

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "FightLobby UFC prediction rankings for points, winner accuracy, exact reads, and active streaks.",
  alternates: { canonical: "/leaderboards" },
};

const boardDescriptions: Partial<
  Record<"event" | "season_points" | "season_accuracy" | "streak", string>
> = {
  event:
    "Final event standings for every member who made at least one prediction.",
  streak: "Consecutive correct winner calls; void fights never break a run.",
};

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string | string[] }>;
}) {
  const boards = await listLeaderboards();
  const requestedValue = (await searchParams).board;
  const requested =
    typeof requestedValue === "string" ? requestedValue : undefined;
  const eventBoards = boards.filter((board) => board.type === "event");
  const latestEventBoard = eventBoards[0];
  const seasonPoints = boards.find((board) => board.type === "season_points");
  const seasonAccuracy = boards.find(
    (board) => board.type === "season_accuracy",
  );
  const streaks = boards.find((board) => board.type === "streak");
  const primaryBoards = [
    latestEventBoard
      ? { board: latestEventBoard, label: "Last event" }
      : undefined,
    seasonPoints ? { board: seasonPoints, label: "Season points" } : undefined,
    seasonAccuracy ? { board: seasonAccuracy, label: "Accuracy" } : undefined,
    streaks ? { board: streaks, label: "Streaks" } : undefined,
  ].filter((item) => item !== undefined);
  const active =
    boards.find((board) => board.id === requested) ??
    latestEventBoard ??
    boards[0];
  const activeEventBoardId = active?.type === "event" ? active.id : undefined;

  return (
    <main id="main-content">
      <TrackAnalyticsEvent
        name="leaderboard_viewed"
        parameters={{ board_type: active?.type ?? "empty" }}
      />
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

      <section className="shell py-10 sm:py-14">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <nav
            aria-label="Leaderboard boards"
            className="flex gap-2 overflow-x-auto pb-2"
          >
            {primaryBoards.map(({ board, label }) => (
              <Link
                aria-current={active?.id === board.id ? "page" : undefined}
                className={`focus-ring shrink-0 rounded-lg border px-4 py-3 text-xs font-bold transition ${active?.id === board.id ? "border-fl-accent bg-fl-accent text-fl-bg" : "border-fl-border bg-fl-surface-1 text-fl-text-muted hover:text-fl-text"}`}
                href={`/leaderboards?board=${encodeURIComponent(board.id)}`}
                key={board.id}
              >
                {label}
              </Link>
            ))}
          </nav>
          <EventBoardSelect
            activeBoardId={activeEventBoardId}
            key={activeEventBoardId ?? "no-active-event"}
            options={eventBoards.map((board) => ({
              id: board.id,
              label: board.label,
            }))}
          />
        </div>

        {active ? (
          <>
            <div className="mt-8">
              <div>
                {active.type === "event" ? (
                  <p className="eyebrow">
                    {active.id === latestEventBoard?.id
                      ? "Last completed event"
                      : "Event standings"}
                  </p>
                ) : null}
                <h2
                  className={`${active.type === "event" ? "mt-2" : ""} font-display text-4xl font-bold sm:text-5xl`}
                >
                  {active.label}
                </h2>
                {boardDescriptions[active.type] ? (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-fl-text-muted">
                    {boardDescriptions[active.type]}
                  </p>
                ) : null}
              </div>
            </div>

            <Card className="mt-7 overflow-hidden">
              <div className="divide-y divide-fl-border sm:hidden">
                {active.entries.length === 0 ? (
                  <p className="bg-fl-surface-1 px-5 py-10 text-center text-sm text-fl-text-muted">
                    No predictions were graded for this board.
                  </p>
                ) : null}
                {active.entries.map((entry) => (
                  <article className="bg-fl-surface-1 p-5" key={entry.uid}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="inline-flex items-center gap-2 font-display text-2xl font-bold">
                        {entry.rank === 1 ? (
                          <Trophy
                            aria-hidden="true"
                            className="text-fl-warning"
                            size={17}
                          />
                        ) : entry.rank <= 3 ? (
                          <Medal
                            aria-hidden="true"
                            className="text-fl-accent"
                            size={17}
                          />
                        ) : null}
                        #{entry.rank}
                      </span>
                      <div className="min-w-0 text-right">
                        <Link
                          className="focus-ring block truncate rounded text-sm font-bold hover:text-fl-accent"
                          href={`/u/${entry.handle}`}
                        >
                          @{entry.handle}
                        </Link>
                        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-fl-text-dim">
                          <Award aria-hidden="true" size={11} />{" "}
                          {entry.gradedPicks} graded
                        </p>
                      </div>
                    </div>
                    <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-fl-border pt-4 text-center">
                      <div>
                        <dt className="eyebrow">Points</dt>
                        <dd className="mt-1 font-display text-2xl font-bold">
                          {entry.totalPoints}
                        </dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Accuracy</dt>
                        <dd className="mt-1 font-display text-xl font-bold">
                          {percentage(entry.correctWinners, entry.gradedPicks)}%
                        </dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Exact</dt>
                        <dd className="mt-1 text-lg font-semibold">
                          {entry.exactPicks}
                        </dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Streak</dt>
                        <dd className="mt-1 inline-flex items-center gap-1 text-lg font-semibold">
                          <Flame
                            aria-hidden="true"
                            className="text-fl-accent"
                            size={14}
                          />
                          {entry.currentStreak}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                    <tr>
                      <th className="px-5 py-4" scope="col">
                        Rank
                      </th>
                      <th className="px-5 py-4" scope="col">
                        Member
                      </th>
                      <th className="px-5 py-4 text-right" scope="col">
                        Points
                      </th>
                      <th className="px-5 py-4 text-right" scope="col">
                        Accuracy
                      </th>
                      <th className="px-5 py-4 text-right" scope="col">
                        Exact
                      </th>
                      <th className="px-5 py-4 text-right" scope="col">
                        Streak
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fl-border">
                    {active.entries.length === 0 ? (
                      <tr className="bg-fl-surface-1">
                        <td
                          className="px-5 py-10 text-center text-sm text-fl-text-muted"
                          colSpan={6}
                        >
                          No predictions were graded for this board.
                        </td>
                      </tr>
                    ) : null}
                    {active.entries.map((entry) => (
                      <tr className="bg-fl-surface-1" key={entry.uid}>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 font-display text-2xl font-bold">
                            {entry.rank === 1 ? (
                              <Trophy
                                aria-hidden="true"
                                className="text-fl-warning"
                                size={17}
                              />
                            ) : entry.rank <= 3 ? (
                              <Medal
                                aria-hidden="true"
                                className="text-fl-accent"
                                size={17}
                              />
                            ) : null}
                            #{entry.rank}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <Link
                              className="focus-ring rounded text-sm font-bold hover:text-fl-accent"
                              href={`/u/${entry.handle}`}
                            >
                              @{entry.handle}
                            </Link>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-fl-text-dim">
                              <Award aria-hidden="true" size={11} />{" "}
                              {entry.gradedPicks} graded
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-display text-2xl font-bold">
                          {entry.totalPoints}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-display text-xl font-bold">
                            {percentage(
                              entry.correctWinners,
                              entry.gradedPicks,
                            )}
                            %
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold">
                          {entry.exactPicks}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <Flame
                              aria-hidden="true"
                              className="text-fl-accent"
                              size={15}
                            />
                            {entry.currentStreak}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          <Card className="mt-8 p-6 text-sm text-fl-text-muted">
            Leaderboards will appear after the first official results are
            graded.
          </Card>
        )}
      </section>
    </main>
  );
}
