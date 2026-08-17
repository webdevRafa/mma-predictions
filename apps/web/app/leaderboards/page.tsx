import type { Metadata } from "next";
import { Award, Flame, Medal, ShieldCheck, Target, Trophy } from "lucide-react";
import Link from "next/link";

import { FighterAvatar } from "@/components/fighters/fighter-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TrackAnalyticsEvent } from "@/features/analytics/analytics-runtime";
import { listLeaderboards } from "@/lib/data/leaderboards";
import { percentage } from "@/lib/format";

export const metadata: Metadata = {
  title: "UFC Prediction Leaderboards",
  description:
    "FightLobby UFC prediction rankings for points, winner accuracy, exact reads, and active streaks.",
  alternates: { canonical: "/leaderboards" },
};

const boardDescriptions = {
  event: "Current-card points with the 70% participation floor enforced.",
  season_points:
    "Participation, correct winners, and exact reads across the season.",
  season_accuracy:
    "Sustained winner accuracy ranked by the 95% Wilson lower bound.",
  streak: "Consecutive correct winner calls; void fights never break a run.",
};

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const boards = await listLeaderboards();
  const requested = (await searchParams).board;
  const active =
    boards.find((board) => board.id === requested) ??
    boards.find((board) => board.type === "event") ??
    boards[0];

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
        <div className="shell relative py-12 sm:py-16">
          <Badge tone="accent">Receipts, ranked</Badge>
          <h1 className="mt-5 max-w-4xl font-display text-6xl font-extrabold sm:text-8xl">
            UFC PREDICTION LEADERBOARDS
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-fl-text-muted">
            Points reward complete reads. Accuracy requires volume. Every board
            uses deterministic server-side tie breaks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs text-fl-text-muted">
            <span className="inline-flex items-center gap-2 rounded-full border border-fl-border bg-fl-surface-1 px-3 py-2">
              <ShieldCheck aria-hidden="true" size={14} /> Server graded
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-fl-border bg-fl-surface-1 px-3 py-2">
              <Target aria-hidden="true" size={14} /> No wagering
            </span>
          </div>
        </div>
      </section>

      <section className="shell py-10 sm:py-14">
        <nav
          aria-label="Leaderboard boards"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {boards.map((board) => (
            <Link
              aria-current={active?.id === board.id ? "page" : undefined}
              className={`focus-ring shrink-0 rounded-lg border px-4 py-3 text-xs font-bold transition ${active?.id === board.id ? "border-fl-accent bg-fl-accent text-fl-bg" : "border-fl-border bg-fl-surface-1 text-fl-text-muted hover:text-fl-text"}`}
              href={`/leaderboards?board=${encodeURIComponent(board.id)}`}
              key={board.id}
            >
              {board.type === "event"
                ? "Current event"
                : board.type === "season_points"
                  ? "Season points"
                  : board.type === "season_accuracy"
                    ? "Accuracy"
                    : "Streaks"}
            </Link>
          ))}
        </nav>

        {active ? (
          <>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Active board</p>
                <h2 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
                  {active.label}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-fl-text-muted">
                  {boardDescriptions[active.type]}
                </p>
              </div>
              <p className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                Minimum {active.minimumPicks} graded pick
                {active.minimumPicks === 1 ? "" : "s"}
              </p>
            </div>

            <Card className="mt-7 overflow-hidden">
              <div className="overflow-x-auto">
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
                          <div className="flex items-center gap-3">
                            <FighterAvatar
                              className="size-10 text-xs"
                              name={entry.handle}
                            />
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
                          {active.type === "season_accuracy" &&
                          entry.wilsonScore !== undefined ? (
                            <span className="mt-1 block font-mono text-[9px] text-fl-text-dim">
                              W {entry.wilsonScore.toFixed(3)}
                            </span>
                          ) : null}
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
