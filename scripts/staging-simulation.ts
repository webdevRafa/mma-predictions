import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";

import {
  normalizedFixtureSchema,
  type PredictionPick,
} from "@fightlobby/domain";
import type { Database } from "firebase-admin/database";
import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";
import { removeChatMessageCore } from "../apps/functions/src/chat/moderation-admin.ts";
import { gradeFightPredictionsCore } from "../apps/functions/src/grading/grade-fight-predictions.ts";
import { syncEventCardCore } from "../apps/functions/src/ingestion/sync-event-card.ts";
import { lockFightPredictionsCore } from "../apps/functions/src/predictions/lock-fight-predictions.ts";
import {
  postChatMessageCore,
  reportChatMessageCore,
  type ChatMemberContext,
} from "../apps/web/lib/chat/server.ts";
import { submitPredictionTransaction } from "../apps/web/lib/predictions/firestore.ts";
import { MockMmaProvider } from "../packages/providers/src/mock/mock-provider.ts";

type FixtureInput = ReturnType<typeof normalizedFixtureSchema.parse>;
type FixtureResult = NonNullable<FixtureInput["fights"][number]["result"]>;
type FightStage = "walkouts" | "in_progress" | "completed";

interface RevalidationProbe {
  server: Server;
  origin: string;
  secret: string;
  requests: string[][];
}

