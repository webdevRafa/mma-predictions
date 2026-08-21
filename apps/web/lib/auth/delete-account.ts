import { createHash } from "node:crypto";

import type { Auth } from "firebase-admin/auth";
import type { Database } from "firebase-admin/database";
import {
  FieldValue,
  type Firestore,
  type Query,
} from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

const PAGE_SIZE = 100;
const DELETED_HANDLE = "deleted-member";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function deletedIdentity(uid: string) {
  return `deleted_${createHash("sha256").update(uid).digest("hex").slice(0, 20)}`;
}

async function deleteQueryRecursively(query: Query) {
  while (true) {
    const snapshot = await query.limit(PAGE_SIZE).get();
    if (snapshot.empty) return;
    await Promise.all(
      snapshot.docs.map((document) =>
        document.ref.firestore.recursiveDelete(document.ref),
      ),
    );
  }
}

async function updateQuery(query: Query, update: Record<string, unknown>) {
  while (true) {
    const snapshot = await query.limit(PAGE_SIZE).get();
    if (snapshot.empty) return;
    const writer = snapshot.docs[0]?.ref.firestore.bulkWriter();
    if (!writer) return;
    for (const document of snapshot.docs)
      void writer.update(document.ref, update);
    await writer.close();
    if (snapshot.size < PAGE_SIZE) return;
  }
}

async function redactPublicDiscussion(firestore: Firestore, uid: string) {
  const identity = deletedIdentity(uid);
  const redaction = {
    uid: identity,
    author: { handle: DELETED_HANDLE },
    body: "[Post deleted by member]",
    bodyNormalizedHash: createHash("sha256")
      .update("[Post deleted by member]")
      .digest("hex"),
    status: "removed",
    updatedAt: Date.now(),
  };
  await Promise.all([
    updateQuery(
      firestore.collectionGroup("posts").where("uid", "==", uid),
      redaction,
    ),
    updateQuery(
      firestore.collectionGroup("replies").where("uid", "==", uid),
      redaction,
    ),
  ]);
  const replySnapshot = {
    uid: identity,
    handle: DELETED_HANDLE,
    excerpt: "[Deleted]",
  };
  await Promise.all([
    updateQuery(
      firestore.collectionGroup("posts").where("replyTo.uid", "==", uid),
      {
        "replyTo.uid": replySnapshot.uid,
        "replyTo.handle": replySnapshot.handle,
        "replyTo.excerpt": replySnapshot.excerpt,
      },
    ),
    updateQuery(
      firestore.collectionGroup("replies").where("replyTo.uid", "==", uid),
      {
        "replyTo.uid": replySnapshot.uid,
        "replyTo.handle": replySnapshot.handle,
        "replyTo.excerpt": replySnapshot.excerpt,
      },
    ),
  ]);
}

async function redactOperationalRecords(firestore: Firestore, uid: string) {
  const identity = deletedIdentity(uid);
  await Promise.all([
    deleteQueryRecursively(
      firestore.collection("discussionRateLimits").where("uid", "==", uid),
    ),
    deleteQueryRecursively(
      firestore.collection("discussionModeration").where("uid", "==", uid),
    ),
    deleteQueryRecursively(
      firestore.collection("chatModeration").where("uid", "==", uid),
    ),
    deleteQueryRecursively(
      firestore.collection("userSanctions").where("targetUid", "==", uid),
    ),
    updateQuery(
      firestore.collection("reports").where("reporterUid", "==", uid),
      {
        reporterUid: identity,
        note: FieldValue.delete(),
      },
    ),
    updateQuery(firestore.collection("reports").where("targetUid", "==", uid), {
      targetUid: identity,
      messageSnapshot: FieldValue.delete(),
      postSnapshot: FieldValue.delete(),
    }),
    updateQuery(firestore.collection("auditLogs").where("uid", "==", uid), {
      uid: identity,
    }),
    updateQuery(
      firestore.collection("moderationActions").where("targetUid", "==", uid),
      {
        targetUid: identity,
        messageSnapshot: FieldValue.delete(),
        postSnapshot: FieldValue.delete(),
      },
    ),
    updateQuery(
      firestore.collection("moderationActions").where("actorUid", "==", uid),
      { actorUid: identity },
    ),
    updateQuery(
      firestore.collection("auditLogs").where("actorUid", "==", uid),
      { actorUid: identity },
    ),
  ]);
}

