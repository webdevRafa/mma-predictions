"use client";

import {
  chatMessageSchema,
  type ChatMessage,
  type ChatRoomStatus,
} from "@fightlobby/domain";
import {
  AlertTriangle,
  ArrowDown,
  Ban,
  ChevronUp,
  CornerUpLeft,
  LoaderCircle,
  MessageCircle,
  Send,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  endBefore,
  get,
  limitToLast,
  onDisconnect,
  onValue,
  orderByChild,
  query,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";
import { doc, onSnapshot } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import {
  getFirebaseAppCheckToken,
  getFirebaseClient,
  isFirebaseRealtimeConfigured,
} from "@/lib/firebase/client";

const PAGE_SIZE = 50;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function parseMessages(value: unknown) {
  return Object.values(record(value))
    .flatMap((candidate) => {
      const parsed = chatMessageSchema.safeParse(candidate);
      return parsed.success ? [parsed.data] : [];
    })
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    );
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.id.localeCompare(right.id),
  );
}

function apiMessage(value: unknown, fallback: string) {
  const error = record(record(value).error);
  return typeof error.message === "string" ? error.message : fallback;
}

function timeLabel(milliseconds: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(milliseconds));
}

function roomLabel(status: ChatRoomStatus | "loading" | "unavailable") {
  if (status === "slow_mode") return "Slow mode";
  if (status === "open") return "Open";
  if (status === "scheduled") return "Opens soon";
  if (status === "loading") return "Connecting";
  if (status === "unavailable") return "Unavailable";
  return "Read only";
}

