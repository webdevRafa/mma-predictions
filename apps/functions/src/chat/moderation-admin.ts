import { chatMessageSchema } from "@fightlobby/domain";
import type { Auth } from "firebase-admin/auth";
import type { Database } from "firebase-admin/database";
import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";

import { requireRole } from "../auth/roles.js";
import { getAdminServices } from "../lib/firebase/admin.js";

const CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

const removeInputSchema = z
  .object({
    roomId: z.string().regex(/^[a-z0-9_-]{3,160}$/i),
    messageId: z.string().min(8).max(120),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

const sanctionInputSchema = z
  .object({
    targetUid: z.string().min(3).max(128),
    type: z.enum(["mute", "suspend", "ban"]),
    reason: z.string().trim().min(3).max(500),
    durationMinutes: z.number().int().min(5).max(43_200).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type !== "ban" && value.durationMinutes === undefined)
      context.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "A duration is required for temporary sanctions",
      });
  });

export async function removeChatMessageCore(
  firestore: Firestore,
  database: Database,
  actorUid: string,
  input: z.infer<typeof removeInputSchema>,
) {
  const reference = database.ref(
    `chat/v1/rooms/${input.roomId}/messages/${input.messageId}`,
  );
  const snapshot = await reference.get();
  const message = chatMessageSchema.safeParse(snapshot.val());
  if (!message.success) throw new Error("Chat message was not found");
  const actionRef = firestore.collection("moderationActions").doc();
  await actionRef.create({
    id: actionRef.id,
    type: "remove_chat_message",
    actorUid,
    targetUid: message.data.uid,
    roomId: input.roomId,
    messageId: input.messageId,
    reason: input.reason,
    messageSnapshot: message.data,
    createdAt: FieldValue.serverTimestamp(),
  });
  await reference.update({
    body: "Message removed by moderation",
    status: "removed",
  });
  await firestore
    .collection("auditLogs")
    .doc(`moderation_${actionRef.id}`)
    .set({
      type: "chat_message_removed",
      actionId: actionRef.id,
      actorUid,
      targetUid: message.data.uid,
      roomId: input.roomId,
      messageId: input.messageId,
      reason: input.reason,
      createdAt: FieldValue.serverTimestamp(),
    });
  return { actionId: actionRef.id, removed: true };
}

export async function applyUserSanctionCore(
  firestore: Firestore,
  auth: Auth,
  actorUid: string,
  input: z.infer<typeof sanctionInputSchema>,
) {
  const now = Timestamp.now();
  const expiresAt = input.durationMinutes
    ? Timestamp.fromMillis(now.toMillis() + input.durationMinutes * 60_000)
    : null;
  const sanctionRef = firestore.collection("userSanctions").doc();
  const userRef = firestore.collection("users").doc(input.targetUid);
  const moderationUpdate =
    input.type === "mute"
      ? { "moderation.muteUntil": expiresAt }
      : input.type === "suspend"
        ? { "moderation.suspensionUntil": expiresAt }
        : {};
  const accountStatus =
    input.type === "ban"
      ? "banned"
      : input.type === "suspend"
        ? "suspended"
        : "active";
  const batch = firestore.batch();
  batch.set(sanctionRef, {
    id: sanctionRef.id,
    targetUid: input.targetUid,
    actorUid,
    type: input.type,
    reason: input.reason,
    status: "active",
    ...(expiresAt ? { expiresAt } : {}),
    createdAt: now,
    updatedAt: now,
  });
  batch.set(
    userRef,
    {
      accountStatus,
      ...moderationUpdate,
      updatedAt: now,
    },
    { merge: true },
  );
  batch.set(
    firestore.collection("auditLogs").doc(`sanction_${sanctionRef.id}`),
    {
      type: "user_sanction_applied",
      sanctionId: sanctionRef.id,
      targetUid: input.targetUid,
      actorUid,
      sanctionType: input.type,
      reason: input.reason,
      ...(expiresAt ? { expiresAt } : {}),
      createdAt: now,
    },
  );
  await batch.commit();
  const user = await auth.getUser(input.targetUid);
  await auth.setCustomUserClaims(input.targetUid, {
    ...(user.customClaims ?? {}),
    accountStatus,
  });
  return {
    sanctionId: sanctionRef.id,
    accountStatus,
    ...(expiresAt ? { expiresAt: expiresAt.toDate().toISOString() } : {}),
  };
}

