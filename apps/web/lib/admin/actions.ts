import "server-only";

import {
  parseFixture,
  resultMethodSchema,
  userRoleSchema,
} from "@fightlobby/domain";
import {
  lockFightPredictionsCore,
  reopenFightPredictionsCore,
} from "@fightlobby/firebase-ops";
import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { z } from "zod";

import { adminAuditData } from "@/lib/admin/audit";
import { ApiError } from "@/lib/auth/http";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const reasonSchema = z.string().trim().min(5).max(500);
const confirmationSchema = z.string().trim().min(3).max(180);
const idSchema = z.string().regex(/^[a-z0-9_-]{3,160}$/i);

const eventPatchSchema = z
  .object({
    name: z.string().trim().min(3).max(140).optional(),
    shortName: z.string().trim().min(2).max(80).optional(),
    status: z
      .enum([
        "draft",
        "scheduled",
        "live",
        "completed",
        "canceled",
        "postponed",
      ])
      .optional(),
    startsAt: z.iso.datetime({ offset: true }).optional(),
    venueTimezone: z.string().trim().min(3).max(80).optional(),
    monetizationEligible: z.boolean().optional(),
    dataQuality: z
      .enum(["verified", "complete", "partial", "blocked"])
      .optional(),
    editorialSummary: z.string().trim().min(20).max(800).optional(),
    editorialStatus: z
      .enum(["missing", "draft", "reviewed", "published"])
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one event field is required",
  );

const fightPatchSchema = z
  .object({
    status: z
      .enum([
        "scheduled",
        "prefight",
        "walkouts",
        "intros",
        "in_progress",
        "end_of_round",
        "completed",
        "canceled",
        "postponed",
      ])
      .optional(),
    cardSegment: z.enum(["early_prelims", "prelims", "main_card"]).optional(),
    weightClass: z.string().trim().min(2).max(80).optional(),
    isTitleFight: z.boolean().optional(),
    scheduledRounds: z.union([z.literal(3), z.literal(5)]).optional(),
    monetizationEligible: z.boolean().optional(),
    dataQuality: z
      .enum(["verified", "complete", "partial", "blocked"])
      .optional(),
    biggestQuestion: z.string().trim().min(20).max(300).optional(),
    styleContrast: z.string().trim().min(20).max(500).optional(),
    keysForFighterA: z
      .array(z.string().trim().min(5).max(140))
      .max(5)
      .optional(),
    keysForFighterB: z
      .array(z.string().trim().min(5).max(140))
      .max(5)
      .optional(),
    fightLobbyTake: z.string().trim().min(30).max(800).optional(),
    editorialStatus: z
      .enum(["missing", "draft", "reviewed", "published"])
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one fight field is required",
  );

const fighterPatchSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    nickname: z.string().trim().max(80).optional(),
    status: z.enum(["active", "inactive", "unknown"]).optional(),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    birthDate: z.iso.date().optional(),
    stance: z
      .enum(["orthodox", "southpaw", "switch", "open", "unknown"])
      .optional(),
    heightCm: z.number().positive().max(250).optional(),
    reachCm: z.number().positive().max(300).optional(),
    currentWeightClass: z.string().trim().min(2).max(80).optional(),
    dataQuality: z
      .enum(["verified", "complete", "partial", "blocked"])
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one fighter field is required",
  );

const base = {
  reason: reasonSchema,
  confirmation: confirmationSchema,
  returnTo: z
    .string()
    .regex(/^\/(?!\/)/)
    .max(240)
    .optional(),
};

export const adminActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("update_event"),
      eventId: idSchema,
      patch: eventPatchSchema,
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("update_fight"),
      fightId: idSchema,
      patch: fightPatchSchema,
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("update_fighter"),
      fighterId: idSchema,
      patch: fighterPatchSchema,
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("reorder_card"),
      eventId: idSchema,
      fightIds: z.array(idSchema).min(1).max(40),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("prediction_control"),
      fightId: idSchema,
      operation: z.enum(["lock", "reopen"]),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("correct_result"),
      fightId: idSchema,
      result: z
        .object({
          winnerFighterId: idSchema.optional(),
          method: resultMethodSchema,
          methodDetail: z.string().trim().max(120).optional(),
          round: z.number().int().min(1).max(5).optional(),
          timeInRoundSeconds: z.number().int().min(0).max(300).optional(),
          official: z.boolean().default(true),
        })
        .strict(),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("feature_flags"),
      patch: z
        .record(
          z.enum([
            "siteReadOnly",
            "authEnabled",
            "predictionsEnabled",
            "chatEnabled",
            "chatPostingEnabled",
            "providerSyncEnabled",
            "liveSyncEnabled",
            "adsEnabled",
            "emailEnabled",
            "socialCardsEnabled",
          ]),
          z.boolean(),
        )
        .refine((value) => Object.keys(value).length > 0),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("room_control"),
      roomId: idSchema,
      status: z.enum(["scheduled", "open", "slow_mode", "read_only", "closed"]),
      slowModeSeconds: z.number().int().min(0).max(300),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("remove_message"),
      roomId: idSchema,
      messageId: idSchema,
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("restore_message"),
      moderationActionId: idSchema,
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("resolve_report"),
      reportId: idSchema,
      resolution: z.enum(["resolved", "dismissed", "escalated"]),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("sanction_user"),
      targetUid: z.string().min(3).max(128),
      sanction: z.enum(["mute", "suspend", "ban", "unban"]),
      durationMinutes: z.number().int().min(5).max(43_200).optional(),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("set_user_roles"),
      targetUid: z.string().min(3).max(128),
      roles: z.array(userRoleSchema).min(1).max(4),
      ...base,
    })
    .strict(),
  z
    .object({
      action: z.literal("merge_fighters"),
      primaryFighterId: idSchema,
      duplicateFighterId: idSchema,
      ...base,
    })
    .strict()
    .refine(
      (value) => value.primaryFighterId !== value.duplicateFighterId,
      "Fighter IDs must be different",
    ),
  z
    .object({
      action: z.literal("manual_import"),
      fixture: z.unknown(),
      ...base,
    })
    .strict(),
]);

