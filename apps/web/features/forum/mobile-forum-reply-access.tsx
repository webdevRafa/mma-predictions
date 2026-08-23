"use client";

import { LogIn, Reply } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ForumReplyComposer } from "@/features/forum/forum-reply-composer";
import { cn } from "@/lib/cn";

const TEXTAREA_ID = "mobile-forum-reply";

export function MobileForumReplyAccess({
  canReply,
  destinationPage,
  returnTo,
  threadId,
}: {
  canReply: boolean;
  destinationPage: number;
  returnTo: string;
  threadId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [triggerPassed, setTriggerPassed] = useState(false);
  const replyButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = trigger.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setTriggerPassed(
          !entry.isIntersecting && entry.boundingClientRect.bottom < 80,
        );
      },
      { rootMargin: "-72px 0px -80px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function openComposer() {
    setHasOpened(true);
    setExpanded(true);
    window.setTimeout(() => {
      document.getElementById(TEXTAREA_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      window.setTimeout(
        () => document.getElementById(TEXTAREA_ID)?.focus(),
        350,
      );
    }, 40);
  }

  function closeComposer() {
    setExpanded(false);
    window.setTimeout(() => replyButton.current?.focus(), 40);
  }

  return (
    <div className="md:hidden">
      <div
        className="flex min-h-16 items-center border-t border-fl-border px-5 py-3"
        ref={trigger}
      >
        {canReply && !expanded ? (
          <button
            aria-controls="mobile-reply-composer"
            aria-expanded="false"
            className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-fl-accent/45 bg-fl-accent/10 px-4 text-sm font-bold text-fl-text transition hover:bg-fl-accent hover:text-fl-bg"
            onClick={openComposer}
            ref={replyButton}
            type="button"
          >
            <Reply aria-hidden="true" size={17} />
            Reply to discussion
          </button>
        ) : canReply ? (
          <p className="inline-flex min-h-10 w-full items-center justify-center gap-2 text-sm font-bold text-fl-text-muted">
            <Reply aria-hidden="true" size={17} /> Replying to discussion
          </p>
        ) : (
          <Link
            className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-fl-border bg-fl-surface-2 px-4 text-sm font-bold text-fl-text transition hover:border-fl-accent/45 hover:text-fl-accent"
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          >
            <LogIn aria-hidden="true" size={16} /> Sign in to reply
          </Link>
        )}
      </div>

      {canReply ? (
        <div
          aria-hidden={!expanded}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            expanded
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
          id="mobile-reply-composer"
          inert={!expanded}
        >
          <div className="overflow-hidden">
            {hasOpened ? (
              <ForumReplyComposer
                canReply
                destinationPage={destinationPage}
                embedded
                onCancel={closeComposer}
                returnTo={returnTo}
                textareaId={TEXTAREA_ID}
                threadId={threadId}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {canReply && triggerPassed && !expanded ? (
        <button
          aria-controls="mobile-reply-composer"
          className="focus-ring fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-fl-accent/55 bg-fl-surface-1/95 px-4 text-sm font-bold text-fl-text shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-fl-accent hover:text-fl-bg"
          onClick={openComposer}
          type="button"
        >
          <Reply aria-hidden="true" size={17} /> Reply
        </button>
      ) : null}
    </div>
  );
}