export async function closeExpiredChatRoomsCore(
  firestore: Firestore,
  now = Timestamp.now(),
) {
  const [openingSnapshot, closingSnapshot] = await Promise.all([
    firestore
      .collection("chatRooms")
      .where("opensAt", "<=", now)
      .limit(400)
      .get(),
    firestore
      .collection("chatRooms")
      .where("writableUntil", "<=", now)
      .limit(400)
      .get(),
  ]);
  const writer = firestore.bulkWriter();
  let opened = 0;
  let closed = 0;
  for (const room of openingSnapshot.docs) {
    if (room.get("status") !== "scheduled") continue;
    const writableUntil: unknown = room.get("writableUntil");
    const expired =
      writableUntil instanceof Timestamp &&
      writableUntil.toMillis() <= now.toMillis();
    void writer.set(
      room.ref,
      {
        status: expired ? "read_only" : "open",
        ...(expired && !(room.get("retentionExpiresAt") instanceof Timestamp)
          ? {
              retentionExpiresAt: Timestamp.fromMillis(
                writableUntil.toMillis() + CHAT_RETENTION_MS,
              ),
            }
          : {}),
        updatedAt: now,
      },
      { merge: true },
    );
    if (expired) closed += 1;
    else opened += 1;
  }
  for (const room of closingSnapshot.docs) {
    const status = String(room.get("status"));
    const writableUntil: unknown = room.get("writableUntil");
    const retentionExpiresAt: unknown = room.get("retentionExpiresAt");
    const needsRetentionBackfill =
      writableUntil instanceof Timestamp &&
      !(retentionExpiresAt instanceof Timestamp);
    if (!["open", "slow_mode"].includes(status) && !needsRetentionBackfill)
      continue;
    void writer.set(
      room.ref,
      {
        ...(["open", "slow_mode"].includes(status)
          ? { status: "read_only" }
          : {}),
        ...(needsRetentionBackfill
          ? {
              retentionExpiresAt: Timestamp.fromMillis(
                writableUntil.toMillis() + CHAT_RETENTION_MS,
              ),
            }
          : {}),
        updatedAt: now,
      },
      { merge: true },
    );
    if (["open", "slow_mode"].includes(status)) closed += 1;
  }
  await writer.close();
  return {
    examined: openingSnapshot.size + closingSnapshot.size,
    opened,
    closed,
  };
}

export async function purgeExpiredChatMessagesCore(
  firestore: Firestore,
  database: Database,
  now = Timestamp.now(),
) {
  const snapshot = await firestore
    .collection("chatRooms")
    .where("retentionExpiresAt", "<=", now)
    .limit(100)
    .get();
  let purged = 0;
  let failed = 0;
  for (const room of snapshot.docs) {
    try {
      await database.ref(`chat/v1/rooms/${room.id}/messages`).remove();
      await room.ref.set(
        {
          messageCount: 0,
          messagesPurgedAt: now,
          retentionExpiresAt: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true },
      );
      purged += 1;
    } catch {
      failed += 1;
    }
  }
  return { examined: snapshot.size, purged, failed };
}

