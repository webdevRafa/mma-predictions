"use client";

import {
  DISCUSSION_POST_MAX_LENGTH,
  discussionPageSchema,
  type DiscussionPost,
  type DiscussionThread,
} from "@fightlobby/domain";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  Flag,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import {
  getFirebaseAppCheckToken,
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

import { mergeDiscussionThreads, sortDiscussionThreads } from "./threading";

type ReplyTarget = { post: DiscussionPost; rootPostId: string };
type ReportReason =
  | "harassment"
  | "hate"
  | "threat"
  | "spam"
  | "doxxing"
  | "sexual_content"
  | "other";

const reportReasons: { label: string; value: ReportReason }[] = [
  { label: "Harassment", value: "harassment" },
  { label: "Hateful content", value: "hate" },
  { label: "Threat", value: "threat" },
  { label: "Spam", value: "spam" },
  { label: "Private information", value: "doxxing" },
  { label: "Sexual content", value: "sexual_content" },
  { label: "Other", value: "other" },
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function apiMessage(value: unknown, fallback: string) {
  const error = record(record(value).error);
  return typeof error.message === "string" ? error.message : fallback;
}

function timeLabel(milliseconds: number) {
  const difference = milliseconds - Date.now();
  const absolute = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absolute < 60_000)
    return formatter.format(Math.round(difference / 1_000), "second");
  if (absolute < 3_600_000)
    return formatter.format(Math.round(difference / 60_000), "minute");
  if (absolute < 86_400_000)
    return formatter.format(Math.round(difference / 3_600_000), "hour");
  if (absolute < 604_800_000)
    return formatter.format(Math.round(difference / 86_400_000), "day");
  return new Date(milliseconds).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date(milliseconds).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

function roleLabel(post: DiscussionPost) {
  if (post.author.roleBadge === "admin") return "FightLobby admin";
  if (post.author.roleBadge === "moderator") return "Moderator";
  if (post.author.roleBadge === "trusted") return "Trusted member";
  return null;
}

export function FightDiscussion({
  fightId,
  fightLabel,
}: {
  fightId: string;
  fightLabel: string;
}) {
  const pathname = usePathname();
  const [threads, setThreads] = useState<DiscussionThread[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseClientConfigured);
  const [body, setBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState<ReplyTarget | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("other");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const reportDialog = useRef<HTMLDialogElement>(null);

  const visibleThreads = useMemo(
    () =>
      sortDiscussionThreads(
        threads
          .filter((thread) => !blocked.has(thread.post.uid))
          .map((thread) => ({
            ...thread,
            replies: thread.replies.filter((reply) => !blocked.has(reply.uid)),
          })),
        order,
      ),
    [blocked, order, threads],
  );

  const loadDiscussion = useCallback(
    async ({ append = false, quiet = false } = {}) => {
      if (!quiet) {
        if (append) setLoadingMore(true);
        else setRefreshing(true);
      }
      setError(null);
      try {
        const cursor = append ? nextCursor : null;
        const response = await fetch(
          `/api/discussions/fights/${encodeURIComponent(fightId)}/posts${cursor === null ? "" : `?cursor=${cursor}`}`,
          { cache: "no-store" },
        );
        const payload: unknown = await response.json();
        if (!response.ok)
          throw new Error(apiMessage(payload, "Posts could not be loaded"));
        const page = discussionPageSchema.parse(payload);
        setThreads((current) =>
          mergeDiscussionThreads(append ? current : [], page.threads),
        );
        setNextCursor(page.nextCursor);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Posts could not be loaded",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [fightId, nextCursor],
  );

  useEffect(() => {
    void loadDiscussion(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fightId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void loadDiscussion({ quiet: true });
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadDiscussion]);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    const stop = onAuthStateChanged(getFirebaseClient().auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return stop;
  }, []);

  useEffect(() => {
    void fetch("/api/chat/blocks", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: unknown) => {
        const values = record(payload).blocked;
        if (Array.isArray(values))
          setBlocked(
            new Set(
              values.filter(
                (value): value is string => typeof value === "string",
              ),
            ),
          );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const dialog = reportDialog.current;
    if (!dialog) return;
    if (reporting && !dialog.open) dialog.showModal();
    if (!reporting && dialog.open) dialog.close();
  }, [reporting]);

  async function appCheckHeaders() {
    const token = await getFirebaseAppCheckToken();
    return token ? { "X-Firebase-AppCheck": token } : {};
  }

  function chooseReply(post: DiscussionPost, rootPostId: string) {
    setReplyTarget({ post, rootPostId });
    requestAnimationFrame(() => textarea.current?.focus());
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || publishing) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/discussions/fights/${encodeURIComponent(fightId)}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await appCheckHeaders()),
          },
          body: JSON.stringify({
            body,
            clientNonce: crypto.randomUUID(),
            ...(replyTarget
              ? {
                  rootPostId: replyTarget.rootPostId,
                  parentPostId: replyTarget.post.id,
                }
              : {}),
          }),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(apiMessage(payload, "Post could not be published"));
      const rootPostId = replyTarget?.rootPostId;
      setBody("");
      setReplyTarget(null);
      if (rootPostId)
        setExpanded((current) => new Set([...current, rootPostId]));
      trackAnalyticsEvent(
        rootPostId ? "discussion_reply_created" : "discussion_post_created",
        { fight_id: fightId },
      );
      await loadDiscussion({ quiet: true });
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Post could not be published",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function blockMember(post: DiscussionPost) {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/chat/blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({ targetUid: post.uid, blocked: true }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(apiMessage(payload, "Member could not be blocked"));
      setBlocked((current) => new Set([...current, post.uid]));
      setNotice(`@${post.author.handle} is now hidden for you.`);
    } catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Member could not be blocked",
      );
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!reporting || reportBusy) return;
    setReportBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/discussions/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({
          fightId,
          postId: reporting.post.id,
          rootPostId: reporting.rootPostId,
          reason: reportReason,
          ...(reportNote.trim() ? { note: reportNote.trim() } : {}),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(apiMessage(payload, "Report could not be submitted"));
      setReporting(null);
      setReportReason("other");
      setReportNote("");
      setNotice("Report sent to the moderation queue.");
      trackAnalyticsEvent("discussion_post_reported", { fight_id: fightId });
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Report could not be submitted",
      );
    } finally {
      setReportBusy(false);
    }
  }

  function PostActions({
    post,
    rootPostId,
  }: {
    post: DiscussionPost;
    rootPostId: string;
  }) {
    if (!currentUser || post.status !== "published") return null;
    return (
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-fl-text-dim">
        <button
          className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-fl-accent"
          onClick={() => chooseReply(post, rootPostId)}
          type="button"
        >
          <CornerUpLeft aria-hidden="true" size={13} /> Reply
        </button>
        {currentUser.uid !== post.uid ? (
          <>
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-fl-warning"
              onClick={() => setReporting({ post, rootPostId })}
              type="button"
            >
              <Flag aria-hidden="true" size={12} /> Report
            </button>
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-fl-danger"
              onClick={() => void blockMember(post)}
              type="button"
            >
              <Ban aria-hidden="true" size={12} /> Block
            </button>
          </>
        ) : null}
      </div>
    );
  }

  function PostBody({ post }: { post: DiscussionPost }) {
    const badge = roleLabel(post);
    return (
      <>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            className="focus-ring rounded text-sm font-bold hover:text-fl-accent"
            href={`/u/${post.author.handle}`}
          >
            @{post.author.handle}
          </Link>
          {badge ? (
            <span className="rounded-full border border-fl-accent/30 bg-fl-accent-soft px-2 py-0.5 font-mono text-[9px] tracking-[.06em] text-fl-accent uppercase">
              {badge}
            </span>
          ) : null}
          <time
            className="font-mono text-[10px] text-fl-text-dim"
            dateTime={new Date(post.createdAt).toISOString()}
            title={new Date(post.createdAt).toLocaleString()}
          >
            {timeLabel(post.createdAt)}
          </time>
        </div>
        {post.replyTo ? (
          <p className="mt-2 text-xs text-fl-text-dim">
            Replying to{" "}
            <span className="text-fl-info">@{post.replyTo.handle}</span>
          </p>
        ) : null}
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-fl-text-muted sm:text-[15px]">
          {post.status === "removed"
            ? "Post removed by moderation."
            : post.body}
        </p>
      </>
    );
  }

  return (
    <Card className="overflow-hidden" id="discussion">
      <CardHeader
        description="Persistent matchup analysis and replies. Separate from the live fight lobby."
        eyebrow="Community posts"
        title="Matchup discussion"
      />
      <div className="border-b border-fl-border p-5 sm:p-6">
        {error ? (
          <p
            className="mb-4 flex items-start gap-2 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-3 text-sm text-fl-danger"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 shrink-0" size={15} /> {error}
          </p>
        ) : null}
        {notice ? (
          <p
            className="mb-4 flex items-center gap-2 rounded-xl border border-fl-success/30 bg-fl-success/10 p-3 text-sm text-fl-success"
            role="status"
          >
            <ShieldCheck size={15} /> {notice}
          </p>
        ) : null}
        {!authReady ? (
          <div className="h-28 animate-pulse rounded-xl bg-fl-surface-2" />
        ) : currentUser ? (
          <form onSubmit={publish}>
            {replyTarget ? (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-fl-border bg-fl-surface-2 p-3 text-xs text-fl-text-muted">
                <span>
                  Replying to{" "}
                  <strong className="text-fl-text">
                    @{replyTarget.post.author.handle}
                  </strong>
                  <span className="mt-1 block truncate text-fl-text-dim">
                    {replyTarget.post.body}
                  </span>
                </span>
                <button
                  aria-label="Cancel reply"
                  className="focus-ring shrink-0 rounded p-1 hover:text-fl-text"
                  onClick={() => setReplyTarget(null)}
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
            ) : null}
            <label className="sr-only" htmlFor={`discussion-${fightId}`}>
              Add a post about {fightLabel}
            </label>
            <textarea
              className="focus-ring min-h-28 w-full resize-y rounded-xl border border-fl-border bg-fl-surface-2 p-4 text-sm leading-6 placeholder:text-fl-text-dim"
              id={`discussion-${fightId}`}
              maxLength={DISCUSSION_POST_MAX_LENGTH}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                replyTarget
                  ? `Reply to @${replyTarget.post.author.handle}…`
                  : "Share your matchup read…"
              }
              ref={textarea}
              value={body}
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-mono text-[10px] text-fl-text-dim">
                {[...body].length}/{DISCUSSION_POST_MAX_LENGTH.toLocaleString()}
              </span>
              <Button
                disabled={publishing || !body.trim()}
                size="sm"
                type="submit"
              >
                {publishing ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Send size={15} />
                )}
                {replyTarget ? "Post reply" : "Publish post"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-dashed border-fl-border bg-fl-surface-2 p-5 text-center">
            <MessageSquareText
              aria-hidden="true"
              className="mx-auto text-fl-text-dim"
              size={24}
            />
            <p className="mt-3 text-sm font-semibold">
              Join the matchup discussion
            </p>
            <p className="mt-1 text-xs leading-5 text-fl-text-muted">
              Sign in with a verified FightLobby account to publish posts and
              replies.
            </p>
            <Link
              className="focus-ring mt-4 inline-flex min-h-10 items-center rounded-lg bg-fl-accent px-4 text-xs font-bold text-fl-bg"
              href={`/login?returnTo=${encodeURIComponent(`${pathname}#discussion`)}`}
            >
              Sign in to post
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fl-border px-5 py-3 sm:px-6">
        <div className="flex items-center gap-1 rounded-lg border border-fl-border bg-fl-surface-2 p-1">
          {(["newest", "oldest"] as const).map((value) => (
            <button
              aria-pressed={order === value}
              className={`focus-ring min-h-8 rounded-md px-3 text-[11px] font-bold capitalize transition ${order === value ? "bg-fl-surface-3 text-fl-text" : "text-fl-text-dim hover:text-fl-text"}`}
              key={value}
              onClick={() => setOrder(value)}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-bold text-fl-text-dim hover:text-fl-text"
          disabled={refreshing}
          onClick={() => void loadDiscussion()}
          type="button"
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} size={13} />
          Refresh
        </button>
      </div>

      <div aria-busy={loading} aria-live="polite">
        {loading ? (
          <div className="space-y-5 p-5 sm:p-6">
            {[0, 1, 2].map((value) => (
              <div
                className="h-24 animate-pulse rounded-xl bg-fl-surface-2"
                key={value}
              />
            ))}
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="px-5 py-14 text-center sm:px-6">
            <MessageSquareText className="mx-auto text-fl-text-dim" size={28} />
            <p className="mt-3 font-display text-xl font-bold">
              Start the first thread
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-fl-text-muted">
              Predictions live above. Use this space for lasting matchup
              analysis, questions, and replies.
            </p>
          </div>
        ) : (
          <div>
            {visibleThreads.map((thread) => {
              const open = expanded.has(thread.post.id);
              const replyTotal = Math.max(
                thread.post.replyCount,
                thread.replies.length,
              );
              return (
                <article
                  className="border-b border-fl-border px-5 py-6 last:border-b-0 sm:px-6"
                  key={thread.post.id}
                >
                  <PostBody post={thread.post} />
                  <PostActions post={thread.post} rootPostId={thread.post.id} />
                  {replyTotal > 0 ? (
                    <button
                      aria-expanded={open}
                      className="focus-ring mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-bold text-fl-info hover:bg-fl-info/10"
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (open) next.delete(thread.post.id);
                          else next.add(thread.post.id);
                          return next;
                        })
                      }
                      type="button"
                    >
                      {open ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                      {open ? "Hide" : "View"} {replyTotal}{" "}
                      {replyTotal === 1 ? "reply" : "replies"}
                    </button>
                  ) : null}
                  {open ? (
                    <div className="mt-2">
                      {thread.replies.map((reply) => (
                        <article
                          className="relative ml-2 border-l border-fl-border py-4 pl-7 before:absolute before:top-7 before:left-0 before:h-px before:w-4 before:bg-fl-border sm:ml-4 sm:pl-9 sm:before:w-6"
                          key={reply.id}
                        >
                          <PostBody post={reply} />
                          <PostActions
                            post={reply}
                            rootPostId={thread.post.id}
                          />
                        </article>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
      {nextCursor !== null ? (
        <div className="border-t border-fl-border p-4 text-center">
          <Button
            disabled={loadingMore}
            onClick={() => void loadDiscussion({ append: true })}
            size="sm"
            variant="secondary"
          >
            {loadingMore ? (
              <LoaderCircle className="animate-spin" size={14} />
            ) : null}
            Load more posts
          </Button>
        </div>
      ) : null}

      <dialog
        aria-labelledby="discussion-report-title"
        className="w-[min(92vw,30rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
        onCancel={() => setReporting(null)}
        ref={reportDialog}
      >
        <form onSubmit={submitReport}>
          <div className="border-b border-fl-border p-5">
            <p className="eyebrow">Community safety</p>
            <h2
              className="mt-2 font-display text-2xl font-bold"
              id="discussion-report-title"
            >
              Report this post
            </h2>
            <p className="mt-2 text-sm text-fl-text-muted">
              Reports are private and reviewed by FightLobby moderation.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <label className="block text-sm font-bold">
              Reason
              <select
                className="focus-ring mt-2 min-h-11 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-3 font-normal"
                onChange={(event) =>
                  setReportReason(event.target.value as ReportReason)
                }
                value={reportReason}
              >
                {reportReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              Additional context{" "}
              <span className="font-normal text-fl-text-dim">(optional)</span>
              <textarea
                className="focus-ring mt-2 min-h-20 w-full rounded-lg border border-fl-border bg-fl-surface-2 p-3 font-normal"
                maxLength={300}
                onChange={(event) => setReportNote(event.target.value)}
                value={reportNote}
              />
            </label>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-fl-border p-5 sm:flex-row sm:justify-end">
            <Button
              disabled={reportBusy}
              onClick={() => setReporting(null)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={reportBusy} type="submit" variant="danger">
              {reportBusy ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Flag size={15} />
              )}
              Submit report
            </Button>
          </div>
        </form>
      </dialog>
    </Card>
  );
}
