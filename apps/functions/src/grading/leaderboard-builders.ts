import {
  LEADERBOARD_CALCULATION_VERSION,
  SEASON_ACCURACY_MINIMUM_PICKS,
  rankAccuracyBoard,
  rankEventBoard,
  rankPointsBoard,
  rankStreakBoard,
  type RankedMetrics,
  type RankingMetrics,
} from "@fightlobby/domain";
import {
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function predictionMetrics(
  firestore: Firestore,
  field: "eventId" | "seasonId",
  value: string,
  options: { includeUngradedParticipants?: boolean } = {},
) {
  const snapshot = await firestore
    .collection("predictions")
    .where(field, "==", value)
    .get();
  const byUser = new Map<string, RankingMetrics>();
  for (const document of snapshot.docs) {
    const raw: unknown = document.data();
    const prediction = record(raw);
    if (typeof prediction.uid !== "string") continue;
    const current = byUser.get(prediction.uid) ?? {
      uid: prediction.uid,
      gradedPicks: 0,
      correctWinners: 0,
      totalPoints: 0,
      exactPicks: 0,
      currentStreak: 0,
    };
    if (prediction.status !== "graded") {
      if (options.includeUngradedParticipants) {
        byUser.set(prediction.uid, current);
      }
      continue;
    }
    const grade = record(prediction.grade);
    current.gradedPicks += 1;
    current.correctWinners += grade.winnerCorrect === true ? 1 : 0;
    current.totalPoints += numberValue(grade.points);
    current.exactPicks += grade.detailCorrect === true ? 1 : 0;
    byUser.set(prediction.uid, current);
  }
  const profiles = await Promise.all(
    [...byUser.keys()].map((uid) =>
      firestore.collection("profiles").doc(uid).get(),
    ),
  );
  for (const profile of profiles) {
    const metrics = byUser.get(profile.id);
    if (!metrics) continue;
    const raw: unknown = profile.data();
    const stats = record(record(raw).stats);
    metrics.currentStreak = numberValue(stats.currentStreak);
  }
  return { byUser, profiles };
}

function profileMetadata(profiles: DocumentSnapshot[]) {
  return new Map(
    profiles.map((profile) => {
      const raw: unknown = profile.data();
      const data = record(raw);
      const avatar = record(data.avatar);
      return [
        profile.id,
        {
          handle:
            typeof data.handle === "string"
              ? data.handle
              : `member_${profile.id.slice(0, 6)}`,
          avatarVersion: numberValue(avatar.version),
          badges: Array.isArray(data.badges)
            ? data.badges.filter(
                (badge): badge is string => typeof badge === "string",
              )
            : [],
        },
      ] as const;
    }),
  );
}

async function writeBoard(
  firestore: Firestore,
  board: {
    id: string;
    type: "event" | "season_points" | "season_accuracy" | "streak";
    label: string;
    minimumPicks: number;
    eventId?: string;
    seasonId?: string;
    championUid?: string | null;
    startsAt?: unknown;
    endsAt?: unknown;
  },
  ranking: RankedMetrics[],
  profiles: DocumentSnapshot[],
) {
  const boardRef = firestore.collection("leaderboards").doc(board.id);
  const existing = await boardRef.collection("entries").get();
  const metadata = profileMetadata(profiles);
  const writer = firestore.bulkWriter();
  const activeUids = new Set(ranking.map((entry) => entry.uid));
  for (const entry of existing.docs) {
    if (!activeUids.has(entry.id)) void writer.delete(entry.ref);
  }
  const now = Timestamp.now();
  for (const entry of ranking) {
    const member = metadata.get(entry.uid);
    if (!member) continue;
    void writer.set(boardRef.collection("entries").doc(entry.uid), {
      ...entry,
      ...member,
      updatedAt: now,
    });
  }
  await writer.close();
  await boardRef.set(
    {
      ...board,
      calculationVersion: LEADERBOARD_CALCULATION_VERSION,
      lastBuiltAt: now,
    },
    { merge: true },
  );
  return new Set(existing.docs.map((entry) => entry.id));
}

async function profileSnapshots(firestore: Firestore, uids: string[]) {
  if (uids.length === 0) return [];
  const snapshots = [];
  for (let index = 0; index < uids.length; index += 100) {
    snapshots.push(
      ...(await firestore.getAll(
        ...uids
          .slice(index, index + 100)
          .map((uid) => firestore.collection("profiles").doc(uid)),
      )),
    );
  }
  return snapshots;
}

export async function rebuildEventLeaderboard(
  firestore: Firestore,
  eventId: string,
) {
  const [{ byUser }, eventSnapshot] = await Promise.all([
    predictionMetrics(firestore, "eventId", eventId, {
      includeUngradedParticipants: true,
    }),
    firestore.collection("events").doc(eventId).get(),
  ]);
  const ranking = rankEventBoard([...byUser.values()]);
  const profiles = await profileSnapshots(
    firestore,
    ranking.entries.map((entry) => entry.uid),
  );
  const eventRaw: unknown = eventSnapshot.data();
  const event = record(eventRaw);
  const label =
    typeof event.shortName === "string" ? event.shortName : "Event standings";
  const boardId = `event_${eventId}`;
  const previousBoard = await firestore
    .collection("leaderboards")
    .doc(boardId)
    .get();
  const previousRaw: unknown = previousBoard.data();
  const previousChampion = record(previousRaw).championUid;
  const championUid =
    event.status === "completed" ? ranking.entries[0]?.uid : undefined;
  await writeBoard(
    firestore,
    {
      id: boardId,
      type: "event",
      label,
      eventId,
      minimumPicks: ranking.minimumPicks,
      championUid: championUid ?? null,
      ...(event.startsAt !== undefined ? { startsAt: event.startsAt } : {}),
      ...(event.completedAt !== undefined ? { endsAt: event.completedAt } : {}),
    },
    ranking.entries,
    profiles,
  );
  const achievementUids = new Set<string>();
  if (
    typeof previousChampion === "string" &&
    previousChampion !== championUid
  ) {
    await firestore
      .collection("achievements")
      .doc(previousChampion)
      .collection("eventChampionships")
      .doc(eventId)
      .delete();
    achievementUids.add(previousChampion);
  }
  if (championUid) {
    await firestore
      .collection("achievements")
      .doc(championUid)
      .collection("eventChampionships")
      .doc(eventId)
      .set({ eventId, awardedAt: Timestamp.now() });
    achievementUids.add(championUid);
  }
  return { ranking: ranking.entries, achievementUids };
}

export async function rebuildSeasonLeaderboards(
  firestore: Firestore,
  seasonId: string,
) {
  const { byUser } = await predictionMetrics(firestore, "seasonId", seasonId);
  const metrics = [...byUser.values()];
  const points = rankPointsBoard(metrics);
  const accuracy = rankAccuracyBoard(metrics);
  const streak = rankStreakBoard(metrics);
  const allUids = [...new Set(metrics.map((entry) => entry.uid))];
  const profiles = await profileSnapshots(firestore, allUids);
  const pointsId = `season_${seasonId}_points`;
  const oldPointEntries = await writeBoard(
    firestore,
    {
      id: pointsId,
      type: "season_points",
      label: `${seasonId} Season · Points`,
      seasonId,
      minimumPicks: 1,
    },
    points,
    profiles,
  );
  await Promise.all([
    writeBoard(
      firestore,
      {
        id: `season_${seasonId}_accuracy`,
        type: "season_accuracy",
        label: `${seasonId} Season · Accuracy`,
        seasonId,
        minimumPicks: SEASON_ACCURACY_MINIMUM_PICKS,
      },
      accuracy,
      profiles,
    ),
    writeBoard(
      firestore,
      {
        id: `season_${seasonId}_streak`,
        type: "streak",
        label: `${seasonId} Season · Streaks`,
        seasonId,
        minimumPicks: 1,
      },
      streak,
      profiles,
    ),
  ]);

  const accuracyRanks = new Map(
    accuracy.map((entry) => [entry.uid, entry.rank]),
  );
  const pointsRanks = new Map(points.map((entry) => [entry.uid, entry.rank]));
  const affected = new Set([...allUids, ...oldPointEntries]);
  const writer = firestore.bulkWriter();
  for (const uid of affected) {
    const pointsRank = pointsRanks.get(uid);
    const accuracyRank = accuracyRanks.get(uid);
    if (pointsRank !== undefined) {
      void writer.set(
        firestore.collection("profiles").doc(uid),
        {
          rankSummary: {
            seasonId,
            pointsRank,
            ...(accuracyRank !== undefined ? { accuracyRank } : {}),
          },
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      const percentile = (pointsRank / Math.max(points.length, 1)) * 100;
      const topPercentile = percentile <= 1 ? 1 : percentile <= 10 ? 10 : null;
      void writer.set(
        firestore
          .collection("achievements")
          .doc(uid)
          .collection("seasonRanks")
          .doc(seasonId),
        { seasonId, pointsRank, topPercentile, updatedAt: Timestamp.now() },
      );
    } else {
      void writer.delete(
        firestore
          .collection("achievements")
          .doc(uid)
          .collection("seasonRanks")
          .doc(seasonId),
      );
    }
  }
  await writer.close();
  return { points, accuracy, streak, achievementUids: affected };
}
