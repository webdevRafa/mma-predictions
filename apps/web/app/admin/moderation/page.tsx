import type { Metadata } from "next";
import { Timestamp } from "firebase-admin/firestore";
import Link from "next/link";

import {
  AdminNotice,
  AdminSafetyFields,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Moderation console",
  robots: { index: false, follow: false },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function date(value: unknown) {
  return value instanceof Timestamp
    ? value.toDate().toLocaleString()
    : "Pending";
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ adminSuccess?: string; adminError?: string }>;
}) {
  await requireAdminPage("/admin/moderation");
  const firestore = getFirebaseAdmin().firestore;
  const [reports, removals, rooms] = await Promise.all([
    firestore
      .collection("reports")
      .where("status", "==", "open")
      .limit(100)
      .get(),
    firestore
      .collection("moderationActions")
      .where("type", "==", "remove_chat_message")
      .limit(50)
      .get(),
    firestore.collection("chatRooms").limit(40).get(),
  ]);
  const query = await searchParams;
  return (
    <main id="main-content">
      <AdminNotice
        error={query.adminError}
        success={
          query.adminSuccess
            ? "Moderation action completed and audited."
            : undefined
        }
      />
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        MODERATION
      </h1>
      <p className="mt-3 text-sm text-fl-text-muted">
        Chat and post context, report resolution, sanctions, restoration, and
        room emergency controls.
      </p>

      <Card className="mt-8">
        <CardHeader eyebrow={`${reports.size} open`} title="Report queue" />
        <div className="divide-y divide-fl-border">
          {reports.docs.map((document) => {
            const isDiscussionPost = document.get("type") === "discussion_post";
            const isForumPost = document.get("type") === "forum_post";
            const content = record(
              document.get(
                isDiscussionPost || isForumPost
                  ? "postSnapshot"
                  : "messageSnapshot",
              ),
            );
            const author = record(content.author);
            const roomId = String(document.get("roomId") ?? "");
            const messageId = String(document.get("messageId") ?? "");
            const fightId = String(document.get("fightId") ?? "");
            const postId = String(document.get("postId") ?? "");
            const rootPostId = String(document.get("rootPostId") ?? "");
            const threadId = String(document.get("threadId") ?? "");
            const postType = String(document.get("postType") ?? "reply");
            const targetUid = String(document.get("targetUid") ?? "");
            return (
              <details className="px-5 py-4" key={document.id}>
                <summary className="focus-ring flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          document.get("severity") === "high"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {String(document.get("reason") ?? "report")}
                      </Badge>
                      <Badge tone="neutral">
                        {isForumPost
                          ? "Forum post"
                          : isDiscussionPost
                            ? "Matchup post"
                            : "Live chat"}
                      </Badge>
                      <span className="text-sm font-bold">
                        @{text(author.handle, targetUid)}
                      </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm text-fl-text-muted">
                      {text(content.body, "Content snapshot unavailable")}
                    </p>
                  </div>
                  <span className="text-xs text-fl-text-dim">
                    {date(document.get("createdAt"))}
                  </span>
                </summary>
                <div className="mt-5 grid gap-5 border-t border-fl-border pt-5 xl:grid-cols-3">
                  <form action="/api/admin/actions" method="post">
                    <input name="action" type="hidden" value="resolve_report" />
                    <input name="reportId" type="hidden" value={document.id} />
                    <label className={adminLabelClass}>
                      Resolution
                      <select className={adminInputClass} name="resolution">
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                        <option value="escalated">Escalated</option>
                      </select>
                    </label>
                    <AdminSafetyFields
                      confirmation={`RESOLVE ${document.id}`}
                      returnTo="/admin/moderation"
                      submitLabel="Resolve report"
                    />
                  </form>
                  <form action="/api/admin/actions" method="post">
                    <input
                      name="action"
                      type="hidden"
                      value={
                        isForumPost
                          ? "remove_forum_post"
                          : isDiscussionPost
                            ? "remove_discussion_post"
                            : "remove_message"
                      }
                    />
                    {isForumPost ? (
                      <>
                        <input name="threadId" type="hidden" value={threadId} />
                        <input name="postId" type="hidden" value={postId} />
                        <input name="postType" type="hidden" value={postType} />
                      </>
                    ) : isDiscussionPost ? (
                      <>
                        <input name="fightId" type="hidden" value={fightId} />
                        <input name="postId" type="hidden" value={postId} />
                        <input
                          name="rootPostId"
                          type="hidden"
                          value={rootPostId}
                        />
                      </>
                    ) : (
                      <>
                        <input name="roomId" type="hidden" value={roomId} />
                        <input
                          name="messageId"
                          type="hidden"
                          value={messageId}
                        />
                      </>
                    )}
                    <p className="text-sm font-bold">
                      Remove reported{" "}
                      {isDiscussionPost || isForumPost ? "post" : "message"}
                    </p>
                    <AdminSafetyFields
                      confirmation={
                        isForumPost
                          ? `REMOVE FORUM ${postId}`
                          : isDiscussionPost
                            ? `REMOVE POST ${postId}`
                            : `REMOVE ${messageId}`
                      }
                      danger
                      returnTo="/admin/moderation"
                      submitLabel={`Remove ${isDiscussionPost || isForumPost ? "post" : "message"}`}
                    />
                  </form>
                  <div>
                    <p className="text-sm font-bold">User controls</p>
                    <p className="mt-2 font-mono text-xs text-fl-text-dim">
                      {targetUid}
                    </p>
                    <Link
                      className="focus-ring mt-4 inline-block rounded text-xs font-bold text-fl-accent"
                      href={`/admin/users/${targetUid}`}
                    >
                      Review roles and sanctions
                    </Link>
                  </div>
                </div>
              </details>
            );
          })}
          {reports.empty ? (
            <p className="p-5 text-sm text-fl-text-muted">No open reports.</p>
          ) : null}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          eyebrow="False positives"
          title="Restore removed messages"
        />
        <div className="divide-y divide-fl-border">
          {removals.docs
            .filter((document) => document.get("status") !== "restored")
            .map((document) => (
              <form
                action="/api/admin/actions"
                className="grid gap-4 px-5 py-4 xl:grid-cols-[1fr_2fr_2fr_auto] xl:items-end"
                key={document.id}
                method="post"
              >
                <input name="action" type="hidden" value="restore_message" />
                <input
                  name="moderationActionId"
                  type="hidden"
                  value={document.id}
                />
                <input
                  name="returnTo"
                  type="hidden"
                  value="/admin/moderation"
                />
                <div>
                  <p className="font-mono text-xs">{document.id}</p>
                  <p className="mt-1 text-xs text-fl-text-dim">
                    {String(document.get("messageId") ?? "")}
                  </p>
                </div>
                <label className={adminLabelClass}>
                  Reason
                  <input
                    className={adminInputClass}
                    minLength={5}
                    name="reason"
                    required
                  />
                </label>
                <label className={adminLabelClass}>
                  Confirm
                  <input
                    className={adminInputClass}
                    name="confirmation"
                    placeholder={`RESTORE ${document.id}`}
                    required
                  />
                </label>
                <button
                  className="focus-ring rounded-lg bg-fl-accent px-4 py-3 text-xs font-bold text-fl-bg"
                  type="submit"
                >
                  Restore
                </button>
              </form>
            ))}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader eyebrow="Emergency controls" title="Chat rooms" />
        <div className="divide-y divide-fl-border">
          {rooms.docs.map((document) => (
            <form
              action="/api/admin/actions"
              className="grid gap-4 px-5 py-4 xl:grid-cols-[1.4fr_1fr_1fr_2fr_2fr_auto] xl:items-end"
              key={document.id}
              method="post"
            >
              <input name="action" type="hidden" value="room_control" />
              <input name="roomId" type="hidden" value={document.id} />
              <input name="returnTo" type="hidden" value="/admin/moderation" />
              <div>
                <p className="font-bold">{document.id}</p>
                <p className="mt-1 text-xs text-fl-text-dim">
                  {String(document.get("type") ?? "room")}
                </p>
              </div>
              <label className={adminLabelClass}>
                Status
                <select
                  className={adminInputClass}
                  defaultValue={String(document.get("status") ?? "read_only")}
                  name="status"
                >
                  {[
                    "scheduled",
                    "open",
                    "slow_mode",
                    "read_only",
                    "closed",
                  ].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className={adminLabelClass}>
                Slow seconds
                <input
                  className={adminInputClass}
                  defaultValue={String(document.get("slowModeSeconds") ?? 7)}
                  max="300"
                  min="0"
                  name="slowModeSeconds"
                  type="number"
                />
              </label>
              <label className={adminLabelClass}>
                Reason
                <input
                  className={adminInputClass}
                  minLength={5}
                  name="reason"
                  required
                />
              </label>
              <label className={adminLabelClass}>
                Confirm
                <input
                  className={adminInputClass}
                  name="confirmation"
                  placeholder={`ROOM ${document.id}`}
                  required
                />
              </label>
              <button
                className="focus-ring rounded-lg bg-fl-danger px-4 py-3 text-xs font-bold text-white"
                type="submit"
              >
                Apply
              </button>
            </form>
          ))}
        </div>
      </Card>
    </main>
  );
}
