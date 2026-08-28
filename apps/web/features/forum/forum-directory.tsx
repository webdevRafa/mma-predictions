"use client";

import {
  ArrowRight,
  MessageSquareText,
  PenLine,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { normalizeSearchText } from "@fightlobby/domain";
import { MemberAvatar } from "@/features/forum/member-avatar";
import { formatForumTime, forumRelativeTime } from "@/lib/forum/format";
import { forumThreadPath } from "@/lib/forum/path";
import type { ForumThreadView } from "@/lib/forum/types";

function preview(body: string) {
  return body.replace(/\s+/g, " ").trim();
}

function matches(thread: ForumThreadView, query: string) {
  if (!query) return true;
  const search = normalizeSearchText(query);
  return normalizeSearchText(
    [
      thread.title,
      thread.body,
      thread.author.handle,
      thread.lastReply?.author.handle,
    ]
      .filter(Boolean)
      .join(" "),
  ).includes(search);
}

export function ForumDirectory({
  threads,
  now,
}: {
  threads: ForumThreadView[];
  now: number;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => threads.filter((thread) => matches(thread, query)),
    [query, threads],
  );

  return (
    <>
      <header className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-5xl leading-none font-semibold tracking-[-0.025em] sm:text-6xl">
            Discussions
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-fl-text-muted sm:text-base">
            Talk cards, matchups, results, and everything between fight nights.
          </p>
        </div>
        <Link
          className="focus-ring inline-flex min-h-11 w-fit items-center gap-2 rounded-[10px] border border-fl-accent/55 bg-fl-accent/12 px-4 text-sm font-bold text-fl-text transition hover:bg-fl-accent hover:text-fl-bg"
          href="/discussions/new"
        >
          <PenLine aria-hidden="true" size={16} /> Start discussion
        </Link>
      </header>

      {threads.length ? (
        <div className="relative mt-8 max-w-md">
          <label className="sr-only" htmlFor="discussion-search">
            Search discussions
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fl-text-dim"
            size={17}
          />
          <input
            autoComplete="off"
            className="focus-ring h-12 w-full rounded-xl border border-fl-border bg-fl-surface-1 pr-11 pl-11 text-sm text-fl-text outline-none placeholder:text-fl-text-dim hover:border-fl-border-strong focus:border-fl-accent/55"
            id="discussion-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics or members"
            spellCheck={false}
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear discussion search"
              className="focus-ring absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-fl-text-dim transition hover:bg-fl-surface-2 hover:text-fl-text"
              onClick={() => setQuery("")}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {filtered.length} {filtered.length === 1 ? "discussion" : "discussions"}
      </p>

      <section aria-label="Community discussions" className="mt-6 sm:mt-8">
        {filtered.length ? (
          <div className="overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
            <div className="hidden grid-cols-[minmax(0,2.35fr)_minmax(11rem,.9fr)_7rem_minmax(11rem,.95fr)] bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase lg:grid">
              <span className="px-5 py-3">Topic</span>
              <span className="px-5 py-3">Started by</span>
              <span className="px-5 py-3 text-center">Replies</span>
              <span className="px-5 py-3">Latest activity</span>
            </div>
            <div className="divide-y divide-fl-border">
              {filtered.map((thread) => {
                const latest = thread.lastReply ?? {
                  uid: thread.uid,
                  author: thread.author,
                  createdAt: thread.createdAt,
                };
                const latestPhoto = thread.lastReply
                  ? thread.lastReplyPhotoURL
                  : thread.authorPhotoURL;
                return (
                  <Link
                    className="group block p-5 transition hover:bg-fl-surface-2 focus-visible:bg-fl-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fl-accent lg:grid lg:min-h-32 lg:grid-cols-[minmax(0,2.35fr)_minmax(11rem,.9fr)_7rem_minmax(11rem,.95fr)] lg:items-center lg:p-0"
                    href={forumThreadPath(thread)}
                    key={thread.id}
                  >
                    <span className="block min-w-0 lg:px-5 lg:py-5">
                      <span className="flex items-center gap-3 lg:hidden">
                        <MemberAvatar
                          handle={thread.author.handle}
                          photoURL={thread.authorPhotoURL}
                          size="sm"
                        />
                        <span className="min-w-0 text-xs text-fl-text-muted">
                          <strong className="block truncate text-fl-text">
                            @{thread.author.handle}
                          </strong>
                          <time
                            dateTime={new Date(thread.createdAt).toISOString()}
                          >
                            {forumRelativeTime(thread.createdAt, now)}
                          </time>
                        </span>
                      </span>
                      <span className="mt-4 block font-display text-2xl leading-tight font-semibold text-fl-text transition group-hover:text-fl-accent lg:mt-0 lg:text-[1.65rem]">
                        {thread.title}
                      </span>
                      <span className="mt-2 line-clamp-2 block text-sm leading-6 text-fl-text-muted">
                        {preview(thread.body)}
                      </span>
                    </span>

                    <span className="hidden min-w-0 items-center gap-3 px-5 py-5 lg:flex">
                      <MemberAvatar
                        handle={thread.author.handle}
                        photoURL={thread.authorPhotoURL}
                        size="sm"
                      />
                      <span className="min-w-0 text-xs text-fl-text-muted">
                        <strong className="block truncate text-fl-text">
                          @{thread.author.handle}
                        </strong>
                        <time
                          dateTime={new Date(thread.createdAt).toISOString()}
                          title={formatForumTime(thread.createdAt)}
                        >
                          {forumRelativeTime(thread.createdAt, now)}
                        </time>
                      </span>
                    </span>

                    <span className="hidden px-5 py-5 text-center lg:block">
                      <strong className="font-display text-3xl font-semibold">
                        {thread.replyCount.toLocaleString()}
                      </strong>
                    </span>

                    <span className="hidden min-w-0 items-center gap-3 px-5 py-5 lg:flex">
                      <MemberAvatar
                        handle={latest.author.handle}
                        photoURL={latestPhoto}
                        size="sm"
                      />
                      <span className="min-w-0 text-xs text-fl-text-muted">
                        <strong className="block truncate text-fl-text">
                          @{latest.author.handle}
                        </strong>
                        <time
                          dateTime={new Date(latest.createdAt).toISOString()}
                          title={formatForumTime(latest.createdAt)}
                        >
                          {forumRelativeTime(latest.createdAt, now)}
                        </time>
                      </span>
                    </span>

                    <span className="mt-5 flex items-center justify-between border-t border-fl-border pt-4 text-xs text-fl-text-muted lg:hidden">
                      <span className="inline-flex items-center gap-1.5">
                        <MessageSquareText aria-hidden="true" size={14} />
                        {thread.replyCount.toLocaleString()}{" "}
                        {thread.replyCount === 1 ? "reply" : "replies"}
                      </span>
                      <span className="inline-flex items-center gap-2 text-fl-text">
                        Active {forumRelativeTime(thread.lastActivityAt, now)}
                        <ArrowRight aria-hidden="true" size={15} />
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : threads.length ? (
          <div className="rounded-2xl border border-fl-border bg-fl-surface-1 p-8 text-center">
            <h2 className="font-display text-3xl font-semibold">
              No matching discussions
            </h2>
            <p className="mt-2 text-sm text-fl-text-muted">
              Try another topic or member handle.
            </p>
            <button
              className="focus-ring mt-5 rounded-lg border border-fl-border bg-fl-surface-2 px-4 py-2 text-sm font-bold transition hover:border-fl-accent/45 hover:text-fl-accent"
              onClick={() => setQuery("")}
              type="button"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-fl-border bg-fl-surface-1 p-8 sm:p-10">
            <MessageSquareText
              aria-hidden="true"
              className="text-fl-accent"
              size={24}
            />
            <h2 className="mt-5 font-display text-3xl font-semibold">
              Start the first discussion
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-fl-text-muted">
              Ask a question, share a fight-night take, or open a topic for the
              community.
            </p>
            <Link
              className="focus-ring mt-6 inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-fl-accent/55 bg-fl-accent/12 px-4 text-sm font-bold transition hover:bg-fl-accent hover:text-fl-bg"
              href="/discussions/new"
            >
              <PenLine aria-hidden="true" size={16} /> Start discussion
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
