"use client";

import {
  CheckCircle2,
  CircleStop,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function errorMessage(value: unknown) {
  if (!value || typeof value !== "object") return "Event could not be updated";
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return "Event could not be updated";
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : "Event could not be updated";
}

export function EventStatusControl({
  eventId,
  eventName,
  initialStatus,
  totalFights,
  unresolvedFights,
}: {
  eventId: string;
  eventName: string;
  initialStatus: string;
  totalFights: number;
  unresolvedFights: number;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  const completed = status === "completed";
  const terminal = ["completed", "canceled", "postponed"].includes(status);

  async function completeEvent() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_event",
          eventId,
          patch: { status: "completed" },
          reason:
            "Final bout concluded; event marked complete by live administrator",
          confirmation: `UPDATE ${eventId}`,
          returnTo: `/admin/events/${eventId}`,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      setStatus("completed");
      setNotice(`${eventName} is now complete.`);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Event could not be updated",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-8 overflow-hidden" id="event-status-control">
      <section aria-labelledby="event-status-title">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Live event control</p>
              <Badge
                tone={completed ? "success" : terminal ? "warning" : "info"}
              >
                {completed ? "Event complete" : status}
              </Badge>
            </div>
            <h2
              className="mt-2 font-display text-3xl font-extrabold"
              id="event-status-title"
            >
              {completed
                ? "Live coverage ended"
                : "End the live event when the card finishes"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-fl-text-muted">
              {completed
                ? "The public live state has ended. Event and matchup chats remain open for a six-hour post-event window, then become read-only automatically."
                : "FightLobby still keeps the automatic six-hour main-card safety buffer. Use this control after the final bout to end the live state immediately and start the six-hour post-event chat window."}
            </p>
          </div>

          {completed ? (
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-fl-success/30 bg-fl-success/10 px-4 text-sm font-bold text-fl-success">
              <CheckCircle2 aria-hidden="true" size={18} /> Complete
            </div>
          ) : !terminal ? (
            <button
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg hover:bg-fl-accent-strong"
              onClick={() => {
                setError(null);
                setOpen(true);
              }}
              type="button"
            >
              <CircleStop aria-hidden="true" size={18} /> Mark event complete
            </button>
          ) : null}
        </div>

        <div className="grid gap-px border-t border-fl-border bg-fl-border sm:grid-cols-3">
          <div className="flex gap-3 bg-fl-surface-1 p-4 sm:px-6">
            <Clock3
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-fl-info"
              size={17}
            />
            <div>
              <p className="text-xs font-bold">Automatic fallback</p>
              <p className="mt-1 text-xs leading-5 text-fl-text-muted">
                Prelims through six hours after the main card starts.
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-fl-surface-1 p-4 sm:px-6">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-fl-success"
              size={17}
            />
            <div>
              <p className="text-xs font-bold">Audited override</p>
              <p className="mt-1 text-xs leading-5 text-fl-text-muted">
                Records the administrator, prior state, new state, and reason.
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-fl-surface-1 p-4 sm:px-6">
            {unresolvedFights > 0 ? (
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-fl-warning"
                size={17}
              />
            ) : (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-fl-success"
                size={17}
              />
            )}
            <div>
              <p className="text-xs font-bold">Bout results</p>
              <p className="mt-1 text-xs leading-5 text-fl-text-muted">
                {unresolvedFights > 0
                  ? `${unresolvedFights} of ${totalFights} bouts are not final.`
                  : `All ${totalFights} bouts are final or canceled.`}
              </p>
            </div>
          </div>
        </div>

        <div aria-live="polite" className="sr-only">
          {notice}
        </div>
        {notice ? (
          <div className="flex items-center gap-2 border-t border-fl-success/30 bg-fl-success/10 px-5 py-3 text-sm text-fl-success sm:px-6">
            <CheckCircle2 aria-hidden="true" size={17} /> {notice}
          </div>
        ) : null}
      </section>

      <dialog
        aria-labelledby="complete-event-title"
        className="w-[min(92vw,34rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setOpen(false);
        }}
        ref={dialog}
      >
        <div className="border-b border-fl-border p-5 sm:p-6">
          <p className="eyebrow">Final event confirmation</p>
          <h2
            className="mt-2 font-display text-3xl font-extrabold"
            id="complete-event-title"
          >
            Mark this event complete?
          </h2>
          <p className="mt-3 text-base font-bold">{eventName}</p>
          <p className="mt-2 text-sm leading-6 text-fl-text-muted">
            This immediately ends the public live state and starts a six-hour
            post-event chat window. Chats then become read-only, and their
            message history is removed after 30 days. This does not alter or
            grade individual fight results.
          </p>
        </div>

        {unresolvedFights > 0 ? (
          <div className="mx-5 mt-5 flex gap-3 rounded-xl border border-fl-warning/30 bg-fl-warning/10 p-4 text-sm text-fl-warning sm:mx-6">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              size={18}
            />
            <p>
              {unresolvedFights}{" "}
              {unresolvedFights === 1 ? "bout is" : "bouts are"} still
              unresolved. You can complete the event, but those fights must be
              finalized separately for scoring.
            </p>
          </div>
        ) : null}

        {error ? (
          <p
            className="mx-5 mt-5 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-3 text-sm text-fl-danger sm:mx-6"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            className="focus-ring min-h-11 rounded-lg border border-fl-border px-5 text-sm font-bold disabled:opacity-50"
            disabled={busy}
            onClick={() => setOpen(false)}
            type="button"
          >
            Keep event live
          </button>
          <button
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-50"
            disabled={busy}
            onClick={() => void completeEvent()}
            type="button"
          >
            {busy ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={17}
              />
            ) : (
              <CircleStop aria-hidden="true" size={17} />
            )}
            {busy ? "Completing…" : "Confirm event complete"}
          </button>
        </div>
      </dialog>
    </Card>
  );
}
