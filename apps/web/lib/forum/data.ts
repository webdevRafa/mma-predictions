import "server-only";

import { cache } from "react";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

import { clampForumPage } from "./pagination";
import {
  getForumThreadCore,
  listForumRepliesCore,
  listForumThreadsCore,
} from "./server";
import type {
  ForumReply,
  ForumReplyView,
  ForumThread,
  ForumThreadView,
} from "./types";

async function authorPhotos(uids: string[]) {
  const unique = [...new Set(uids.filter(Boolean))];
  const photos = new Map<string, string | null>();
  const auth = getFirebaseAdmin().auth;
  for (let index = 0; index < unique.length; index += 100) {
    const identifiers = unique
      .slice(index, index + 100)
      .map((uid) => ({ uid }));
    if (!identifiers.length) continue;
    const result = await auth.getUsers(identifiers);
    for (const user of result.users)
      photos.set(user.uid, user.photoURL ?? null);
  }
  return photos;
}

function withThreadPhotos(
  thread: ForumThread,
  photos: ReadonlyMap<string, string | null>,
): ForumThreadView {
  return {
    ...thread,
    authorPhotoURL: photos.get(thread.uid) ?? null,
    lastReplyPhotoURL: thread.lastReply
      ? (photos.get(thread.lastReply.uid) ?? null)
      : null,
  };
}

function withReplyPhoto(
  reply: ForumReply,
  photos: ReadonlyMap<string, string | null>,
): ForumReplyView {
  return { ...reply, authorPhotoURL: photos.get(reply.uid) ?? null };
}

export const listForumDirectory = cache(async () => {
  const threads = await listForumThreadsCore(getFirebaseAdmin().firestore);
  const photos = await authorPhotos(
    threads.flatMap((thread) => [
      thread.uid,
      ...(thread.lastReply ? [thread.lastReply.uid] : []),
    ]),
  );
  return threads.map((thread) => withThreadPhotos(thread, photos));
});

export const getForumThread = cache(async (threadId: string) => {
  const thread = await getForumThreadCore(
    getFirebaseAdmin().firestore,
    threadId,
  );
  if (!thread) return null;
  const photos = await authorPhotos([thread.uid]);
  return withThreadPhotos(thread, photos);
});

export const getForumThreadPage = cache(
  async (threadId: string, requestedPage: number) => {
    const thread = await getForumThread(threadId);
    if (!thread) return null;
    const page = clampForumPage(requestedPage, thread.replyCount);
    const replies = await listForumRepliesCore(
      getFirebaseAdmin().firestore,
      threadId,
      page,
    );
    const photos = await authorPhotos(replies.map((reply) => reply.uid));
    return {
      thread,
      replies: replies.map((reply) => withReplyPhoto(reply, photos)),
      page,
    };
  },
);

export async function getMemberPhotoURL(uid: string) {
  const photos = await authorPhotos([uid]);
  return photos.get(uid) ?? null;
}