export function FightChatPanel({
  roomId,
  fightLabel,
  onClose,
  roomType,
}: {
  roomId: string;
  fightLabel: string;
  onClose: () => void;
  roomType: "fight" | "event";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [roomStatus, setRoomStatus] = useState<
    ChatRoomStatus | "loading" | "unavailable"
  >(isFirebaseRealtimeConfigured ? "loading" : "unavailable");
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [presence, setPresence] = useState(0);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [newMessages, setNewMessages] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    isFirebaseRealtimeConfigured
      ? null
      : "Live chat needs the Firebase Realtime Database URL.",
  );
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const previousLatestRef = useRef(0);
  const presenceUidRef = useRef<string | null>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => !blocked.has(message.uid)),
    [blocked, messages],
  );

  const scrollToBottom = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    setNewMessages(0);
  }, []);

  useEffect(() => {
    if (!isFirebaseRealtimeConfigured) {
      return;
    }
    const { auth, database, firestore } = getFirebaseClient();
    const messagesReference = query(
      ref(database, `chat/v1/rooms/${roomId}/messages`),
      orderByChild("createdAt"),
      limitToLast(PAGE_SIZE),
    );
    const stopMessages = onValue(
      messagesReference,
      (snapshot) => {
        const incoming = parseMessages(snapshot.val());
        const latest = incoming.at(-1)?.createdAt ?? 0;
        setMessages((current) => mergeMessages(current, incoming));
        if (!initializedRef.current) {
          initializedRef.current = true;
          requestAnimationFrame(() => {
            const list = listRef.current;
            if (list) list.scrollTop = list.scrollHeight;
          });
        } else if (latest > previousLatestRef.current) {
          if (nearBottomRef.current)
            requestAnimationFrame(() => {
              const list = listRef.current;
              if (list) list.scrollTop = list.scrollHeight;
            });
          else setNewMessages((count) => count + 1);
        }
        previousLatestRef.current = Math.max(previousLatestRef.current, latest);
      },
      () => {
        setRoomStatus("unavailable");
        setError("The fight lobby could not connect.");
      },
    );
    const stopRoom = onSnapshot(
      doc(firestore, "chatRooms", roomId),
      (snapshot) => {
        const status: unknown = snapshot.get("status");
        setRoomStatus(
          ["scheduled", "open", "slow_mode", "read_only", "closed"].includes(
            String(status),
          )
            ? (status as ChatRoomStatus)
            : "unavailable",
        );
        const slowMode: unknown = snapshot.get("slowModeSeconds");
        setSlowModeSeconds(typeof slowMode === "number" ? slowMode : 0);
      },
      () => setRoomStatus("unavailable"),
    );
    const stopPresence = onValue(
      ref(database, `chat/v1/rooms/${roomId}/presence`),
      (snapshot) => {
        const users = Object.values(record(snapshot.val()));
        setPresence(
          users.filter((user) => record(user).connected === true).length,
        );
      },
    );
    const stopAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      const previousUid = presenceUidRef.current;
      if (previousUid && previousUid !== user?.uid)
        void set(
          ref(database, `chat/v1/rooms/${roomId}/presence/${previousUid}`),
          { connected: false, lastSeen: serverTimestamp() },
        );
      presenceUidRef.current = user?.uid ?? null;
      if (!user) return;
      const presenceReference = ref(
        database,
        `chat/v1/rooms/${roomId}/presence/${user.uid}`,
      );
      void set(presenceReference, {
        connected: true,
        lastSeen: serverTimestamp(),
      });
      void onDisconnect(presenceReference).set({
        connected: false,
        lastSeen: serverTimestamp(),
      });
    });
    void fetch("/api/chat/blocks", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: unknown) => {
        const candidates = record(payload).blocked;
        if (Array.isArray(candidates))
          setBlocked(
            new Set(
              candidates.filter(
                (candidate): candidate is string =>
                  typeof candidate === "string",
              ),
            ),
          );
      })
      .catch(() => undefined);
    return () => {
      stopMessages();
      stopRoom();
      stopPresence();
      stopAuth();
      if (presenceUidRef.current)
        void set(
          ref(
            database,
            `chat/v1/rooms/${roomId}/presence/${presenceUidRef.current}`,
          ),
          { connected: false, lastSeen: serverTimestamp() },
        );
    };
  }, [roomId]);

  async function appCheckHeaders() {
    const token = await getFirebaseAppCheckToken();
    return token ? { "X-Firebase-AppCheck": token } : {};
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({
          body,
          clientNonce: crypto.randomUUID(),
          ...(replyTo ? { replyToMessageId: replyTo.id } : {}),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(apiMessage(payload, "Message could not be sent"));
      setBody("");
      setReplyTo(null);
      setNotice("Message sent");
      trackAnalyticsEvent("chat_message_sent", { room_type: roomType });
      nearBottomRef.current = true;
      requestAnimationFrame(scrollToBottom);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Message could not be sent",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || loadingOlder || !hasOlder) return;
    setLoadingOlder(true);
    try {
      const { database } = getFirebaseClient();
      const snapshot = await get(
        query(
          ref(database, `chat/v1/rooms/${roomId}/messages`),
          orderByChild("createdAt"),
          endBefore(oldest.createdAt, oldest.id),
          limitToLast(25),
        ),
      );
      const older = parseMessages(snapshot.val());
      setHasOlder(older.length === 25);
      setMessages((current) => mergeMessages(current, older));
    } catch {
      setError("Older messages could not be loaded.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function blockMember(message: ChatMessage) {
    setError(null);
    try {
      const response = await fetch("/api/chat/blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({ targetUid: message.uid, blocked: true }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(apiMessage(payload, "Member could not be blocked"));
      setBlocked((current) => new Set([...current, message.uid]));
      setNotice(`@${message.author.handle} is now hidden for you.`);
    } catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Member could not be blocked",
      );
    }
  }

  async function reportMessage(message: ChatMessage) {
    setError(null);
    try {
      const response = await fetch("/api/chat/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({
          roomId,
          messageId: message.id,
          reason: "other",
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(apiMessage(payload, "Report could not be submitted"));
      setNotice("Report sent to the moderation queue.");
      trackAnalyticsEvent("chat_message_reported", { room_type: roomType });
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Report could not be submitted",
      );
    }
  }

  const writable = roomStatus === "open" || roomStatus === "slow_mode";

  return (
    <Card className="flex h-full min-h-[34rem] flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]">
      <header className="border-b border-fl-border bg-fl-surface-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">
              {roomType === "event" ? "Event lobby" : "Fight lobby"}
            </p>
            <h2 className="mt-1 text-sm font-bold">{fightLabel}</h2>
          </div>
          <button
            aria-label={`Close ${roomType} lobby`}
            autoFocus
            className="focus-ring rounded-lg border border-fl-border p-2 text-fl-text-muted hover:text-fl-text"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] tracking-[.06em] text-fl-text-dim uppercase">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fl-border px-2 py-1">
            <Users aria-hidden="true" size={11} /> {presence} here
          </span>
          <span className="rounded-full border border-fl-border px-2 py-1">
            {roomLabel(roomStatus)}
          </span>
          {slowModeSeconds > 0 ? (
            <span className="rounded-full border border-fl-border px-2 py-1">
              {slowModeSeconds}s slow mode
            </span>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          className="h-full space-y-3 overflow-y-auto p-4"
          onScroll={(event) => {
            const element = event.currentTarget;
            nearBottomRef.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              100;
            if (nearBottomRef.current) setNewMessages(0);
          }}
          ref={listRef}
          tabIndex={0}
        >
          {hasOlder && messages.length > 0 ? (
            <button
              className="focus-ring mx-auto flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-fl-text-muted hover:text-fl-text"
              disabled={loadingOlder}
              onClick={loadOlder}
              type="button"
            >
              {loadingOlder ? (
                <LoaderCircle className="animate-spin" size={14} />
              ) : (
                <ChevronUp size={14} />
              )}
              Load earlier messages
            </button>
          ) : null}
          {visibleMessages.length === 0 ? (
            <div className="py-16 text-center">
              <MessageCircle
                aria-hidden="true"
                className="mx-auto text-fl-text-dim"
                size={28}
              />
              <p className="mt-3 text-sm font-semibold">The lobby is quiet.</p>
              <p className="mt-1 text-xs text-fl-text-muted">
                Be the first to talk about the{" "}
                {roomType === "event" ? "card" : "matchup"}.
              </p>
            </div>
          ) : null}
          {visibleMessages.map((message) => (
            <article
              className={cn(
                "rounded-xl border p-3",
                message.status === "removed"
                  ? "border-dashed border-fl-border bg-fl-surface-2/50"
                  : "border-fl-border bg-fl-surface-2",
              )}
              key={message.id}
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  className="focus-ring rounded text-xs font-bold hover:text-fl-accent"
                  href={`/u/${message.author.handle}`}
                >
                  @{message.author.handle}
                </Link>
                <time
                  className="font-mono text-[9px] text-fl-text-dim"
                  dateTime={new Date(message.createdAt).toISOString()}
                >
                  {timeLabel(message.createdAt)}
                </time>
              </div>
              {message.replyTo ? (
                <p className="mt-2 border-l-2 border-fl-border pl-2 text-[11px] text-fl-text-dim">
                  Replying to @{message.replyTo.handle}:{" "}
                  {message.replyTo.excerpt}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-5">
                {message.status === "removed"
                  ? "Message removed by moderation"
                  : message.body}
              </p>
              {message.status === "published" && currentUser ? (
                <div className="mt-2 flex gap-3 text-[10px] font-bold text-fl-text-dim">
                  <button
                    className="focus-ring inline-flex items-center gap-1 rounded hover:text-fl-accent"
                    onClick={() => setReplyTo(message)}
                    type="button"
                  >
                    <CornerUpLeft size={11} /> Reply
                  </button>
                  {currentUser.uid !== message.uid ? (
                    <>
                      <button
                        className="focus-ring inline-flex items-center gap-1 rounded hover:text-fl-warning"
                        onClick={() => reportMessage(message)}
                        type="button"
                      >
                        <ShieldAlert size={11} /> Report
                      </button>
                      <button
                        className="focus-ring inline-flex items-center gap-1 rounded hover:text-fl-danger"
                        onClick={() => blockMember(message)}
                        type="button"
                      >
                        <Ban size={11} /> Block
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {newMessages > 0 ? (
          <button
            className="focus-ring absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-fl-accent px-3 py-2 text-xs font-bold text-fl-bg shadow-lg"
            onClick={scrollToBottom}
            type="button"
          >
            <ArrowDown size={14} /> {newMessages} new
          </button>
        ) : null}
      </div>

      <div className="border-t border-fl-border bg-fl-surface-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error ? (
          <p
            className="mb-3 flex items-start gap-2 rounded-lg bg-fl-danger/10 p-3 text-xs text-fl-danger"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 shrink-0" size={13} /> {error}
          </p>
        ) : null}
        {notice ? (
          <p
            className="mb-3 rounded-lg bg-fl-success/10 p-3 text-xs text-fl-success"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {replyTo ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-fl-border p-2 text-xs text-fl-text-muted">
            <span>Replying to @{replyTo.author.handle}</span>
            <button
              aria-label="Cancel reply"
              className="focus-ring rounded"
              onClick={() => setReplyTo(null)}
              type="button"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}
        {!currentUser ? (
          <p className="text-center text-xs text-fl-text-muted">
            <Link
              className="font-bold text-fl-accent"
              href={`/login?returnTo=${encodeURIComponent(`${location.pathname}#lobby`)}`}
            >
              Sign in
            </Link>{" "}
            with a verified account to post.
          </p>
        ) : writable ? (
          <form onSubmit={sendMessage}>
            <label className="sr-only" htmlFor={`chat-${roomId}`}>
              Message the {roomType} lobby
            </label>
            <textarea
              className="focus-ring min-h-20 w-full resize-none rounded-xl border border-fl-border bg-fl-surface-2 p-3 text-sm placeholder:text-fl-text-dim"
              id={`chat-${roomId}`}
              maxLength={240}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add to the fight conversation…"
              value={body}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono text-[9px] text-fl-text-dim">
                {[...body].length}/240
              </span>
              <Button disabled={busy || !body.trim()} size="sm" type="submit">
                {busy ? (
                  <LoaderCircle className="animate-spin" size={14} />
                ) : (
                  <Send size={14} />
                )}
                Send
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-center text-xs text-fl-text-muted">
            This lobby is {roomLabel(roomStatus).toLocaleLowerCase()} and cannot
            accept new messages.
          </p>
        )}
      </div>
    </Card>
  );
}
