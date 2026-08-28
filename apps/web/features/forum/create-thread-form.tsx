"use client";

import { ArrowLeft, LoaderCircle, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/forum/member-avatar";
import { getFirebaseAppCheckToken } from "@/lib/firebase/client";
import { forumThreadPath } from "@/lib/forum/path";
import {
  FORUM_POST_MAX_LENGTH,
  FORUM_TITLE_MAX_LENGTH,
} from "@/lib/forum/types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function apiMessage(value: unknown, fallback: string) {
  const error = record(record(value).error);
  return typeof error.message === "string" ? error.message : fallback;
}

export function CreateThreadForm({
  handle,
  photoURL,
}: {
  handle: string;
  photoURL: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = title.trim().length >= 5 && body.trim().length >= 3;

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!ready || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const token = await getFirebaseAppCheckToken();
      const response = await fetch("/api/discussions/forum/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Firebase-AppCheck": token } : {}),
        },
        body: JSON.stringify({
          title,
          body,
          clientNonce: crypto.randomUUID(),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          apiMessage(payload, "Discussion could not be published"),
        );
      const thread = record(record(payload).thread);
      if (typeof thread.id !== "string" || typeof thread.slug !== "string")
        throw new Error(
          "Discussion was published, but its page could not be opened",
        );
      router.push(forumThreadPath({ id: thread.id, slug: thread.slug }));
      router.refresh();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Discussion could not be published",
      );
      setPublishing(false);
    }
  }

  return (
    <form
      className="overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1"
      onSubmit={publish}
    >
      <div className="flex items-center gap-3 border-b border-fl-border p-5 sm:p-6">
        <MemberAvatar handle={handle} photoURL={photoURL} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-fl-text">Posting as @{handle}</p>
          <p className="mt-0.5 text-xs text-fl-text-dim">
            Your public handle and photo appear with this discussion.
          </p>
        </div>
      </div>
      <div className="space-y-6 p-5 sm:p-6">
        <div>
          <div className="flex items-end justify-between gap-3">
            <label className="text-sm font-bold" htmlFor="forum-title">
              Subject
            </label>
            <span className="font-mono text-[10px] text-fl-text-dim">
              {title.length}/{FORUM_TITLE_MAX_LENGTH}
            </span>
          </div>
          <input
            autoFocus
            className="focus-ring mt-2 h-12 w-full rounded-xl border border-fl-border bg-fl-surface-2 px-4 text-base font-semibold outline-none placeholder:text-fl-text-dim focus:border-fl-accent/55"
            id="forum-title"
            maxLength={FORUM_TITLE_MAX_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What do you want to discuss?"
            required
            value={title}
          />
        </div>
        <div>
          <div className="flex items-end justify-between gap-3">
            <label className="text-sm font-bold" htmlFor="forum-body">
              Post
            </label>
            <span className="font-mono text-[10px] text-fl-text-dim">
              {body.length}/{FORUM_POST_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            className="focus-ring mt-2 min-h-56 w-full resize-y rounded-xl border border-fl-border bg-fl-surface-2 p-4 text-sm leading-7 outline-none placeholder:text-fl-text-dim focus:border-fl-accent/55"
            id="forum-body"
            maxLength={FORUM_POST_MAX_LENGTH}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add the context other members need to join the conversation…"
            required
            value={body}
          />
        </div>
        {error ? (
          <p
            className="rounded-xl border border-fl-danger/35 bg-fl-danger/10 px-4 py-3 text-sm text-[#ff9a9a]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-fl-text-muted transition hover:bg-fl-surface-2 hover:text-fl-text"
            href="/discussions"
          >
            <ArrowLeft aria-hidden="true" size={16} /> Cancel
          </Link>
          <Button disabled={!ready || publishing} type="submit">
            {publishing ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={16}
              />
            ) : (
              <Send aria-hidden="true" size={16} />
            )}
            {publishing ? "Publishing…" : "Publish discussion"}
          </Button>
        </div>
      </div>
    </form>
  );
}