export type AdminAction = z.infer<typeof adminActionSchema>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function requireConfirmation(actual: string, expected: string) {
  if (actual !== expected)
    throw new ApiError(
      `Confirmation must exactly match: ${expected}`,
      400,
      "confirmation_mismatch",
    );
}

function auditRef(firestore: Firestore) {
  return firestore.collection("auditLogs").doc();
}

async function updateWithOverride(
  firestore: Firestore,
  input: {
    actorUid: string;
    entityType: "event" | "fight" | "fighter";
    entityId: string;
    patch: Record<string, unknown>;
    reason: string;
  },
) {
  const collectionName =
    input.entityType === "event"
      ? "events"
      : input.entityType === "fight"
        ? "fights"
        : "fighters";
  const canonicalRef = firestore.collection(collectionName).doc(input.entityId);
  const stateRef = firestore
    .collection("providerEntityState")
    .doc(`${input.entityType}_${input.entityId}`);
  const logRef = auditRef(firestore);
  return firestore.runTransaction(async (transaction) => {
    const [canonicalSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(canonicalRef),
      transaction.get(stateRef),
    ]);
    if (!canonicalSnapshot.exists)
      throw new ApiError(`${input.entityType} not found`, 404, "not_found");
    const before = record(canonicalSnapshot.data());
    const previousState = record(stateSnapshot.data());
    const manualOverrides = {
      ...record(previousState.manualOverrides),
      ...input.patch,
    };
    const after = {
      ...before,
      ...input.patch,
      updatedAt: new Date().toISOString(),
    };
    transaction.set(canonicalRef, after);
    transaction.set(
      stateRef,
      {
        id: stateRef.id,
        entityType: input.entityType,
        internalId: input.entityId,
        providerKey: previousState.providerKey ?? "manual",
        externalId: previousState.externalId ?? input.entityId,
        providerData: previousState.providerData ?? before,
        manualOverrides,
        syncVersion: previousState.syncVersion ?? 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(logRef, {
      id: logRef.id,
      ...adminAuditData({
        actorUid: input.actorUid,
        action: `update_${input.entityType}`,
        targetType: input.entityType,
        targetId: input.entityId,
        reason: input.reason,
        before,
        after,
      }),
    });
    return { auditId: logRef.id };
  });
}

async function correctResult(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "correct_result" }>,
) {
  const fightRef = firestore.collection("fights").doc(action.fightId);
  const stateRef = firestore
    .collection("providerEntityState")
    .doc(`fight_${action.fightId}`);
  const logRef = auditRef(firestore);
  const jobRef = firestore.collection("adminJobs").doc();
  return firestore.runTransaction(async (transaction) => {
    const [snapshot, stateSnapshot] = await Promise.all([
      transaction.get(fightRef),
      transaction.get(stateRef),
    ]);
    if (!snapshot.exists)
      throw new ApiError("Fight not found", 404, "fight_not_found");
    const before = record(snapshot.data());
    const participants = [before.fighterAId, before.fighterBId];
    if (
      action.result.winnerFighterId &&
      !participants.includes(action.result.winnerFighterId)
    )
      throw new ApiError(
        "Winner must be a fighter in this matchup",
        400,
        "invalid_winner",
      );
    if (
      ["draw", "no_contest", "overturned"].includes(action.result.method) &&
      action.result.winnerFighterId
    )
      throw new ApiError(
        "This result method cannot have a winner",
        400,
        "invalid_winner",
      );
    const previousResult = record(before.result);
    const resultVersion =
      (typeof previousResult.resultVersion === "number"
        ? previousResult.resultVersion
        : 0) + 1;
    const result = {
      ...action.result,
      resultVersion,
      updatedAt: new Date().toISOString(),
    };
    const after = {
      ...before,
      status: "completed",
      predictionStatus: "grading",
      result,
      updatedAt: new Date().toISOString(),
    };
    transaction.set(fightRef, after);
    const previousState = record(stateSnapshot.data());
    transaction.set(
      stateRef,
      {
        id: stateRef.id,
        entityType: "fight",
        internalId: action.fightId,
        providerKey: previousState.providerKey ?? "manual",
        externalId: previousState.externalId ?? action.fightId,
        providerData: previousState.providerData ?? before,
        manualOverrides: {
          ...record(previousState.manualOverrides),
          result,
          status: "completed",
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.create(jobRef, {
      id: jobRef.id,
      type: "regrade_fight",
      fightId: action.fightId,
      resultVersion,
      reason: action.reason,
      requestedBy: actorUid,
      status: "queued",
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(logRef, {
      id: logRef.id,
      ...adminAuditData({
        actorUid,
        action: "correct_result",
        targetType: "fight",
        targetId: action.fightId,
        reason: action.reason,
        before: before.result,
        after: result,
        metadata: { adminJobId: jobRef.id },
      }),
    });
    return { auditId: logRef.id, jobId: jobRef.id, resultVersion };
  });
}

async function reorderCard(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "reorder_card" }>,
) {
  const snapshot = await firestore
    .collection("fights")
    .where("eventId", "==", action.eventId)
    .get();
  const existingIds = snapshot.docs.map((document) => document.id).sort();
  const requestedIds = [...new Set(action.fightIds)].sort();
  if (
    existingIds.length !== requestedIds.length ||
    existingIds.some((id, index) => id !== requestedIds[index])
  )
    throw new ApiError(
      "Reorder request must include every fight exactly once",
      400,
      "incomplete_card_order",
    );
  const batch = firestore.batch();
  const stateSnapshots = await Promise.all(
    action.fightIds.map((fightId) =>
      firestore.collection("providerEntityState").doc(`fight_${fightId}`).get(),
    ),
  );
  const before = snapshot.docs.map((document) => {
    const data = record(document.data());
    return { id: document.id, boutOrder: data.boutOrder };
  });
  action.fightIds.forEach((fightId, index) => {
    batch.set(
      firestore.collection("fights").doc(fightId),
      { boutOrder: index + 1, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    batch.set(
      firestore.collection("providerEntityState").doc(`fight_${fightId}`),
      {
        id: `fight_${fightId}`,
        entityType: "fight",
        internalId: fightId,
        providerKey: text(
          record(stateSnapshots[index]?.data()).providerKey,
          "manual",
        ),
        externalId: text(
          record(stateSnapshots[index]?.data()).externalId,
          fightId,
        ),
        manualOverrides: {
          ...record(record(stateSnapshots[index]?.data()).manualOverrides),
          boutOrder: index + 1,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "reorder_card",
      targetType: "event",
      targetId: action.eventId,
      reason: action.reason,
      before,
      after: action.fightIds.map((id, index) => ({ id, boutOrder: index + 1 })),
    }),
  });
  await batch.commit();
  return { auditId: logRef.id };
}

async function predictionControl(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "prediction_control" }>,
) {
  const reference = firestore.collection("fights").doc(action.fightId);
  const logRef = auditRef(firestore);
  const snapshot = await reference.get();
  if (!snapshot.exists)
    throw new ApiError("Fight not found", 404, "fight_not_found");
  const before = record(snapshot.data());
  let result: unknown;
  try {
    result =
      action.operation === "lock"
        ? await lockFightPredictionsCore(firestore, action.fightId)
        : await reopenFightPredictionsCore(firestore, action.fightId);
  } catch (error) {
    throw new ApiError(
      error instanceof Error
        ? error.message
        : "Prediction control could not be updated",
      409,
      "prediction_control_failed",
    );
  }
  const afterSnapshot = await reference.get();
  const after = record(afterSnapshot.data());
  await logRef.set({
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: `${action.operation}_predictions`,
      targetType: "fight",
      targetId: action.fightId,
      reason:
        action.operation === "lock"
          ? "Manual live matchup lock"
          : action.reason,
      before: {
        predictionStatus: before.predictionStatus,
        predictionsLockedAt: before.predictionsLockedAt,
      },
      after: {
        predictionStatus: after.predictionStatus,
        predictionsLockedAt: after.predictionsLockedAt ?? null,
      },
    }),
  });
  return { auditId: logRef.id, result };
}

async function updateFeatureFlags(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "feature_flags" }>,
) {
  const reference = firestore.collection("featureFlags").doc("current");
  const logRef = auditRef(firestore);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const before = record(snapshot.data());
    const after = {
      ...before,
      ...action.patch,
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(reference, after);
    transaction.set(logRef, {
      id: logRef.id,
      ...adminAuditData({
        actorUid,
        action: "update_feature_flags",
        targetType: "feature_flags",
        targetId: "current",
        reason: action.reason,
        before,
        after: action.patch,
      }),
    });
    return { auditId: logRef.id };
  });
}

async function roomControl(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "room_control" }>,
) {
  const reference = firestore.collection("chatRooms").doc(action.roomId);
  const snapshot = await reference.get();
  if (!snapshot.exists)
    throw new ApiError("Chat room not found", 404, "room_not_found");
  const before = record(snapshot.data());
  const after = {
    status: action.status,
    slowModeSeconds: action.slowModeSeconds,
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = firestore.batch();
  batch.set(reference, after, { merge: true });
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "control_chat_room",
      targetType: "chat_room",
      targetId: action.roomId,
      reason: action.reason,
      before,
      after,
    }),
  });
  await batch.commit();
  return { auditId: logRef.id };
}