async function removeRealtimeData(database: Database, uid: string) {
  const updates: Record<string, unknown> = {
    [`chat/v1/presence/${uid}`]: null,
    [`chat/v1/rateLimits/${uid}`]: null,
  };
  const rooms = record((await database.ref("chat/v1/rooms").get()).val());
  const identity = deletedIdentity(uid);
  for (const [roomId, roomValue] of Object.entries(rooms)) {
    const messages = record(record(roomValue).messages);
    for (const [messageId, messageValue] of Object.entries(messages)) {
      const message = record(messageValue);
      const path = `chat/v1/rooms/${roomId}/messages/${messageId}`;
      if (message.uid === uid) {
        updates[path] = null;
        continue;
      }
      const replyTo = record(message.replyTo);
      if (replyTo.uid === uid) {
        updates[`${path}/replyTo/uid`] = identity;
        updates[`${path}/replyTo/handle`] = DELETED_HANDLE;
        updates[`${path}/replyTo/excerpt`] = "[Deleted]";
      }
    }
  }
  const entries = Object.entries(updates);
  for (let index = 0; index < entries.length; index += 400) {
    await database
      .ref()
      .update(Object.fromEntries(entries.slice(index, index + 400)));
  }
}

async function removeStorageData(
  storage: Storage,
  uid: string,
  avatarStoragePath?: string,
) {
  const bucket = storage.bucket();
  const prefixes = [`users/${uid}/`, `profiles/${uid}/`];
  await Promise.all(prefixes.map((prefix) => bucket.deleteFiles({ prefix })));
  if (avatarStoragePath) {
    try {
      await bucket.file(avatarStoragePath).delete();
    } catch (error) {
      const code = record(error).code;
      if (code !== 404) throw error;
    }
  }
}

export interface AccountDeletionServices {
  auth: Auth;
  firestore: Firestore;
  database: Database;
  storage: Storage;
}

/**
 * Permanently removes an account's private records and authentication identity.
 * Public conversation entries are redacted so other members' thread context is
 * not silently destroyed. Security/audit records retain only an irreversible ID.
 */
export async function permanentlyDeleteAccount(
  services: AccountDeletionServices,
  uid: string,
) {
  const { auth, database, firestore, storage } = services;
  const profileRef = firestore.collection("profiles").doc(uid);
  const userRef = firestore.collection("users").doc(uid);
  const profile = await profileRef.get();
  const handle: unknown = profile.get("handleNormalized");
  const avatarStoragePath = record(profile.get("avatar")).storagePath;

  await Promise.all([
    deleteQueryRecursively(
      firestore.collection("predictions").where("uid", "==", uid),
    ),
    deleteQueryRecursively(
      firestore.collectionGroup("entries").where("uid", "==", uid),
    ),
    deleteQueryRecursively(
      firestore.collectionGroup("follows").where("targetUid", "==", uid),
    ),
    deleteQueryRecursively(
      firestore.collectionGroup("blocks").where("targetUid", "==", uid),
    ),
    firestore.recursiveDelete(firestore.collection("achievements").doc(uid)),
    redactPublicDiscussion(firestore, uid),
    redactOperationalRecords(firestore, uid),
    removeRealtimeData(database, uid),
    removeStorageData(
      storage,
      uid,
      typeof avatarStoragePath === "string" ? avatarStoragePath : undefined,
    ),
  ]);

  await Promise.all([
    firestore.recursiveDelete(userRef),
    firestore.recursiveDelete(profileRef),
  ]);
  if (typeof handle === "string") {
    await firestore.collection("handles").doc(handle).set(
      {
        uid: FieldValue.delete(),
        releasedAt: FieldValue.serverTimestamp(),
        quarantined: true,
      },
      { merge: true },
    );
  }
  await auth.deleteUser(uid);
}