export async function expireUserSanctionsCore(
  firestore: Firestore,
  auth: Auth,
  now = Timestamp.now(),
) {
  const snapshot = await firestore
    .collection("userSanctions")
    .where("expiresAt", "<=", now)
    .limit(400)
    .get();
  const expired = snapshot.docs.filter(
    (sanction) => sanction.get("status") === "active",
  );
  const affectedUids = new Set(
    expired.flatMap((sanction) => {
      const uid: unknown = sanction.get("targetUid");
      return typeof uid === "string" ? [uid] : [];
    }),
  );
  const writer = firestore.bulkWriter();
  for (const sanction of expired)
    void writer.set(
      sanction.ref,
      { status: "expired", updatedAt: now },
      { merge: true },
    );
  await writer.close();
  await Promise.all(
    [...affectedUids].map(async (uid) => {
      const sanctions = await firestore
        .collection("userSanctions")
        .where("targetUid", "==", uid)
        .get();
      const activeSanctions: {
        type: "mute" | "suspend" | "ban";
        expiresAt: Timestamp | null;
      }[] = sanctions.docs.flatMap((sanction) => {
        if (sanction.get("status") !== "active") return [];
        const expiresAt: unknown = sanction.get("expiresAt");
        if (
          expiresAt instanceof Timestamp &&
          expiresAt.toMillis() <= now.toMillis()
        )
          return [];
        const type: unknown = sanction.get("type");
        return type === "mute" || type === "suspend" || type === "ban"
          ? [
              {
                type,
                expiresAt: expiresAt instanceof Timestamp ? expiresAt : null,
              },
            ]
          : [];
      });
      const activeTypes = activeSanctions.map((sanction) => sanction.type);
      const latestExpiry = (type: "mute" | "suspend") =>
        activeSanctions
          .filter(
            (sanction) => sanction.type === type && sanction.expiresAt !== null,
          )
          .reduce<Timestamp | null>(
            (latest, sanction) =>
              !latest || sanction.expiresAt!.toMillis() > latest.toMillis()
                ? sanction.expiresAt
                : latest,
            null,
          );
      const muteUntil = latestExpiry("mute");
      const suspensionUntil = latestExpiry("suspend");
      const accountStatus = activeTypes.includes("ban")
        ? "banned"
        : activeTypes.includes("suspend")
          ? "suspended"
          : "active";
      await firestore
        .collection("users")
        .doc(uid)
        .set(
          {
            accountStatus,
            "moderation.muteUntil": muteUntil ?? FieldValue.delete(),
            "moderation.suspensionUntil":
              suspensionUntil ?? FieldValue.delete(),
            updatedAt: now,
          },
          { merge: true },
        );
      const user = await auth.getUser(uid);
      await auth.setCustomUserClaims(uid, {
        ...(user.customClaims ?? {}),
        accountStatus,
      });
    }),
  );
  return { expired: expired.length, affectedUsers: affectedUids.size };
}

export const removeChatMessage = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireRole(request.auth?.token, ["moderator", "admin"]);
    const input = removeInputSchema.safeParse(request.data);
    if (!input.success)
      throw new HttpsError("invalid-argument", "Invalid moderation action");
    try {
      const { firestore, database } = getAdminServices();
      return await removeChatMessageCore(
        firestore,
        database,
        request.auth!.uid,
        input.data,
      );
    } catch (error) {
      throw new HttpsError(
        "failed-precondition",
        error instanceof Error ? error.message : "Message could not be removed",
      );
    }
  },
);

export const applyUserSanction = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireRole(request.auth?.token, ["moderator", "admin"]);
    const input = sanctionInputSchema.safeParse(request.data);
    if (!input.success)
      throw new HttpsError("invalid-argument", "Invalid sanction request");
    try {
      const { firestore, auth } = getAdminServices();
      return await applyUserSanctionCore(
        firestore,
        auth,
        request.auth!.uid,
        input.data,
      );
    } catch (error) {
      throw new HttpsError(
        "failed-precondition",
        error instanceof Error
          ? error.message
          : "Sanction could not be applied",
      );
    }
  },
);

export const closeExpiredChatRooms = onSchedule(
  { schedule: "every 60 minutes", timeZone: "Etc/UTC" },
  async () => {
    await closeExpiredChatRoomsCore(getAdminServices().firestore);
  },
);

export const purgeExpiredChatMessages = onSchedule(
  { schedule: "every day 03:15", timeZone: "Etc/UTC" },
  async () => {
    const { firestore, database } = getAdminServices();
    await purgeExpiredChatMessagesCore(firestore, database);
  },
);

export const expireUserSanctions = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Etc/UTC" },
  async () => {
    const { firestore, auth } = getAdminServices();
    await expireUserSanctionsCore(firestore, auth);
  },
);
