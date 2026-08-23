import {
  LEADERBOARD_CALCULATION_VERSION,
  SEASON_ACCURACY_MINIMUM_PICKS,
  leaderboardFixtureSchema,
  rankAccuracyBoard,
  rankEventBoard,
  rankPointsBoard,
  rankStreakBoard,
  type Leaderboard,
  type RankedMetrics,
} from "@fightlobby/domain";

import fixtureValue from "../../../../fixtures/leaderboards/demo.json";
import type { LeaderboardRepository } from "./leaderboard-repository";

const fixture = leaderboardFixtureSchema.parse(fixtureValue);

function entries(ranking: RankedMetrics[], metrics: "event" | "season") {
  const members = new Map(
    fixture.members.map((member) => [member.uid, member]),
  );
  return ranking.map((ranked) => {
    const member = members.get(ranked.uid);
    if (!member) throw new Error(`Missing leaderboard member ${ranked.uid}`);
    return {
      ...ranked,
      handle: member.handle,
      avatarVersion: member.avatarVersion,
      badges: member.badges,
      updatedAt: fixture.generatedAt,
      ...(metrics === "season" && ranked.wilsonScore !== undefined
        ? { wilsonScore: ranked.wilsonScore }
        : {}),
    };
  });
}

export class FixtureLeaderboardRepository implements LeaderboardRepository {
  listBoards(): Promise<Leaderboard[]> {
    const eventMetrics = fixture.members.map((member) => ({
      uid: member.uid,
      ...member.event,
    }));
    const seasonMetrics = fixture.members.map((member) => ({
      uid: member.uid,
      ...member.season,
    }));
    const event = rankEventBoard(eventMetrics);
    const shared = {
      calculationVersion: LEADERBOARD_CALCULATION_VERSION,
      lastBuiltAt: fixture.generatedAt,
    };
    return Promise.resolve([
      {
        id: `event_${fixture.event.id}`,
        type: "event",
        label: fixture.event.label,
        eventId: fixture.event.id,
        minimumPicks: event.minimumPicks,
        entries: entries(event.entries, "event"),
        ...shared,
      },
      {
        id: `season_${fixture.season.id}_points`,
        type: "season_points",
        label: `${fixture.season.label} · Points`,
        seasonId: fixture.season.id,
        minimumPicks: 1,
        entries: entries(rankPointsBoard(seasonMetrics), "season"),
        ...shared,
      },
      {
        id: `season_${fixture.season.id}_accuracy`,
        type: "season_accuracy",
        label: `${fixture.season.label} · Accuracy`,
        seasonId: fixture.season.id,
        minimumPicks: SEASON_ACCURACY_MINIMUM_PICKS,
        entries: entries(rankAccuracyBoard(seasonMetrics), "season"),
        ...shared,
      },
      {
        id: `season_${fixture.season.id}_streak`,
        type: "streak",
        label: `${fixture.season.label} · Streaks`,
        seasonId: fixture.season.id,
        minimumPicks: 1,
        entries: entries(rankStreakBoard(seasonMetrics), "season"),
        ...shared,
      },
    ]);
  }
}