async function removeMessage(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "remove_message" }>,
) {
  const { database } = getFirebaseAdmin();
  const messageRef = database.ref(
    `chat/v1/rooms/${action.roomId}/messages/${action.messageId}`,
  );
  const snapshot = await messageRef.get();
  if (!snapshot.exists())
    throw new ApiError("Message not found", 404, "message_not_found");
  const message: unknown = snapshot.val();
  const moderationRef = firestore.collection("moderationActions").doc();
  const batch = firestore.batch();
  batch.create(moderationRef, {
    id: moderationRef.id,
    type: "remove_chat_message",
    actorUid,
    roomId: action.roomId,
    messageId: action.messageId,
    reason: action.reason,
    messageSnapshot: message,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  });
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "remove_chat_message",
      targetType: "chat_message",
      targetId: action.messageId,
      reason: action.reason,
      before: message,
      after: { status: "removed" },
      metadata: { roomId: action.roomId, moderationActionId: moderationRef.id },
    }),
  });
  await messageRef.update({
    body: "Message removed by moderation",
    status: "removed",
  });
  await batch.commit();
  return { auditId: logRef.id, moderationActionId: moderationRef.id };
}

async function restoreMessage(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "restore_message" }>,
) {
  const moderationRef = firestore
    .collection("moderationActions")
    .doc(action.moderationActionId);
  const moderation = await moderationRef.get();
  if (!moderation.exists || moderation.get("status") === "restored")
    throw new ApiError(
      "Removal action is unavailable",
      404,
      "moderation_action_not_found",
    );
  const roomId: unknown = moderation.get("roomId");
  const messageId: unknown = moderation.get("messageId");
  const message = record(moderation.get("messageSnapshot"));
  if (typeof roomId !== "string" || typeof messageId !== "string")
    throw new ApiError(
      "Removal snapshot is incomplete",
      409,
      "invalid_snapshot",
    );
  const body = message.body;
  if (typeof body !== "string")
    throw new ApiError(
      "Original message body is missing",
      409,
      "invalid_snapshot",
    );
  const { database } = getFirebaseAdmin();
  await database
    .ref(`chat/v1/rooms/${roomId}/messages/${messageId}`)
    .update({ body, status: "published" });
  const logRef = auditRef(firestore);
  const batch = firestore.batch();
  batch.set(
    moderationRef,
    {
      status: "restored",
      restoredBy: actorUid,
      restoredReason: action.reason,
      restoredAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "restore_chat_message",
      targetType: "chat_message",
      targetId: messageId,
      reason: action.reason,
      before: { status: "removed" },
      after: { status: "published", body },
      metadata: { roomId, moderationActionId: moderationRef.id },
    }),
  });
  await batch.commit();
  return { auditId: logRef.id };
}

