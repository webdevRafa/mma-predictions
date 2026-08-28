"use client";

import { LoaderCircle, LogIn, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getFirebaseAppCheckToken } from "@/lib/firebase/client";
import { FORUM_POST_MAX_LENGTH } from "@/lib/forum/types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function apiMessage(value: unknown, fallback: string) {
  const error = record(record(value).error);
  return typeof error.message === "string" ? error.message : fallback;
}

export function ForumReplyComposer({
  canReply,
  destinationPage,
  embedded = false,
  onCancel,
  returnTo,
  textareaId = "forum-reply",
  threadId,
}: {
  canReply: boolean;
  destinationPage: number;
  embedded?: boolean;
  onCancel?: () => void;
  returnTo: string;
  textareaId?: string;
  threadId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canReply) {
    return (
      <div className="rounded-2xl border border-fl-border bg-fl-surface-1 p-5 sm:p-6">
        <h2 className="font-display text-2xl font-semibold">
          Join the conversation
        </h2>
        <p className="mt-2 text-sm leading-6 text-fl-text-muted">
          Sign in with your FightLobby account to reply.
        </p>
        <Link
          className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-fl-border bg-fl-surface-2 px-4 text-sm font-bold transition hover:border-fl-accent/45 hover:text-fl-accent"
          href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        >
          <LogIn aria-hidden="true" size={16} /> Sign in to reply
        </Link>
      </div>
    );
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const token = await getFirebaseAppCheckToken();
      const response = await fetch(
        `/api/discussions/forum/threads/${encodeURIComponent(threadId)}/replies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "X-Firebase-AppCheck": token } : {}),
          },
          body: JSON.stringify({
            body,
            clientNonce: crypto.randomUUID(),
          }),
        },
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(apiMessage(payload, "Reply could not be published"));
      setBody("");
      const destination =
        destinationPage > 1 ? `${returnTo}?page=${destinationPage}` : returnTo;
      router.push(`${destination}#latest-reply`);
      router.refresh();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Reply could not be published",
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form
      className={cn(
        embedded
          ? "border-t border-fl-border bg-fl-surface-2/35 p-5"
          : "rounded-2xl border border-fl-border bg-fl-surface-1 p-5 sm:p-6",
      )}
      onSubmit={publish}
    >
      <div className="flex items-end justify-between gap-4">
        <label
          className="font-display text-2xl font-semibold"
          htmlFor={textareaId}
        >
          Add your reply
        </label>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-fl-text-dim">
            {body.length}/{FORUM_POST_MAX_LENGTH.toLocaleString()}
          </span>
          {onCancel ? (
            <button
              aria-label="Close reply composer"
              className="focus-ring grid size-8 place-items-center rounded-lg text-fl-text-dim transition hover:bg-fl-surface-3 hover:text-fl-text"
              onClick={onCancel}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          ) : null}
        </span>
      </div>
      <textarea
        className="focus-ring mt-4 min-h-36 w-full resize-y rounded-xl border border-fl-border bg-fl-surface-2 p-4 text-sm leading-7 outline-none placeholder:text-fl-text-dim focus:border-fl-accent/55"
        id={textareaId}
        maxLength={FORUM_POST_MAX_LENGTH}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add something useful to the discussion…"
        value={body}
      />
      {error ? (
        <p
          className="mt-3 rounded-xl border border-fl-danger/35 bg-fl-danger/10 px-4 py-3 text-sm text-[#ff9a9a]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button disabled={publishing || !body.trim()} type="submit">
          {publishing ? (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin"
              size={16}
            />
          ) : (
            <Send aria-hidden="true" size={16} />
          )}
          {publishing ? "Posting…" : "Post reply"}
        </Button>
      </div>
    </form>
  );
}
