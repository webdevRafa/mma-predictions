import "server-only";

import { createHash } from "node:crypto";

import {
  accountStatusSchema,
  moderateDiscussionBody,
  slugify,
  userRoleSchema,
  type ChatRoleBadge,
  type UserRole,
} from "@fightlobby/domain";
import {
  FieldValue,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";

import { ApiError } from "@/lib/auth/http";
import type { SessionUser } from "@/lib/auth/session";

import { forumReplyPageNumber } from "./pagination";
import {
  FORUM_DIRECTORY_LIMIT,
  type ForumAuthor,
  type ForumReply,
  type ForumThread,
} from "./types";

const MODERATION_VERSION = 1;
const DUPLICATE_WINDOW_MS = 5 * 60_000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeId(value: string, label: string) {
  if (!/^[a-z0-9_-]{3,160}$/i.test(value))
    throw new ApiError(`Invalid ${label}`, 400, `invalid_${label}`);
  return value;
}

function time(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

function rolesFromUser(snapshot: DocumentSnapshot, fallback: UserRole[]) {
  const value: unknown = snapshot.get("roles");
  if (!Array.isArray(value)) return fallback;
  const roles = value.flatMap((candidate) => {
    const parsed = userRoleSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
  return roles.length ? roles : fallback;
}

function roleBadge(roles: UserRole[]): ChatRoleBadge | undefined {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("moderator")) return "moderator";
  if (roles.includes("trusted")) return "trusted";
  return undefined;
}

function cooldownMilliseconds(
  roles: UserRole[],
  user: DocumentSnapshot,
  now: number,
) {
  if (roles.some((role) => ["trusted", "moderator", "admin"].includes(role)))
    return 5_000;
  const moderation = record(user.get("moderation"));
  const trustLevel =
    typeof moderation.trustLevel === "number" ? moderation.trustLevel : 0;
  const joinedAt = time(user.get("createdAt"));
  return trustLevel <= 0 || joinedAt === null || now - joinedAt < 7 * 86_400_000
    ? 30_000
    : 15_000;
}

function assertCanPublish(
  member: SessionUser,
  user: DocumentSnapshot,
  now: number,
) {
  if (!user.exists)
    throw new ApiError(
      "This account cannot publish discussions",
      403,
      "forum_account_missing",
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
  const parsedStatus = accountStatusSchema.safeParse(user.get("accountStatus"));
  const status = parsedStatus.success
    ? parsedStatus.data
    : member.accountStatus;
  if (status !== "active")
    throw new ApiError(
      "This account cannot publish discussions",
      403,
      `forum_${status}`,
    );
  const muteUntil = time(record(user.get("moderation")).muteUntil);
  if (muteUntil !== null && muteUntil > now)
    throw new ApiError(
      "Discussion access is temporarily muted",
      403,
      "forum_muted",
    );
}

function author(handle: string, roles: UserRole[]): ForumAuthor {
  const badge = roleBadge(roles);
  return { handle, ...(badge ? { roleBadge: badge } : {}) };
}

function parseAuthor(value: unknown): ForumAuthor | null {
  const data = record(value);
  if (typeof data.handle !== "string" || !data.handle) return null;
  const badge = data.roleBadge;
  return {
    handle: data.handle,
    ...(badge === "admin" || badge === "moderator" || badge === "trusted"
      ? { roleBadge: badge }
      : {}),
  };
}

export function parseForumThread(
  snapshot: DocumentSnapshot,
): ForumThread | null {
  if (!snapshot.exists) return null;
  const data = record(snapshot.data());
  const parsedAuthor = parseAuthor(data.author);
  const status = data.status;
  if (
    !parsedAuthor ||
    typeof data.id !== "string" ||
    typeof data.slug !== "string" ||
    typeof data.uid !== "string" ||
    typeof data.title !== "string" ||
    typeof data.body !== "string" ||
    typeof data.bodyNormalizedHash !== "string" ||
    typeof data.replyCount !== "number" ||
    typeof data.clientNonce !== "string" ||
    typeof data.moderationVersion !== "number" ||
    (status !== "published" && status !== "removed")
  )
    return null;
  const createdAt = time(data.createdAt);
  const updatedAt = time(data.updatedAt);
  const lastActivityAt = time(data.lastActivityAt);
  if (createdAt === null || updatedAt === null || lastActivityAt === null)
    return null;
  const lastReplyData = record(data.lastReply);
  const lastReplyAuthor = parseAuthor(lastReplyData.author);
  const lastReplyAt = time(lastReplyData.createdAt);
  const lastReply =
    typeof lastReplyData.uid === "string" &&
    lastReplyAuthor &&
    lastReplyAt !== null
      ? {
          uid: lastReplyData.uid,
          author: lastReplyAuthor,
          createdAt: lastReplyAt,
        }
      : undefined;
  return {
    id: data.id,
    slug: data.slug,
    uid: data.uid,
    author: parsedAuthor,
    title: data.title,
    body: data.body,
    bodyNormalizedHash: data.bodyNormalizedHash,
    replyCount: Math.max(0, Math.trunc(data.replyCount)),
    createdAt,
    updatedAt,
    lastActivityAt,
    ...(lastReply ? { lastReply } : {}),
    clientNonce: data.clientNonce,
    status,
    moderationVersion: data.moderationVersion,
  };
}

export function parseForumReply(snapshot: DocumentSnapshot): ForumReply | null {
  if (!snapshot.exists) return null;
  const data = record(snapshot.data());
  const parsedAuthor = parseAuthor(data.author);
  const status = data.status;
  if (
    !parsedAuthor ||
    typeof data.id !== "string" ||
    typeof data.threadId !== "string" ||
    typeof data.uid !== "string" ||
    typeof data.body !== "string" ||
    typeof data.bodyNormalizedHash !== "string" ||
    typeof data.pageNumber !== "number" ||
    typeof data.clientNonce !== "string" ||
    typeof data.moderationVersion !== "number" ||
    (status !== "published" && status !== "removed")
  )
    return null;
  const createdAt = time(data.createdAt);
  const updatedAt = time(data.updatedAt);
  if (createdAt === null || updatedAt === null) return null;
  return {
    id: data.id,
    threadId: data.threadId,
    uid: data.uid,
    author: parsedAuthor,
    body: data.body,
    bodyNormalizedHash: data.bodyNormalizedHash,
    pageNumber: Math.max(1, Math.trunc(data.pageNumber)),
    createdAt,
    updatedAt,
    clientNonce: data.clientNonce,
    status,
    moderationVersion: data.moderationVersion,
  };
}

async function publicationContext(
  firestore: Firestore,
  member: SessionUser,
  now: number,
) {
  const [user, profile, flags] = await Promise.all([
    firestore.collection("users").doc(member.uid).get(),
    firestore.collection("profiles").doc(member.uid).get(),
    firestore.collection("featureFlags").doc("current").get(),
  ]);
  assertCanPublish(member, user, now);
  if (flags.exists && flags.get("discussionEnabled") === false)
    throw new ApiError(
      "Discussions are temporarily unavailable",
      503,
      "forum_disabled",
    );
  if (flags.exists && flags.get("discussionPostingEnabled") === false)
    throw new ApiError(
      "Discussions are currently read-only",
      409,
      "forum_read_only",
    );
  const handle: unknown = profile.get("handle");
  if (typeof handle !== "string" || handle !== member.handle)
    throw new ApiError(
      "Your public profile is incomplete",
      409,
      "onboarding_required",
    );
  const roles = rolesFromUser(user, member.roles);
  return {
    author: author(handle, roles),
    cooldown: cooldownMilliseconds(roles, user, now),
  };
}

async function writeModerationRecords(
  firestore: Firestore,
  input: {
    postId: string;
    threadId: string;
    uid: string;
    isReply: boolean;
    bodyHash: string;
    decision: string;
    signals: string[];
    now: number;
  },
) {
  const batch = firestore.batch();
  batch.set(firestore.collection("discussionModeration").doc(input.postId), {
    postId: input.postId,
    threadId: input.threadId,
    uid: input.uid,
    surface: "forum",
    decision: input.decision,
    signals: input.signals,
    bodyNormalizedHash: input.bodyHash,
    moderationVersion: MODERATION_VERSION,
    createdAt: Timestamp.fromMillis(input.now),
  });
  batch.set(
    firestore.collection("auditLogs").doc(`forum_publish_${input.postId}`),
    {
      type: "forum_post_publication",
      postId: input.postId,
      threadId: input.threadId,
      uid: input.uid,
      isReply: input.isReply,
      decision: input.decision,
      signals: input.signals,
      createdAt: Timestamp.fromMillis(input.now),
    },
  );
  await batch.commit();
}

export async function createForumThreadCore(
  firestore: Firestore,
  member: SessionUser,
  input: {
    title: string;
    body: string;
    clientNonce: string;
    nowMilliseconds?: number;
  },
) {
  const now = input.nowMilliseconds ?? Date.now();
  const titleModeration = moderateDiscussionBody(input.title);
  if (!titleModeration.accepted)
    throw new ApiError(
      titleModeration.message,
      422,
      `forum_title_${titleModeration.code}`,
    );
  const moderation = moderateDiscussionBody(input.body);
  if (!moderation.accepted)
    throw new ApiError(moderation.message, 422, `forum_${moderation.code}`);
  const context = await publicationContext(firestore, member, now);
  const id = sha256(`forum:${member.uid}:${input.clientNonce}`).slice(0, 40);
  const reference = firestore.collection("forumThreads").doc(id);
  const bodyHash = sha256(moderation.normalizedBody);
  const thread: ForumThread = {
    id,
    slug: slugify(input.title).slice(0, 100) || "discussion",
    uid: member.uid,
    author: context.author,
    title: titleModeration.body,
    body: moderation.body,
    bodyNormalizedHash: bodyHash,
    replyCount: 0,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    clientNonce: input.clientNonce,
    status: "published",
    moderationVersion: MODERATION_VERSION,
  };
  const rateReference = firestore
    .collection("discussionRateLimits")
    .doc(sha256(`${member.uid}:forum`).slice(0, 40));
  let idempotent = false;
  await firestore.runTransaction(async (transaction) => {
    const [existing, rate] = await Promise.all([
      transaction.get(reference),
      transaction.get(rateReference),
    ]);
    const existingThread = parseForumThread(existing);
    if (existingThread?.uid === member.uid) {
      idempotent = true;
      return;
    }
    const rateData = record(rate.data());
    const lastAt =
      typeof rateData.lastAt === "number"
        ? rateData.lastAt
        : Number.NEGATIVE_INFINITY;
    const lastHash =
      typeof rateData.lastHash === "string" ? rateData.lastHash : "";
    const lastHashAt =
      typeof rateData.lastHashAt === "number"
        ? rateData.lastHashAt
        : Number.NEGATIVE_INFINITY;
    if (lastHash === bodyHash && now - lastHashAt < DUPLICATE_WINDOW_MS)
      throw new ApiError(
        "Duplicate posts are blocked for five minutes",
        429,
        "forum_duplicate",
      );
    if (now - lastAt < context.cooldown)
      throw new ApiError(
        `Wait ${Math.ceil((context.cooldown - (now - lastAt)) / 1_000)} seconds before posting again`,
        429,
        "forum_rate_limited",
      );
    transaction.create(reference, thread);
    transaction.set(rateReference, {
      uid: member.uid,
      surface: "forum",
      lastAt: now,
      lastHash: bodyHash,
      lastHashAt: now,
    });
  });
  if (!idempotent)
    await writeModerationRecords(firestore, {
      postId: id,
      threadId: id,
      uid: member.uid,
      isReply: false,
      bodyHash,
      decision: moderation.decision,
      signals: moderation.signals,
      now,
    });
  const published = parseForumThread(await reference.get());
  if (!published)
    throw new ApiError(
      "Discussion publication failed",
      500,
      "forum_publish_failed",
    );
  return { thread: published, idempotent };
}

export async function createForumReplyCore(
  firestore: Firestore,
  member: SessionUser,
  input: {
    threadId: string;
    body: string;
    clientNonce: string;
    nowMilliseconds?: number;
  },
) {
  const threadId = safeId(input.threadId, "thread");
  const now = input.nowMilliseconds ?? Date.now();
  const moderation = moderateDiscussionBody(input.body);
  if (!moderation.accepted)
    throw new ApiError(moderation.message, 422, `forum_${moderation.code}`);
  const context = await publicationContext(firestore, member, now);
  const postId = sha256(
    `forum:${threadId}:${member.uid}:${input.clientNonce}`,
  ).slice(0, 40);
  const threadReference = firestore.collection("forumThreads").doc(threadId);
  const replyReference = threadReference.collection("forumReplies").doc(postId);
  const rateReference = firestore
    .collection("discussionRateLimits")
    .doc(sha256(`${member.uid}:forum`).slice(0, 40));
  const bodyHash = sha256(moderation.normalizedBody);
  let idempotent = false;
  await firestore.runTransaction(async (transaction) => {
    const [threadSnapshot, existing, rate] = await Promise.all([
      transaction.get(threadReference),
      transaction.get(replyReference),
      transaction.get(rateReference),
    ]);
    const thread = parseForumThread(threadSnapshot);
    if (!thread || thread.status !== "published")
      throw new ApiError("Discussion not found", 404, "forum_thread_missing");
    const existingReply = parseForumReply(existing);
    if (existingReply?.uid === member.uid) {
      idempotent = true;
      return;
    }
    const rateData = record(rate.data());
    const lastAt =
      typeof rateData.lastAt === "number"
        ? rateData.lastAt
        : Number.NEGATIVE_INFINITY;
    const lastHash =
      typeof rateData.lastHash === "string" ? rateData.lastHash : "";
    const lastHashAt =
      typeof rateData.lastHashAt === "number"
        ? rateData.lastHashAt
        : Number.NEGATIVE_INFINITY;
    if (lastHash === bodyHash && now - lastHashAt < DUPLICATE_WINDOW_MS)
      throw new ApiError(
        "Duplicate posts are blocked for five minutes",
        429,
        "forum_duplicate",
      );
    if (now - lastAt < context.cooldown)
      throw new ApiError(
        `Wait ${Math.ceil((context.cooldown - (now - lastAt)) / 1_000)} seconds before posting again`,
        429,
        "forum_rate_limited",
      );
    const reply: ForumReply = {
      id: postId,
      threadId,
      uid: member.uid,
      author: context.author,
      body: moderation.body,
      bodyNormalizedHash: bodyHash,
      pageNumber: forumReplyPageNumber(thread.replyCount),
      createdAt: now,
      updatedAt: now,
      clientNonce: input.clientNonce,
      status: "published",
      moderationVersion: MODERATION_VERSION,
    };
    transaction.create(replyReference, reply);
    transaction.update(threadReference, {
      replyCount: FieldValue.increment(1),
      updatedAt: now,
      lastActivityAt: now,
      lastReply: { uid: member.uid, author: context.author, createdAt: now },
    });
    transaction.set(rateReference, {
      uid: member.uid,
      surface: "forum",
      lastAt: now,
      lastHash: bodyHash,
      lastHashAt: now,
    });
  });
  if (!idempotent)
    await writeModerationRecords(firestore, {
      postId,
      threadId,
      uid: member.uid,
      isReply: true,
      bodyHash,
      decision: moderation.decision,
      signals: moderation.signals,
      now,
    });
  const published = parseForumReply(await replyReference.get());
  if (!published)
    throw new ApiError("Reply publication failed", 500, "forum_reply_failed");
  return { reply: published, idempotent };
}

export async function listForumThreadsCore(
  firestore: Firestore,
  limit = FORUM_DIRECTORY_LIMIT,
) {
  const snapshot = await firestore
    .collection("forumThreads")
    .orderBy("lastActivityAt", "desc")
    .limit(Math.min(Math.max(limit, 1), FORUM_DIRECTORY_LIMIT))
    .get();
  return snapshot.docs.flatMap((document) => {
    const parsed = parseForumThread(document);
    return parsed && parsed.status === "published" ? [parsed] : [];
  });
}

export async function getForumThreadCore(
  firestore: Firestore,
  threadIdValue: string,
) {
  const threadId = safeId(threadIdValue, "thread");
  const thread = parseForumThread(
    await firestore.collection("forumThreads").doc(threadId).get(),
  );
  return thread?.status === "published" ? thread : null;
}

export async function listForumRepliesCore(
  firestore: Firestore,
  threadIdValue: string,
  page: number,
) {
  const threadId = safeId(threadIdValue, "thread");
  const snapshot = await firestore
    .collection("forumThreads")
    .doc(threadId)
    .collection("forumReplies")
    .where("pageNumber", "==", page)
    .get();
  return snapshot.docs
    .flatMap((document) => {
      const parsed = parseForumReply(document);
      return parsed ? [parsed] : [];
    })
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export async function reportForumPostCore(
  firestore: Firestore,
  reporterUid: string,
  input: {
    threadId: string;
    postId: string;
    postType: "thread" | "reply";
    reason: string;
    note?: string | undefined;
  },
) {
  const threadId = safeId(input.threadId, "thread");
  const postId = safeId(input.postId, "post");
  const threadReference = firestore.collection("forumThreads").doc(threadId);
  const reference =
    input.postType === "thread"
      ? threadReference
      : threadReference.collection("forumReplies").doc(postId);
  const post =
    input.postType === "thread"
      ? parseForumThread(await reference.get())
      : parseForumReply(await reference.get());
  if (!post || post.status !== "published")
    throw new ApiError("Post not found", 404, "forum_post_missing");
  if (post.uid === reporterUid)
    throw new ApiError("You cannot report your own post", 400, "self_report");
  const reportId = sha256(`forum:${threadId}:${postId}:${reporterUid}`).slice(
    0,
    40,
  );
  const reportReference = firestore.collection("reports").doc(reportId);
  if ((await reportReference.get()).exists)
    return { reportId, duplicate: true };
  const severity = ["threat", "doxxing", "hate"].includes(input.reason)
    ? "high"
    : "normal";
  await reportReference.create({
    id: reportId,
    type: "forum_post",
    reporterUid,
    targetUid: post.uid,
    threadId,
    postId,
    postType: input.postType,
    reason: input.reason,
    ...(input.note ? { note: input.note } : {}),
    postSnapshot: post,
    severity,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { reportId, duplicate: false };
}