async function resolveReport(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "resolve_report" }>,
) {
  const reference = firestore.collection("reports").doc(action.reportId);
  const snapshot = await reference.get();
  if (!snapshot.exists)
    throw new ApiError("Report not found", 404, "report_not_found");
  const before = record(snapshot.data());
  const after = {
    status: action.resolution,
    resolvedBy: actorUid,
    resolutionReason: action.reason,
    resolvedAt: FieldValue.serverTimestamp(),
  };
  const batch = firestore.batch();
  batch.set(reference, after, { merge: true });
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "resolve_report",
      targetType: "report",
      targetId: action.reportId,
      reason: action.reason,
      before,
      after,
    }),
  });
  await batch.commit();
  return { auditId: logRef.id };
}

async function sanctionUser(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "sanction_user" }>,
) {
  if (
    ["mute", "suspend"].includes(action.sanction) &&
    action.durationMinutes === undefined
  )
    throw new ApiError(
      "Temporary sanctions require a duration",
      400,
      "duration_required",
    );
  const { auth } = getFirebaseAdmin();
  const authUser = await auth.getUser(action.targetUid);
  const userRef = firestore.collection("users").doc(action.targetUid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists)
    throw new ApiError("User not found", 404, "user_not_found");
  const before = record(userSnapshot.data());
  const now = Timestamp.now();
  const expiry = action.durationMinutes
    ? Timestamp.fromMillis(now.toMillis() + action.durationMinutes * 60_000)
    : null;
  const batch = firestore.batch();
  let accountStatus = "active";
  if (action.sanction === "unban") {
    const active = await firestore
      .collection("userSanctions")
      .where("targetUid", "==", action.targetUid)
      .where("status", "==", "active")
      .get();
    active.docs.forEach((document) =>
      batch.set(
        document.ref,
        { status: "revoked", revokedBy: actorUid, revokedAt: now },
        { merge: true },
      ),
    );
    batch.set(
      userRef,
      {
        accountStatus: "active",
        "moderation.muteUntil": FieldValue.delete(),
        "moderation.suspensionUntil": FieldValue.delete(),
        updatedAt: now,
      },
      { merge: true },
    );
  } else {
    accountStatus =
      action.sanction === "ban"
        ? "banned"
        : action.sanction === "suspend"
          ? "suspended"
          : text(before.accountStatus, "active");
    const sanctionRef = firestore.collection("userSanctions").doc();
    batch.create(sanctionRef, {
      id: sanctionRef.id,
      targetUid: action.targetUid,
      actorUid,
      type: action.sanction,
      reason: action.reason,
      status: "active",
      ...(expiry ? { expiresAt: expiry } : {}),
      createdAt: now,
      updatedAt: now,
    });
    batch.set(
      userRef,
      {
        accountStatus,
        ...(action.sanction === "mute"
          ? { "moderation.muteUntil": expiry }
          : {}),
        ...(action.sanction === "suspend"
          ? { "moderation.suspensionUntil": expiry }
          : {}),
        updatedAt: now,
      },
      { merge: true },
    );
  }
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: `${action.sanction}_user`,
      targetType: "user",
      targetId: action.targetUid,
      reason: action.reason,
      before: {
        accountStatus: before.accountStatus,
        moderation: before.moderation,
      },
      after: { accountStatus, ...(expiry ? { expiresAt: expiry } : {}) },
    }),
  });
  await batch.commit();
  await auth.setCustomUserClaims(action.targetUid, {
    ...(authUser.customClaims ?? {}),
    accountStatus,
  });
  return { auditId: logRef.id };
}

