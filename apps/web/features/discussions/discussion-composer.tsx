import { DISCUSSION_POST_MAX_LENGTH } from "@fightlobby/domain";
import { LoaderCircle, Send, X } from "lucide-react";
import type { FormEventHandler, Ref } from "react";

import { Button } from "@/components/ui/button";

export type DiscussionReplyPreview = {
  body: string;
  handle: string;
};

export function DiscussionComposer({
  body,
  composerId,
  fightLabel,
  onBodyChange,
  onCancelReply,
  onSubmit,
  publishing,
  reply,
  textareaRef,
  variant = "inline",
}: {
  body: string;
  composerId: string;
  fightLabel: string;
  onBodyChange: (value: string) => void;
  onCancelReply: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  publishing: boolean;
  reply: DiscussionReplyPreview | null;
  textareaRef: Ref<HTMLTextAreaElement>;
  variant?: "inline" | "sheet";
}) {
  const helpId = `${composerId}-help`;

  return (
    <form onSubmit={onSubmit}>
      {reply ? (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-fl-border bg-fl-surface-2 p-3 text-xs text-fl-text-muted">
          <span className="min-w-0">
            Replying to{" "}
            <strong className="text-fl-text">@{reply.handle}</strong>
            <span className="mt-1 block truncate text-fl-text-dim">
              {reply.body}
            </span>
          </span>
          <button
            aria-label="Cancel reply"
            className="focus-ring shrink-0 rounded p-1 hover:text-fl-text"
            onClick={onCancelReply}
            type="button"
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      ) : null}
      <label className="sr-only" htmlFor={composerId}>
        Add a post about {fightLabel}
      </label>
      <textarea
        aria-describedby={helpId}
        className={`focus-ring w-full resize-y rounded-xl border border-fl-border bg-fl-surface-2 p-4 text-sm leading-6 placeholder:text-fl-text-dim ${
          variant === "sheet" ? "min-h-40" : "min-h-28"
        }`}
        id={composerId}
        maxLength={DISCUSSION_POST_MAX_LENGTH}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder={
          reply ? `Reply to @${reply.handle}…` : "Share your matchup read…"
        }
        ref={textareaRef}
        value={body}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fl-text-dim" id={helpId}>
          {!body.trim() ? (
            <span>Start typing to enable publishing. </span>
          ) : null}
          <span className="font-mono text-[10px]">
            {[...body].length}/{DISCUSSION_POST_MAX_LENGTH.toLocaleString()}
          </span>
        </p>
        <Button disabled={publishing || !body.trim()} size="sm" type="submit">
          {publishing ? (
            <LoaderCircle className="animate-spin" size={15} />
          ) : (
            <Send size={15} />
          )}
          {reply ? "Post reply" : "Publish post"}
        </Button>
      </div>
    </form>
  );
}
