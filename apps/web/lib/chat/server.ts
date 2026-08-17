import { createHash } from "node:crypto";

import {
  CHAT_DUPLICATE_WINDOW_MS,
  accountStatusSchema,
  chatMessageSchema,
  moderateChatBody,
  userRoleSchema,
  type AccountStatus,
  type ChatMessage,
  type ChatRoleBadge,
  type UserRole,
} from "@fightlobby/domain";
import type { Database } from "firebase-admin/database";
import {
  FieldValue,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";

import { ApiError } from "../auth/http";

const CHAT_MODERATION_VERSION = 1;
const CHAT_BURST_WINDOW_MS = 30_000;
const CHAT_MAX_BURST = 3;

export interface ChatMemberContext {
  uid: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  accountStatus: AccountStatus;
  roles: UserRole[];
  handle?: string;
}

export interface PostChatMessageInput {
  roomId: string;
  body: string;
  clientNonce: string;
  replyToMessageId?: string | undefined;
  nowMilliseconds?: number | undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function safeRoomId(value: string) {
  if (!/^[a-z0-9_-]{3,160}$/i.test(value))
    throw new ApiError("Invalid chat room", 400, "invalid_room");
  return value;
}

function timestampMilliseconds(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function roleBadge(roles: UserRole[]): ChatRoleBadge | undefined {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("moderator")) return "moderator";
  if (roles.includes("trusted")) return "trusted";
  return undefined;
}

function rolesFromUser(snapshot: DocumentSnapshot, fallback: UserRole[]) {
  const candidate: unknown = snapshot.get("roles");
  if (!Array.isArray(candidate)) return fallback;
  const roles = candidate.flatMap((value) => {
    const parsed = userRoleSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  return roles.length > 0 ? roles : fallback;
}

function postingCooldownSeconds(
  roles: UserRole[],
  user: DocumentSnapshot,
  roomSlowMode: number,
  nowMilliseconds: number,
) {
  const moderation = record(user.get("moderation"));
  const trustLevel =
    typeof moderation.trustLevel === "number" ? moderation.trustLevel : 0;
  const joinedAt = timestampMilliseconds(user.get("createdAt"));
  const isNew =
    trustLevel <= 0 ||
    joinedAt === null ||
    nowMilliseconds - joinedAt < 7 * 24 * 60 * 60 * 1_000;
  const memberSeconds = roles.some((role) =>
    ["trusted", "moderator", "admin"].includes(role),
  )
    ? 3
    : isNew
      ? 15
      : 7;
  return Math.max(memberSeconds, roomSlowMode);
}

function assertMemberCanPost(
  member: ChatMemberContext,
  user: DocumentSnapshot,
  nowMilliseconds: number,
) {
  if (!user.exists)
    throw new ApiError(
      "This account cannot post in chat",
      403,
      "chat_account_missing",
    );
  if (!member.emailVerified)
    throw new ApiError(
      "Verify your email before posting",
      403,
      "email_verification_required",
    );
  if (!member.onboardingComplete || !member.handle)
    throw new ApiError(
      "Choose a handle before posting",
      409,
      "onboarding_required",
    );
  const currentStatus = accountStatusSchema.safeParse(
    user.get("accountStatus"),
  );
  const accountStatus = currentStatus.success
    ? currentStatus.data
    : member.accountStatus;
  if (accountStatus !== "active")
    throw new ApiError(
      "This account cannot post in chat",
      403,
      `chat_${accountStatus}`,
    );
  const muteUntil = timestampMilliseconds(
    record(user.get("moderation")).muteUntil,
  );
  if (muteUntil !== null && muteUntil > nowMilliseconds)
    throw new ApiError("Chat access is temporarily muted", 403, "chat_muted");
}

async function enforceRateLimit(
  database: Database,
  uid: string,
  roomId: string,
  bodyHash: string,
  cooldownSeconds: number,
  nowMilliseconds: number,
) {
  const bucketKey = sha256(roomId).slice(0, 24);
  const rateRef = database.ref(`chat/v1/rateLimits/${uid}/${bucketKey}`);
  let rejected: "duplicate" | "cooldown" | "burst" | null = null;
  const result = await rateRef.transaction(
    (current: unknown) => {
      rejected = null;
      const value = record(current);
      const lastAt =
        typeof value.lastAt === "number"
          ? value.lastAt
          : Number.NEGATIVE_INFINITY;
      const lastHash = typeof value.lastHash === "string" ? value.lastHash : "";
      const lastHashAt =
        typeof value.lastHashAt === "number"
          ? value.lastHashAt
          : Number.NEGATIVE_INFINITY;
      const recent = Array.isArray(value.recent)
        ? value.recent.filter(
            (entry): entry is number =>
              typeof entry === "number" &&
              entry > nowMilliseconds - CHAT_BURST_WINDOW_MS,
          )
        : [];
      if (
        lastHash === bodyHash &&
        nowMilliseconds - lastHashAt < CHAT_DUPLICATE_WINDOW_MS
      ) {
        rejected = "duplicate";
        return;
      }
      if (nowMilliseconds - lastAt < cooldownSeconds * 1_000) {
        rejected = "cooldown";
        return;
      }
      if (recent.length >= CHAT_MAX_BURST) {
        rejected = "burst";
        return;
      }
      return {
        lastAt: nowMilliseconds,
        lastHash: bodyHash,
        lastHashAt: nowMilliseconds,
        recent: [...recent, nowMilliseconds].slice(-CHAT_MAX_BURST),
      };
    },
    undefined,
    false,
  );
  if (result.committed) return;
  if (rejected === "duplicate")
    throw new ApiError(
      "Duplicate messages are blocked for one minute",
      429,
      "chat_duplicate",
    );
  if (rejected === "burst")
    throw new ApiError(
      "Chat is moving quickly. Pause before sending again",
      429,
      "chat_burst_limited",
    );
  throw new ApiError(
    `Wait ${cooldownSeconds} seconds between messages`,
    429,
    "chat_slow_mode",
  );
}

async function replySnapshot(
  database: Database,
  roomId: string,
  messageId?: string,
) {
  if (!messageId) return undefined;
  const snapshot = await database
    .ref(`chat/v1/rooms/${roomId}/messages/${messageId}`)
    .get();
  const parsed = chatMessageSchema.safeParse(snapshot.val());
  if (!parsed.success || parsed.data.status !== "published")
    throw new ApiError(
      "The message you replied to is unavailable",
      409,
      "reply_unavailable",
    );
  return {
    messageId: parsed.data.id,
    uid: parsed.data.uid,
    handle: parsed.data.author.handle,
    excerpt: [...parsed.data.body].slice(0, 80).join(""),
  };
}

export async function postChatMessageCore(
  firestore: Firestore,
  database: Database,
  member: ChatMemberContext,
  input: PostChatMessageInput,
) {
  const roomId = safeRoomId(input.roomId);
  const nowMilliseconds = input.nowMilliseconds ?? Date.now();
  const moderation = moderateChatBody(input.body);
  if (!moderation.accepted)
    throw new ApiError(moderation.message, 422, `chat_${moderation.code}`);
  const [user, profile, room, flags] = await Promise.all([
    firestore.collection("users").doc(member.uid).get(),
    firestore.collection("profiles").doc(member.uid).get(),
    firestore.collection("chatRooms").doc(roomId).get(),
    firestore.collection("featureFlags").doc("current").get(),
  ]);
  assertMemberCanPost(member, user, nowMilliseconds);
  if (flags.exists && flags.get("siteReadOnly") === true)
    throw new ApiError(
      "FightLobby is temporarily read-only",
      503,
      "site_read_only",
    );
  if (flags.exists && flags.get("chatEnabled") === false)
    throw new ApiError("Chat is temporarily disabled", 503, "chat_disabled");
  if (flags.exists && flags.get("chatPostingEnabled") === false)
    throw new ApiError("Chat is currently read-only", 409, "chat_read_only");
  if (!room.exists)
    throw new ApiError("Chat room not found", 404, "chat_room_missing");
  const roomStatus: unknown = room.get("status");
  if (room.get("moderationHealth") === "locked")
    throw new ApiError(
      "This room is locked for moderation",
      409,
      "chat_moderation_locked",
    );
  const opensAt = timestampMilliseconds(room.get("opensAt"));
  const writableUntil = timestampMilliseconds(room.get("writableUntil"));
  if (
    !["open", "slow_mode"].includes(String(roomStatus)) ||
    (opensAt !== null && nowMilliseconds < opensAt) ||
    (writableUntil !== null && nowMilliseconds >= writableUntil)
  )
    throw new ApiError("This chat room is read-only", 409, "chat_read_only");
  const handle: unknown = profile.get("handle");
  if (typeof handle !== "string" || handle !== member.handle)
    throw new ApiError(
      "Your public profile is incomplete",
      409,
      "onboarding_required",
    );
  const roles = rolesFromUser(user, member.roles);
  const bodyHash = sha256(moderation.normalizedBody);
  const messageId = sha256(
    `${roomId}:${member.uid}:${input.clientNonce}`,
  ).slice(0, 40);
  const messageRef = database.ref(
    `chat/v1/rooms/${roomId}/messages/${messageId}`,
  );
  const existing = chatMessageSchema.safeParse((await messageRef.get()).val());
  if (existing.success && existing.data.uid === member.uid)
    return { message: existing.data, idempotent: true };
  const rawSlowMode: unknown = room.get("slowModeSeconds");
  const roomSlowMode =
    typeof rawSlowMode === "number" ? Math.max(rawSlowMode, 0) : 0;
  const cooldownSeconds = postingCooldownSeconds(
    roles,
    user,
    roomSlowMode,
    nowMilliseconds,
  );
  try {
    await enforceRateLimit(
      database,
      member.uid,
      roomId,
      bodyHash,
      cooldownSeconds,
      nowMilliseconds,
    );
  } catch (error) {
    const raced = chatMessageSchema.safeParse((await messageRef.get()).val());
    if (raced.success && raced.data.uid === member.uid)
      return { message: raced.data, idempotent: true };
    throw error;
  }
  const avatar = record(profile.get("avatar"));
  const replyTo = await replySnapshot(database, roomId, input.replyToMessageId);
  const badge = roleBadge(roles);
  const message: ChatMessage = {
    id: messageId,
    roomId,
    uid: member.uid,
    author: {
      handle,
      avatarVersion:
        typeof avatar.version === "number" ? Math.max(avatar.version, 0) : 0,
      ...(badge ? { roleBadge: badge } : {}),
    },
    body: moderation.body,
    bodyNormalizedHash: bodyHash,
    ...(replyTo ? { replyTo } : {}),
    createdAt: nowMilliseconds,
    clientNonce: input.clientNonce,
    status: "published",
    moderationVersion: CHAT_MODERATION_VERSION,
  };
  const publication = await messageRef.transaction(
    (current: unknown) => current ?? message,
    undefined,
    false,
  );
  const published = chatMessageSchema.safeParse(publication.snapshot.val());
  if (!published.success)
    throw new ApiError(
      "Message publication failed",
      500,
      "chat_publish_failed",
    );
  const batch = firestore.batch();
  batch.set(
    firestore.collection("chatModeration").doc(messageId),
    {
      messageId,
      roomId,
      uid: member.uid,
      decision: moderation.decision,
      signals: moderation.signals,
      bodyNormalizedHash: bodyHash,
      moderationVersion: CHAT_MODERATION_VERSION,
      createdAt: Timestamp.fromMillis(nowMilliseconds),
    },
    { merge: true },
  );
  batch.set(
    room.ref,
    {
      messageCount: FieldValue.increment(publication.committed ? 1 : 0),
      lastMessageAt: Timestamp.fromMillis(nowMilliseconds),
      updatedAt: Timestamp.fromMillis(nowMilliseconds),
    },
    { merge: true },
  );
  batch.set(
    firestore.collection("auditLogs").doc(`chat_publish_${messageId}`),
    {
      type: "chat_message_publication",
      messageId,
      roomId,
      uid: member.uid,
      decision: moderation.decision,
      signals: moderation.signals,
      createdAt: Timestamp.fromMillis(nowMilliseconds),
    },
    { merge: true },
  );
  await batch.commit();
  return { message: published.data, idempotent: !publication.committed };
}

export async function listBlockedUids(firestore: Firestore, uid: string) {
  const snapshot = await firestore
    .collection("users")
    .doc(uid)
    .collection("blocks")
    .limit(500)
    .get();
  return snapshot.docs.map((document) => document.id);
}

export async function setBlockedUserCore(
  firestore: Firestore,
  uid: string,
  targetUid: string,
  blocked: boolean,
) {
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(targetUid) || targetUid === uid)
    throw new ApiError("Invalid member", 400, "invalid_block_target");
  const reference = firestore
    .collection("users")
    .doc(uid)
    .collection("blocks")
    .doc(targetUid);
  if (blocked) {
    const profile = await firestore.collection("profiles").doc(targetUid).get();
    const handle: unknown = profile.get("handle");
    await reference.set({
      targetUid,
      ...(typeof handle === "string" ? { handle } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
  } else await reference.delete();
  return { targetUid, blocked };
}

export async function reportChatMessageCore(
  firestore: Firestore,
  database: Database,
  reporterUid: string,
  input: {
    roomId: string;
    messageId: string;
    reason: string;
    note?: string | undefined;
  },
) {
  const roomId = safeRoomId(input.roomId);
  const snapshot = await database
    .ref(`chat/v1/rooms/${roomId}/messages/${input.messageId}`)
    .get();
  const message = chatMessageSchema.safeParse(snapshot.val());
  if (!message.success || message.data.status !== "published")
    throw new ApiError("Message not found", 404, "chat_message_missing");
  if (message.data.uid === reporterUid)
    throw new ApiError(
      "You cannot report your own message",
      400,
      "self_report",
    );
  const reportId = sha256(`${roomId}:${input.messageId}:${reporterUid}`).slice(
    0,
    40,
  );
  const reference = firestore.collection("reports").doc(reportId);
  if ((await reference.get()).exists) return { reportId, duplicate: true };
  const severity = ["threat", "doxxing", "hate"].includes(input.reason)
    ? "high"
    : "normal";
  await reference.create({
    id: reportId,
    type: "chat_message",
    reporterUid,
    targetUid: message.data.uid,
    roomId,
    messageId: input.messageId,
    reason: input.reason,
    ...(input.note ? { note: input.note } : {}),
    messageSnapshot: message.data,
    severity,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { reportId, duplicate: false };
}