async function setUserRoles(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "set_user_roles" }>,
) {
  const roles = [...new Set(action.roles)];
  if (action.targetUid === actorUid && !roles.includes("admin"))
    throw new ApiError(
      "You cannot remove your own admin role",
      409,
      "self_admin_removal",
    );
  const { auth } = getFirebaseAdmin();
  const [authUser, user] = await Promise.all([
    auth.getUser(action.targetUid),
    firestore.collection("users").doc(action.targetUid).get(),
  ]);
  if (!user.exists) throw new ApiError("User not found", 404, "user_not_found");
  await auth.setCustomUserClaims(action.targetUid, {
    ...(authUser.customClaims ?? {}),
    roles,
    admin: roles.includes("admin"),
    moderator: roles.includes("moderator"),
  });
  const batch = firestore.batch();
  batch.set(
    user.ref,
    { roles, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "set_user_roles",
      targetType: "user",
      targetId: action.targetUid,
      reason: action.reason,
      before: {
        roles: record(user.data()).roles,
        customClaims: authUser.customClaims,
      },
      after: { roles },
    }),
  });
  await batch.commit();
  return { auditId: logRef.id };
}

async function mergeFighters(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "merge_fighters" }>,
) {
  const primaryRef = firestore
    .collection("fighters")
    .doc(action.primaryFighterId);
  const duplicateRef = firestore
    .collection("fighters")
    .doc(action.duplicateFighterId);
  const [primarySnapshot, duplicateSnapshot, asA, asB, predictions, mappings] =
    await Promise.all([
      primaryRef.get(),
      duplicateRef.get(),
      firestore
        .collection("fights")
        .where("fighterAId", "==", action.duplicateFighterId)
        .limit(200)
        .get(),
      firestore
        .collection("fights")
        .where("fighterBId", "==", action.duplicateFighterId)
        .limit(200)
        .get(),
      firestore
        .collection("predictions")
        .where("pick.winnerFighterId", "==", action.duplicateFighterId)
        .limit(200)
        .get(),
      firestore
        .collection("providerMappings")
        .where("internalId", "==", action.duplicateFighterId)
        .limit(100)
        .get(),
    ]);
  if (!primarySnapshot.exists || !duplicateSnapshot.exists)
    throw new ApiError("Both fighters must exist", 404, "fighter_not_found");
  const primary = record(primarySnapshot.data());
  const duplicate = record(duplicateSnapshot.data());
  if (duplicate.mergedIntoFighterId)
    throw new ApiError("Duplicate was already merged", 409, "already_merged");
  const fights = [...asA.docs, ...asB.docs];
  if (
    fights.some((fight) => {
      const data = record(fight.data());
      return (
        data.fighterAId === action.primaryFighterId ||
        data.fighterBId === action.primaryFighterId
      );
    })
  )
    throw new ApiError(
      "These fighters appear in the same matchup and cannot be merged",
      409,
      "identity_conflict",
    );
  const operationCount = 4 + fights.length + predictions.size + mappings.size;
  if (operationCount > 440)
    throw new ApiError(
      "Merge exceeds the safe single-batch limit; use a reviewed migration",
      409,
      "merge_too_large",
    );
  const primaryName = record(primary.name);
  const primarySnapshotValue = {
    id: action.primaryFighterId,
    slug: text(primary.slug),
    name: primaryName,
    record: record(primary.record),
    ...(text(primary.countryCode)
      ? { countryCode: text(primary.countryCode) }
      : {}),
  };
  const batch = firestore.batch();
  fights.forEach((fight) => {
    const data = record(fight.data());
    const update =
      data.fighterAId === action.duplicateFighterId
        ? {
            fighterAId: action.primaryFighterId,
            fighterA: primarySnapshotValue,
          }
        : {
            fighterBId: action.primaryFighterId,
            fighterB: primarySnapshotValue,
          };
    batch.set(
      fight.ref,
      { ...update, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  });
  predictions.docs.forEach((prediction) =>
    batch.update(prediction.ref, {
      "pick.winnerFighterId": action.primaryFighterId,
      updatedAt: FieldValue.serverTimestamp(),
      identityMergeReview: {
        fromFighterId: action.duplicateFighterId,
        toFighterId: action.primaryFighterId,
        mergedAt: FieldValue.serverTimestamp(),
      },
    }),
  );
  mappings.docs.forEach((mapping) =>
    batch.set(
      mapping.ref,
      {
        internalId: action.primaryFighterId,
        matchMethod: "admin_identity_merge",
        mergedFromInternalId: action.duplicateFighterId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
  );
  const primarySlugs = [
    ...(Array.isArray(primary.slugHistory)
      ? primary.slugHistory.filter(
          (value): value is string => typeof value === "string",
        )
      : []),
    text(duplicate.slug),
    ...(Array.isArray(duplicate.slugHistory)
      ? duplicate.slugHistory.filter(
          (value): value is string => typeof value === "string",
        )
      : []),
  ].filter(Boolean);
  const upcomingEventIds = [
    ...(Array.isArray(primary.upcomingEventIds)
      ? primary.upcomingEventIds.filter(
          (value): value is string => typeof value === "string",
        )
      : []),
    ...(Array.isArray(duplicate.upcomingEventIds)
      ? duplicate.upcomingEventIds.filter(
          (value): value is string => typeof value === "string",
        )
      : []),
  ];
  batch.set(
    primaryRef,
    {
      slugHistory: [...new Set(primarySlugs)],
      upcomingEventIds: [...new Set(upcomingEventIds)],
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  batch.set(
    duplicateRef,
    {
      status: "inactive",
      dataQuality: "blocked",
      mergedIntoFighterId: action.primaryFighterId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  batch.set(
    firestore
      .collection("providerEntityState")
      .doc(`fighter_${action.duplicateFighterId}`),
    {
      mergedIntoFighterId: action.primaryFighterId,
      mergedBy: actorUid,
      mergedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "merge_fighters",
      targetType: "fighter",
      targetId: action.primaryFighterId,
      reason: action.reason,
      before: {
        primary: action.primaryFighterId,
        duplicate: action.duplicateFighterId,
      },
      after: {
        fightsUpdated: fights.length,
        predictionsUpdated: predictions.size,
        providerMappingsUpdated: mappings.size,
      },
    }),
  });
  await batch.commit();
  return { auditId: logRef.id };
}

function chatRoomDocument(
  roomId: string,
  eventId: string,
  startsAt: string,
  fightId?: string,
) {
  const starts = new Date(startsAt).getTime();
  return {
    id: roomId,
    type: fightId ? "fight_lobby" : "event_lobby",
    eventId,
    ...(fightId ? { fightId } : {}),
    status: "scheduled",
    opensAt: Timestamp.fromMillis(starts - 7 * 24 * 60 * 60 * 1_000),
    writableUntil: Timestamp.fromMillis(starts + 24 * 60 * 60 * 1_000),
    slowModeSeconds: 7,
    messageCount: 0,
    moderationHealth: "normal",
    monetizationEligible: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function manualImport(
  firestore: Firestore,
  actorUid: string,
  action: Extract<AdminAction, { action: "manual_import" }>,
) {
  let card;
  try {
    card = parseFixture(action.fixture);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Fixture validation failed",
      400,
      "invalid_fixture",
    );
  }
  requireConfirmation(action.confirmation, `IMPORT ${card.event.id}`);
  const existingEvent = await firestore
    .collection("events")
    .doc(card.event.id)
    .get();
  const existingFights = await Promise.all(
    card.fights.map((fight) =>
      firestore.collection("fights").doc(fight.id).get(),
    ),
  );
  const batch = firestore.batch();
  const previousEvent = record(existingEvent.data());
  batch.set(firestore.collection("events").doc(card.event.id), {
    ...card.event,
    ...(previousEvent.predictionSummary
      ? { predictionSummary: previousEvent.predictionSummary }
      : {}),
    ...(previousEvent.chatRoomId
      ? { chatRoomId: previousEvent.chatRoomId }
      : {}),
  });
  card.fighters.forEach((fighter) =>
    batch.set(
      firestore.collection("fighters").doc(fighter.id),
      { ...fighter, upcomingEventIds: FieldValue.arrayUnion(card.event.id) },
      { merge: true },
    ),
  );
  card.fights.forEach((fight, index) => {
    const previous = record(existingFights[index]?.data());
    batch.set(firestore.collection("fights").doc(fight.id), {
      ...fight,
      ...(previous.predictionSummary
        ? { predictionSummary: previous.predictionSummary }
        : {}),
      ...(previous.predictionStatus === "graded"
        ? {
            predictionStatus: "graded",
            gradingSummary: previous.gradingSummary,
          }
        : {}),
    });
    if (!previous.chatRoomId)
      batch.set(
        firestore.collection("chatRooms").doc(fight.chatRoomId),
        chatRoomDocument(
          fight.chatRoomId,
          card.event.id,
          card.event.startsAt,
          fight.id,
        ),
        { merge: true },
      );
  });
  if (!previousEvent.chatRoomId)
    batch.set(
      firestore.collection("chatRooms").doc(card.event.chatRoomId),
      chatRoomDocument(
        card.event.chatRoomId,
        card.event.id,
        card.event.startsAt,
      ),
      { merge: true },
    );
  const importRef = firestore.collection("manualImports").doc();
  batch.create(importRef, {
    id: importRef.id,
    actorUid,
    reason: action.reason,
    eventId: card.event.id,
    fixture: action.fixture,
    status: "complete",
    createdAt: FieldValue.serverTimestamp(),
  });
  const logRef = auditRef(firestore);
  batch.set(logRef, {
    id: logRef.id,
    ...adminAuditData({
      actorUid,
      action: "manual_json_import",
      targetType: "event",
      targetId: card.event.id,
      reason: action.reason,
      before: previousEvent,
      after: {
        event: card.event,
        fights: card.fights.length,
        fighters: card.fighters.length,
      },
      metadata: { importId: importRef.id },
    }),
  });
  await batch.commit();
  return { auditId: logRef.id, importId: importRef.id, eventId: card.event.id };
}

export async function executeAdminAction(
  action: AdminAction,
  actorUid: string,
) {
  const { firestore } = getFirebaseAdmin();
  switch (action.action) {
    case "update_event":
      requireConfirmation(action.confirmation, `UPDATE ${action.eventId}`);
      {
        const snapshot = await firestore
          .collection("events")
          .doc(action.eventId)
          .get();
        const previousEditorial = record(snapshot.get("editorial"));
        const { editorialSummary, editorialStatus, ...eventFields } =
          action.patch;
        const patch: Record<string, unknown> = { ...eventFields };
        if (editorialSummary || editorialStatus)
          patch.editorial = {
            ...previousEditorial,
            ...(editorialSummary ? { summary: editorialSummary } : {}),
            ...(editorialStatus ? { status: editorialStatus } : {}),
          };
        return updateWithOverride(firestore, {
          actorUid,
          entityType: "event",
          entityId: action.eventId,
          patch,
          reason: action.reason,
        });
      }
    case "update_fight":
      requireConfirmation(action.confirmation, `UPDATE ${action.fightId}`);
      {
        const snapshot = await firestore
          .collection("fights")
          .doc(action.fightId)
          .get();
        const previousEditorial = record(snapshot.get("editorial"));
        const {
          biggestQuestion,
          styleContrast,
          keysForFighterA,
          keysForFighterB,
          fightLobbyTake,
          editorialStatus,
          ...fightFields
        } = action.patch;
        const patch: Record<string, unknown> = { ...fightFields };
        if (
          biggestQuestion ||
          styleContrast ||
          keysForFighterA ||
          keysForFighterB ||
          fightLobbyTake ||
          editorialStatus
        )
          patch.editorial = {
            ...previousEditorial,
            ...(biggestQuestion ? { biggestQuestion } : {}),
            ...(styleContrast ? { styleContrast } : {}),
            ...(keysForFighterA ? { keysForFighterA } : {}),
            ...(keysForFighterB ? { keysForFighterB } : {}),
            ...(fightLobbyTake ? { fightLobbyTake } : {}),
            ...(editorialStatus ? { status: editorialStatus } : {}),
          };
        return updateWithOverride(firestore, {
          actorUid,
          entityType: "fight",
          entityId: action.fightId,
          patch,
          reason: action.reason,
        });
      }
    case "update_fighter": {
      requireConfirmation(action.confirmation, `UPDATE ${action.fighterId}`);
      const snapshot = await firestore
        .collection("fighters")
        .doc(action.fighterId)
        .get();
      const previousName = record(snapshot.get("name"));
      const patch: Record<string, unknown> = { ...action.patch };
      if (action.patch.fullName || action.patch.nickname !== undefined) {
        const full =
          action.patch.fullName ?? text(previousName.full, "Unknown fighter");
        const { nickname: _previousNickname, ...nameWithoutNickname } =
          previousName;
        void _previousNickname;
        patch.name = {
          ...(action.patch.nickname === ""
            ? nameWithoutNickname
            : previousName),
          full,
          normalized: full
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim(),
          ...(action.patch.nickname ? { nickname: action.patch.nickname } : {}),
        };
        delete patch.fullName;
        delete patch.nickname;
      }
      return updateWithOverride(firestore, {
        actorUid,
        entityType: "fighter",
        entityId: action.fighterId,
        patch,
        reason: action.reason,
      });
    }
    case "reorder_card":
      requireConfirmation(action.confirmation, `REORDER ${action.eventId}`);
      return reorderCard(firestore, actorUid, action);
    case "prediction_control":
      requireConfirmation(
        action.confirmation,
        `${action.operation.toUpperCase()} ${action.fightId}`,
      );
      return predictionControl(firestore, actorUid, action);
    case "correct_result":
      requireConfirmation(action.confirmation, `RESULT ${action.fightId}`);
      return correctResult(firestore, actorUid, action);
    case "feature_flags":
      requireConfirmation(action.confirmation, "UPDATE FEATURE FLAGS");
      return updateFeatureFlags(firestore, actorUid, action);
    case "room_control":
      requireConfirmation(action.confirmation, `ROOM ${action.roomId}`);
      return roomControl(firestore, actorUid, action);
    case "remove_message":
      requireConfirmation(action.confirmation, `REMOVE ${action.messageId}`);
      return removeMessage(firestore, actorUid, action);
    case "restore_message":
      requireConfirmation(
        action.confirmation,
        `RESTORE ${action.moderationActionId}`,
      );
      return restoreMessage(firestore, actorUid, action);
    case "resolve_report":
      requireConfirmation(action.confirmation, `RESOLVE ${action.reportId}`);
      return resolveReport(firestore, actorUid, action);
    case "sanction_user":
      requireConfirmation(
        action.confirmation,
        `${action.sanction.toUpperCase()} ${action.targetUid}`,
      );
      return sanctionUser(firestore, actorUid, action);
    case "set_user_roles":
      requireConfirmation(action.confirmation, `ROLES ${action.targetUid}`);
      return setUserRoles(firestore, actorUid, action);
    case "merge_fighters":
      requireConfirmation(
        action.confirmation,
        `MERGE ${action.duplicateFighterId} INTO ${action.primaryFighterId}`,
      );
      return mergeFighters(firestore, actorUid, action);
    case "manual_import":
      return manualImport(firestore, actorUid, action);
  }
}

export function confirmationFor(action: AdminAction) {
  switch (action.action) {
    case "update_event":
      return `UPDATE ${action.eventId}`;
    case "update_fight":
      return `UPDATE ${action.fightId}`;
    case "update_fighter":
      return `UPDATE ${action.fighterId}`;
    case "reorder_card":
      return `REORDER ${action.eventId}`;
    case "prediction_control":
      return `${action.operation.toUpperCase()} ${action.fightId}`;
    case "correct_result":
      return `RESULT ${action.fightId}`;
    case "feature_flags":
      return "UPDATE FEATURE FLAGS";
    case "room_control":
      return `ROOM ${action.roomId}`;
    case "remove_message":
      return `REMOVE ${action.messageId}`;
    case "restore_message":
      return `RESTORE ${action.moderationActionId}`;
    case "resolve_report":
      return `RESOLVE ${action.reportId}`;
    case "sanction_user":
      return `${action.sanction.toUpperCase()} ${action.targetUid}`;
    case "set_user_roles":
      return `ROLES ${action.targetUid}`;
    case "merge_fighters":
      return `MERGE ${action.duplicateFighterId} INTO ${action.primaryFighterId}`;
    case "manual_import": {
      const eventId = record(record(action.fixture).event).id;
      return `IMPORT ${text(eventId, "event-id")}`;
    }
  }
}
