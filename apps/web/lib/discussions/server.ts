import { createHash } from "node:crypto";

import {
  accountStatusSchema,
  discussionPostSchema,
  moderateDiscussionBody,
  userRoleSchema,
  type AccountStatus,
  type ChatRoleBadge,
  type DiscussionPost,
  type DiscussionThread,
  type UserRole,
} from "@fightlobby/domain";
import {
  FieldValue,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";

import { ApiError } from "../auth/http";

const DISCUSSION_MODERATION_VERSION = 1;
const DISCUSSION_DUPLICATE_WINDOW_MS = 5 * 60_000;
const DISCUSSION_PAGE_SIZE = 20;
const DISCUSSION_REPLY_PREVIEW_LIMIT = 3;
const DISCUSSION_REPLY_LIMIT = 200;

export interface DiscussionMemberContext {
  uid: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  accountStatus: AccountStatus;
  roles: UserRole[];
  handle?: string;
}

export interface CreateDiscussionPostInput {
  fightId: string;
  body: string;
  clientNonce: string;
  rootPostId?: string | undefined;
  parentPostId?: string | undefined;
  nowMilliseconds?: number | undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function safeId(value: string, label: string) {
  if (!/^[a-z0-9_-]{3,160}$/i.test(value))
    throw new ApiError(`Invalid ${label}`, 400, `invalid_${label}`);
  return value;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
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

function postingCooldownMilliseconds(
  roles: UserRole[],
  user: DocumentSnapshot,
  nowMilliseconds: number,
) {
  if (roles.some((role) => ["trusted", "moderator", "admin"].includes(role)))
    return 5_000;
  const moderation = record(user.get("moderation"));
  const trustLevel =
    typeof moderation.trustLevel === "number" ? moderation.trustLevel : 0;
  const joinedAt = timestampMilliseconds(user.get("createdAt"));
  const isNew =
    trustLevel <= 0 ||
    joinedAt === null ||
    nowMilliseconds - joinedAt < 7 * 24 * 60 * 60 * 1_000;
  return isNew ? 30_000 : 15_000;
}

function assertMemberCanPost(
  member: DiscussionMemberContext,
  user: DocumentSnapshot,
  nowMilliseconds: number,
) {
  if (!user.exists)
    throw new ApiError(
      "This account cannot publish posts",
      403,
      "discussion_account_missing",
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
      "This account cannot publish posts",
      403,
      `discussion_${accountStatus}`,
    );
  const muteUntil = timestampMilliseconds(
    record(user.get("moderation")).muteUntil,
  );
  if (muteUntil !== null && muteUntil > nowMilliseconds)
    throw new ApiError(
      "Discussion access is temporarily muted",
      403,
      "discussion_muted",
    );
}

function parsePost(snapshot: DocumentSnapshot) {
  const parsed = discussionPostSchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : null;
}

async function replySnapshot(
  firestore: Firestore,
  fightId: string,
  rootPostId?: string,
  parentPostId?: string,
) {
  if (!rootPostId || !parentPostId) return undefined;
  safeId(rootPostId, "root_post");
  safeId(parentPostId, "parent_post");
  const rootReference = firestore
    .collection("fightDiscussions")
    .doc(fightId)
    .collection("posts")
    .doc(rootPostId);
  const parentReference =
    parentPostId === rootPostId
      ? rootReference
      : rootReference.collection("replies").doc(parentPostId);
  const parent = parsePost(await parentReference.get());
  if (!parent || parent.status !== "published")
    throw new ApiError(
      "The post you replied to is unavailable",
      409,
      "discussion_reply_unavailable",
    );
  return {
    rootReference,
    parent: {
      postId: parent.id,
      uid: parent.uid,
      handle: parent.author.handle,
      excerpt: [...parent.body].slice(0, 120).join(""),
    },
  };
}

export async function createDiscussionPostCore(
  firestore: Firestore,
  member: DiscussionMemberContext,
  input: CreateDiscussionPostInput,
) {
  const fightId = safeId(input.fightId, "fight");
  const nowMilliseconds = input.nowMilliseconds ?? Date.now();
  const moderation = moderateDiscussionBody(input.body);
  if (!moderation.accepted)
    throw new ApiError(
      moderation.message,
      422,
      `discussion_${moderation.code}`,
    );
  const [user, profile, fight, flags, reply] = await Promise.all([
    firestore.collection("users").doc(member.uid).get(),
    firestore.collection("profiles").doc(member.uid).get(),
    firestore.collection("fights").doc(fightId).get(),
    firestore.collection("featureFlags").doc("current").get(),
    replySnapshot(firestore, fightId, input.rootPostId, input.parentPostId),
  ]);
  assertMemberCanPost(member, user, nowMilliseconds);
  if (!fight.exists)
    throw new ApiError("Fight not found", 404, "fight_not_found");
  if (flags.exists && flags.get("discussionEnabled") === false)
    throw new ApiError(
      "Matchup discussions are temporarily unavailable",
      503,
      "discussion_disabled",
    );
  if (flags.exists && flags.get("discussionPostingEnabled") === false)
    throw new ApiError(
      "Matchup discussions are currently read-only",
      409,
      "discussion_read_only",
    );
  const handle: unknown = profile.get("handle");
  if (typeof handle !== "string" || handle !== member.handle)
    throw new ApiError(
      "Your public profile is incomplete",
      409,
      "onboarding_required",
    );

  const discussionReference = firestore
    .collection("fightDiscussions")
    .doc(fightId);
  const postId = sha256(`${fightId}:${member.uid}:${input.clientNonce}`).slice(
    0,
    40,
  );
  const rootPostId = input.rootPostId ?? postId;
  const rootReference =
    reply?.rootReference ?? discussionReference.collection("posts").doc(postId);
  const postReference = reply
    ? rootReference.collection("replies").doc(postId)
    : rootReference;
  const roles = rolesFromUser(user, member.roles);
  const badge = roleBadge(roles);
  const bodyHash = sha256(moderation.normalizedBody);
  const post: DiscussionPost = {
    id: postId,
    fightId,
    uid: member.uid,
    author: {
      handle,
      ...(badge ? { roleBadge: badge } : {}),
    },
    body: moderation.body,
    bodyNormalizedHash: bodyHash,
    rootPostId,
    ...(input.parentPostId ? { parentPostId: input.parentPostId } : {}),
    ...(reply ? { replyTo: reply.parent } : {}),
    replyCount: 0,
    createdAt: nowMilliseconds,
    updatedAt: nowMilliseconds,
    clientNonce: input.clientNonce,
    status: "published",
    moderationVersion: DISCUSSION_MODERATION_VERSION,
  };
  const rateReference = firestore
    .collection("discussionRateLimits")
    .doc(sha256(`${member.uid}:${fightId}`).slice(0, 40));
  const cooldown = postingCooldownMilliseconds(roles, user, nowMilliseconds);
  let idempotent = false;

  await firestore.runTransaction(async (transaction) => {
    const [existing, rate] = await Promise.all([
      transaction.get(postReference),
      transaction.get(rateReference),
    ]);
    const existingPost = parsePost(existing);
    if (existingPost?.uid === member.uid) {
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
    if (
      lastHash === bodyHash &&
      nowMilliseconds - lastHashAt < DISCUSSION_DUPLICATE_WINDOW_MS
    )
      throw new ApiError(
        "Duplicate posts are blocked for five minutes",
        429,
        "discussion_duplicate",
      );
    if (nowMilliseconds - lastAt < cooldown)
      throw new ApiError(
        `Wait ${Math.ceil((cooldown - (nowMilliseconds - lastAt)) / 1_000)} seconds before posting again`,
        429,
        "discussion_rate_limited",
      );

    transaction.create(postReference, post);
    transaction.set(rateReference, {
      uid: member.uid,
      fightId,
      lastAt: nowMilliseconds,
      lastHash: bodyHash,
      lastHashAt: nowMilliseconds,
    });
    transaction.set(
      discussionReference,
      {
        fightId,
        postCount: FieldValue.increment(reply ? 0 : 1),
        replyCount: FieldValue.increment(reply ? 1 : 0),
        lastActivityAt: nowMilliseconds,
        updatedAt: nowMilliseconds,
      },
      { merge: true },
    );
    if (reply)
      transaction.update(rootReference, {
        replyCount: FieldValue.increment(1),
        updatedAt: nowMilliseconds,
      });
  });

  if (!idempotent) {
    const batch = firestore.batch();
    batch.set(firestore.collection("discussionModeration").doc(postId), {
      postId,
      fightId,
      uid: member.uid,
      decision: moderation.decision,
      signals: moderation.signals,
      bodyNormalizedHash: bodyHash,
      moderationVersion: DISCUSSION_MODERATION_VERSION,
      createdAt: Timestamp.fromMillis(nowMilliseconds),
    });
    batch.set(
      firestore.collection("auditLogs").doc(`discussion_publish_${postId}`),
      {
        type: "discussion_post_publication",
        postId,
        fightId,
        uid: member.uid,
        rootPostId,
        isReply: Boolean(reply),
        decision: moderation.decision,
        signals: moderation.signals,
        createdAt: Timestamp.fromMillis(nowMilliseconds),
      },
    );
    await batch.commit();
  }
  const published = parsePost(await postReference.get());
  if (!published)
    throw new ApiError(
      "Post publication failed",
      500,
      "discussion_publish_failed",
    );
  return { post: published, idempotent };
}

export async function listFightDiscussionCore(
  firestore: Firestore,
  fightIdValue: string,
  options: { cursor?: number | undefined; limit?: number | undefined } = {},
) {
  const fightId = safeId(fightIdValue, "fight");
  const limit = Math.min(
    Math.max(options.limit ?? DISCUSSION_PAGE_SIZE, 1),
    DISCUSSION_PAGE_SIZE,
  );
  let query: FirebaseFirestore.Query = firestore
    .collection("fightDiscussions")
    .doc(fightId)
    .collection("posts")
    .orderBy("createdAt", "desc")
    .limit(limit);
  if (options.cursor !== undefined) query = query.startAfter(options.cursor);
  const roots = await query.get();
  const threads = await Promise.all(
    roots.docs.flatMap((document) => {
      const post = parsePost(document);
      if (!post) return [];
      return [
        document.ref
          .collection("replies")
          .orderBy("createdAt", "asc")
          .limit(DISCUSSION_REPLY_PREVIEW_LIMIT)
          .get()
          .then((replies): DiscussionThread => ({
            post,
            replies: replies.docs.flatMap((reply) => {
              const parsed = parsePost(reply);
              return parsed ? [parsed] : [];
            }),
          })),
      ];
    }),
  );
  const last = threads.at(-1)?.post.createdAt;
  return {
    threads,
    nextCursor: roots.size === limit && last !== undefined ? last : null,
  };
}

export async function listFightDiscussionRepliesCore(
  firestore: Firestore,
  fightIdValue: string,
  rootPostIdValue: string,
) {
  const fightId = safeId(fightIdValue, "fight");
  const rootPostId = safeId(rootPostIdValue, "root_post");
  const rootReference = firestore
    .collection("fightDiscussions")
    .doc(fightId)
    .collection("posts")
    .doc(rootPostId);
  const root = parsePost(await rootReference.get());
  if (!root || root.status !== "published")
    throw new ApiError("Discussion thread not found", 404, "thread_not_found");
  const snapshot = await rootReference
    .collection("replies")
    .orderBy("createdAt", "asc")
    .limit(DISCUSSION_REPLY_LIMIT)
    .get();
  return snapshot.docs.flatMap((reply) => {
    const parsed = parsePost(reply);
    return parsed ? [parsed] : [];
  });
}

export async function reportDiscussionPostCore(
  firestore: Firestore,
  reporterUid: string,
  input: {
    fightId: string;
    postId: string;
    rootPostId: string;
    reason: string;
    note?: string | undefined;
  },
) {
  const fightId = safeId(input.fightId, "fight");
  const postId = safeId(input.postId, "post");
  const rootPostId = safeId(input.rootPostId, "root_post");
  const rootReference = firestore
    .collection("fightDiscussions")
    .doc(fightId)
    .collection("posts")
    .doc(rootPostId);
  const reference =
    postId === rootPostId
      ? rootReference
      : rootReference.collection("replies").doc(postId);
  const post = parsePost(await reference.get());
  if (!post || post.status !== "published")
    throw new ApiError("Post not found", 404, "discussion_post_missing");
  if (post.uid === reporterUid)
    throw new ApiError("You cannot report your own post", 400, "self_report");
  const reportId = sha256(`${fightId}:${postId}:${reporterUid}`).slice(0, 40);
  const reportReference = firestore.collection("reports").doc(reportId);
  if ((await reportReference.get()).exists)
    return { reportId, duplicate: true };
  const severity = ["threat", "doxxing", "hate"].includes(input.reason)
    ? "high"
    : "normal";
  await reportReference.create({
    id: reportId,
    type: "discussion_post",
    reporterUid,
    targetUid: post.uid,
    fightId,
    postId,
    rootPostId,
    reason: input.reason,
    ...(input.note ? { note: input.note } : {}),
    postSnapshot: post,
    severity,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { reportId, duplicate: false };
}