export interface StagingSimulationReport {
  runId: string;
  eventId: string;
  eventStatus: string;
  fightCount: number;
  memberCount: number;
  predictionCount: number;
  statusTransitions: number;
  lockedPredictions: number;
  gradingRuns: number;
  correctedFightId: string;
  correctedResultVersion: number;
  noDoubleScoring: boolean;
  reportsResolved: number;
  removedMessages: number;
  revalidationRequests: number;
  revalidatedPaths: string[];
  providerErrors: number;
  operationFootprint: Record<string, number>;
  durationMs: number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function officialResult(
  fight: FixtureInput["fights"][number],
  index: number,
): FixtureResult {
  return index % 2 === 0
    ? {
        winnerFighterId: fight.fighterAId,
        method: "decision_unanimous" as const,
        methodDetail: "Unanimous decision",
        round: fight.scheduledRounds,
        timeInRoundSeconds: 300,
        resultVersion: 1,
        official: true,
      }
    : {
        winnerFighterId: fight.fighterBId,
        method: "ko_tko" as const,
        methodDetail: "Punches",
        round: Math.min(2, fight.scheduledRounds),
        timeInRoundSeconds: 132,
        resultVersion: 1,
        official: true,
      };
}

function prepareFixture(input: unknown, eventStartsAt: string) {
  const fixture = clone(normalizedFixtureSchema.parse(input));
  fixture.generatedAt = new Date(
    new Date(eventStartsAt).getTime() - 60 * 60 * 1_000,
  ).toISOString();
  fixture.event.startsAt = eventStartsAt;
  fixture.event.status = "scheduled";
  fixture.fights.forEach((fight) => {
    fight.status = "scheduled";
    fight.predictionStatus = "open";
    fight.predictionSummary = {
      total: 0,
      fighterA: 0,
      fighterB: 0,
      methods: {},
      rounds: {},
    };
    delete fight.result;
  });
  return fixture;
}

function stageFixture(
  base: FixtureInput,
  activeIndex: number,
  stage: FightStage,
  correction = false,
) {
  const fixture = clone(base);
  fixture.event.status =
    activeIndex === fixture.fights.length - 1 && stage === "completed"
      ? "completed"
      : "live";
  fixture.fights.forEach((fight, index) => {
    if (index > activeIndex) {
      fight.status = "scheduled";
      fight.predictionStatus = "open";
      delete fight.result;
      return;
    }
    const completed = index < activeIndex || stage === "completed";
    const result = officialResult(fight, index);
    if (correction && index === 0) {
      result.winnerFighterId = fight.fighterBId;
      result.method = "ko_tko";
      result.methodDetail = "Punches";
      result.round = 2;
      result.timeInRoundSeconds = 88;
      result.resultVersion = 2;
    }
    fight.status = completed ? "completed" : stage;
    fight.predictionStatus = completed ? "grading" : "locked";
    if (completed) fight.result = result;
    else delete fight.result;
  });
  return fixture;
}

async function startRevalidationProbe(runId: string) {
  const requests: string[][] = [];
  const secret = `staging-probe-${runId}`;
  const server = createServer(async (request, response) => {
    if (
      request.method !== "POST" ||
      request.headers["x-revalidation-secret"] !== secret
    ) {
      response.writeHead(401).end();
      return;
    }
    const chunks: Uint8Array[] = [];
    for await (const requestChunk of request) {
      const chunk: unknown = requestChunk;
      if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
      else if (chunk instanceof Uint8Array) chunks.push(chunk);
      else throw new Error("Unexpected revalidation request payload");
    }
    try {
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const paths =
        body && typeof body === "object" && "paths" in body
          ? (body as { paths?: unknown }).paths
          : undefined;
      if (
        !Array.isArray(paths) ||
        !paths.every((path) => typeof path === "string")
      )
        throw new Error("Invalid path payload");
      requests.push(paths);
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ revalidated: paths.length }));
    } catch {
      response.writeHead(400).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Revalidation probe did not allocate a TCP port");
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
    secret,
    requests,
  } satisfies RevalidationProbe;
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function restoreEnvironment(key: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[key];
  else process.env[key] = previous;
}

async function providerMappings(firestore: Firestore) {
  const snapshot = await firestore.collection("providerMappings").get();
  return new Map(
    snapshot.docs.flatMap((document) => {
      const externalId: unknown = document.get("externalId");
      const internalId: unknown = document.get("internalId");
      const entityType: unknown = document.get("entityType");
      return typeof externalId === "string" &&
        typeof internalId === "string" &&
        typeof entityType === "string"
        ? [[`${entityType}:${externalId}`, internalId] as const]
        : [];
    }),
  );
}

function pickFor(
  fight: {
    fighterAId: string;
    fighterBId: string;
    scheduledRounds: number;
  },
  memberIndex: number,
  fightIndex: number,
): PredictionPick {
  const backsA = (memberIndex + fightIndex) % 2 === 0;
  return backsA
    ? {
        winnerFighterId: fight.fighterAId,
        method: "decision",
        detail: "unanimous",
        confidence: 64 + memberIndex * 7,
      }
    : {
        winnerFighterId: fight.fighterBId,
        method: "ko_tko",
        detail: Math.min(2, fight.scheduledRounds),
        confidence: 61 + memberIndex * 8,
      };
}

async function profilePoints(firestore: Firestore, uids: string[]) {
  return Promise.all(
    uids.map(async (uid) => {
      const points: unknown = (
        await firestore.collection("profiles").doc(uid).get()
      ).get("stats.totalPoints");
      return typeof points === "number" ? points : 0;
    }),
  );
}

async function collectionSize(firestore: Firestore, name: string) {
  return (await firestore.collection(name).get()).size;
}

export async function runStagingEventSimulation(input: {
  fixture: unknown;
  firestore: Firestore;
  database: Database;
  storage: Storage;
  runId?: string;
}): Promise<StagingSimulationReport> {
  const startedAt = Date.now();
  const runId = input.runId ?? `sim_${startedAt.toString(36)}`;
  const eventStartsAt = new Date(startedAt + 2 * 60 * 60 * 1_000).toISOString();
  const baseFixture = prepareFixture(input.fixture, eventStartsAt);
  const probe = await startRevalidationProbe(runId);
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousSecret = process.env.REVALIDATION_SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = probe.origin;
  process.env.REVALIDATION_SECRET = probe.secret;

  let statusTransitions = 0;
  let lockedPredictions = 0;
  try {
    const sync = (fixture: FixtureInput) =>
      syncEventCardCore({
        provider: new MockMmaProvider([fixture]),
        firestore: input.firestore,
        storage: input.storage,
        externalEventId: fixture.event.id,
        archiveEnabled: false,
        revalidate: true,
      });

    const initialSync = await sync(baseFixture);
    if (initialSync.status !== "complete")
      throw new Error("Initial staging provider sync did not complete");
    const mappings = await providerMappings(input.firestore);
    const eventId = mappings.get(`event:${baseFixture.event.id}`);
    if (!eventId) throw new Error("Staging event mapping was not created");
    const fights = baseFixture.fights.map((fight) => {
      const id = mappings.get(`fight:${fight.id}`);
      const fighterAId = mappings.get(`fighter:${fight.fighterAId}`);
      const fighterBId = mappings.get(`fighter:${fight.fighterBId}`);
      if (!id || !fighterAId || !fighterBId)
        throw new Error(`Staging mapping is incomplete for ${fight.id}`);
      return {
        id,
        externalId: fight.id,
        fighterAId,
        fighterBId,
        scheduledRounds: fight.scheduledRounds,
      };
    });

    const uids = [0, 1, 2].map((index) => `${runId}_member_${index}`);
    const seedBatch = input.firestore.batch();
    seedBatch.set(input.firestore.collection("featureFlags").doc("current"), {
      siteReadOnly: false,
      predictionsEnabled: true,
      chatEnabled: true,
      chatPostingEnabled: true,
      adsEnabled: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    uids.forEach((uid, index) => {
      seedBatch.set(input.firestore.collection("users").doc(uid), {
        uid,
        accountStatus: "active",
        roles: [index === 0 ? "trusted" : "member"],
        onboardingComplete: true,
        moderation: { trustLevel: index === 0 ? 1 : 0 },
      });
      seedBatch.set(input.firestore.collection("profiles").doc(uid), {
        uid,
        handle: `staging_${index}_${runId}`.slice(0, 20),
        handleNormalized: `staging_${index}_${runId}`.slice(0, 20),
        profileVisibility: "public",
        avatar: { version: 0 },
        stats: {},
        badges: [],
        joinedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    await seedBatch.commit();

    for (const [fightIndex, fight] of fights.entries()) {
      for (const [memberIndex, uid] of uids.entries())
        await submitPredictionTransaction(input.firestore, {
          fightId: fight.id,
          uid,
          requestId: randomUUID(),
          pick: pickFor(fight, memberIndex, fightIndex),
        });
    }

    const firstFightSnapshot = await input.firestore
      .collection("fights")
      .doc(fights[0]!.id)
      .get();
    const roomId: unknown = firstFightSnapshot.get("chatRoomId");
    if (typeof roomId !== "string")
      throw new Error("Staging fight chat room was not created");
    const member: ChatMemberContext = {
      uid: uids[0]!,
      emailVerified: true,
      onboardingComplete: true,
      accountStatus: "active",
      roles: ["trusted"],
      handle: `staging_${runId}`.slice(0, 20),
    };
    const message = await postChatMessageCore(
      input.firestore,
      input.database,
      member,
      {
        roomId,
        body: "Staging replay message for moderation verification.",
        clientNonce: randomUUID(),
        nowMilliseconds: startedAt,
      },
    );
    const report = await reportChatMessageCore(
      input.firestore,
      input.database,
      uids[1]!,
      { roomId, messageId: message.message.id, reason: "other" },
    );
    const reportId = report.reportId;
    const removal = await removeChatMessageCore(
      input.firestore,
      input.database,
      `${runId}_moderator`,
      {
        roomId,
        messageId: message.message.id,
        reason: "Staging moderation workflow verification",
      },
    );
    const moderationActionId = removal.actionId;
    await input.firestore
      .collection("reports")
      .doc(reportId)
      .set(
        {
          status: "resolved",
          resolvedBy: `${runId}_moderator`,
          resolutionReason: "Message removed during staging replay",
          resolvedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    for (const [index, fight] of fights.entries()) {
      for (const stage of ["walkouts", "in_progress", "completed"] as const) {
        const syncResult = await sync(stageFixture(baseFixture, index, stage));
        if (syncResult.status !== "complete")
          throw new Error(`Provider transition ${index}:${stage} did not sync`);
        statusTransitions += 1;
        if (stage === "walkouts") {
          const lock = await lockFightPredictionsCore(
            input.firestore,
            fight.id,
          );
          lockedPredictions += lock.locked;
        }
        if (stage === "completed")
          await Promise.all(
            syncResult.gradeFightIds.map((fightId) =>
              gradeFightPredictionsCore(
                input.firestore,
                fightId,
                "staging_official_result",
              ),
            ),
          );
      }
    }

    const pointsBeforeCorrection = await profilePoints(input.firestore, uids);
    const correctedFixture = stageFixture(
      baseFixture,
      fights.length - 1,
      "completed",
      true,
    );
    const correctionSync = await sync(correctedFixture);
    if (correctionSync.status !== "complete")
      throw new Error("Corrected result did not produce a provider sync");
    await Promise.all(
      correctionSync.gradeFightIds.map((fightId) =>
        gradeFightPredictionsCore(
          input.firestore,
          fightId,
          "staging_result_correction",
        ),
      ),
    );
    const pointsAfterCorrection = await profilePoints(input.firestore, uids);
    const correctedFightId = fights[0]!.id;
    const correctedFight = await input.firestore
      .collection("fights")
      .doc(correctedFightId)
      .get();
    const correctedResultVersion: unknown = correctedFight.get(
      "result.resultVersion",
    );
    if (typeof correctedResultVersion !== "number")
      throw new Error("Corrected result version was not recorded");
    await gradeFightPredictionsCore(
      input.firestore,
      correctedFightId,
      "staging_idempotency_replay",
    );
    const pointsAfterReplay = await profilePoints(input.firestore, uids);
    const noDoubleScoring = pointsAfterReplay.every(
      (points, index) => points === pointsAfterCorrection[index],
    );
    if (!noDoubleScoring)
      throw new Error("Repeated grading changed member totals");
    if (
      pointsBeforeCorrection.every(
        (points, index) => points === pointsAfterCorrection[index],
      )
    )
      throw new Error("Result correction did not reconcile member totals");

    const [eventSnapshot, finalFights, reportSnapshot, messageSnapshot] =
      await Promise.all([
        input.firestore.collection("events").doc(eventId).get(),
        input.firestore
          .collection("fights")
          .where("eventId", "==", eventId)
          .get(),
        input.firestore.collection("reports").doc(reportId).get(),
        input.database
          .ref(`chat/v1/rooms/${roomId}/messages/${message.message.id}`)
          .get(),
      ]);
    if (eventSnapshot.get("status") !== "completed")
      throw new Error("Staging event did not reach completed state");
    if (
      finalFights.docs.some(
        (fight) =>
          fight.get("status") !== "completed" ||
          fight.get("predictionStatus") !== "graded",
      )
    )
      throw new Error("One or more staging fights did not finish and grade");
    if (reportSnapshot.get("status") !== "resolved")
      throw new Error("Staging moderation report was not resolved");
    if (messageSnapshot.child("status").val() !== "removed")
      throw new Error("Reported staging message was not removed");

    const revalidatedPaths = [...new Set(probe.requests.flat())].sort();
    const requiredPaths = [
      "/",
      "/events",
      "/sitemap.xml",
      `/events/${String(eventSnapshot.get("slug"))}`,
      ...finalFights.docs.map(
        (fight) => `/fights/${String(fight.get("slug"))}`,
      ),
    ];
    if (!requiredPaths.every((path) => revalidatedPaths.includes(path)))
      throw new Error("Provider sync omitted a required public revalidation");

    const [
      predictionCount,
      syncRuns,
      gradingRuns,
      auditLogs,
      leaderboardDocuments,
      providerErrors,
    ] = await Promise.all([
      collectionSize(input.firestore, "predictions"),
      collectionSize(input.firestore, "syncRuns"),
      collectionSize(input.firestore, "gradingRuns"),
      collectionSize(input.firestore, "auditLogs"),
      collectionSize(input.firestore, "leaderboards"),
      collectionSize(input.firestore, "providerErrors"),
    ]);
    if (providerErrors > 0)
      throw new Error("Provider errors were recorded during staging replay");
    const reportValue: StagingSimulationReport = {
      runId,
      eventId,
      eventStatus: String(eventSnapshot.get("status")),
      fightCount: finalFights.size,
      memberCount: uids.length,
      predictionCount,
      statusTransitions,
      lockedPredictions,
      gradingRuns,
      correctedFightId,
      correctedResultVersion,
      noDoubleScoring,
      reportsResolved: reportSnapshot.get("status") === "resolved" ? 1 : 0,
      removedMessages:
        messageSnapshot.child("status").val() === "removed" ? 1 : 0,
      revalidationRequests: probe.requests.length,
      revalidatedPaths,
      providerErrors,
      operationFootprint: {
        syncRuns,
        gradingRuns,
        auditLogs,
        leaderboardDocuments,
        predictionDocuments: predictionCount,
        moderationActions: moderationActionId ? 1 : 0,
      },
      durationMs: Date.now() - startedAt,
    };
    await input.firestore
      .collection("simulationRuns")
      .doc(runId)
      .set({
        ...reportValue,
        costNote:
          "Emulator document counts are an operational footprint, not a production billing quote.",
        completedAt: FieldValue.serverTimestamp(),
      });
    return reportValue;
  } finally {
    restoreEnvironment("NEXT_PUBLIC_SITE_URL", previousSiteUrl);
    restoreEnvironment("REVALIDATION_SECRET", previousSecret);
    await closeServer(probe.server);
  }
}
