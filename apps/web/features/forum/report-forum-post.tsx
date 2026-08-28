"use client";

import { Flag, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { getFirebaseAppCheckToken } from "@/lib/firebase/client";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function apiMessage(value: unknown, fallback: string) {
  const error = record(record(value).error);
  return typeof error.message === "string" ? error.message : fallback;
}

export function ReportForumPost({
  postId,
  postType,
  threadId,
}: {
  postId: string;
  postType: "thread" | "reply";
  threadId: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getFirebaseAppCheckToken();
      const response = await fetch("/api/discussions/forum/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Firebase-AppCheck": token } : {}),
        },
        body: JSON.stringify({
          threadId,
          postId,
          postType,
          reason,
          ...(note.trim() ? { note } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(apiMessage(payload, "Report could not be submitted"));
      setReported(true);
      setOpen(false);
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Report could not be submitted",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-fl-text-dim transition hover:bg-fl-surface-2 hover:text-fl-text"
        disabled={reported}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Flag aria-hidden="true" size={13} /> {reported ? "Reported" : "Report"}
      </button>
      <dialog
        className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
        onCancel={() => setOpen(false)}
        ref={dialog}
      >
        <form onSubmit={submit}>
          <div className="flex items-center justify-between border-b border-fl-border px-5 py-4">
            <h2 className="font-display text-2xl font-semibold">Report post</h2>
            <button
              aria-label="Close report form"
              className="focus-ring grid size-9 place-items-center rounded-lg text-fl-text-muted hover:bg-fl-surface-2 hover:text-fl-text"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
          <div className="space-y-5 p-5">
            <label className="block text-sm font-bold">
              Reason
              <select
                className="focus-ring mt-2 h-11 w-full rounded-xl border border-fl-border bg-fl-surface-2 px-3 font-normal"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              >
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="hate">Hateful content</option>
                <option value="threat">Threat</option>
                <option value="doxxing">Private information</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block text-sm font-bold">
              Additional context{" "}
              <span className="font-normal text-fl-text-dim">(optional)</span>
              <textarea
                className="focus-ring mt-2 min-h-24 w-full resize-y rounded-xl border border-fl-border bg-fl-surface-2 p-3 font-normal leading-6"
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                value={note}
              />
            </label>
            {error ? (
              <p className="text-sm text-[#ff9a9a]" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Flag size={16} />
              )}
              {submitting ? "Submitting…" : "Submit report"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
