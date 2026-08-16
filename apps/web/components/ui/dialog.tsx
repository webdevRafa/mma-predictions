"use client";

import { X } from "lucide-react";
import { useRef } from "react";

import { Button } from "./button";

export function DialogPreview() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        Open matchup dialog
      </Button>
      <dialog
        aria-labelledby="matchup-dialog-title"
        className="m-auto w-[min(92vw,32rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
        ref={dialogRef}
      >
        <div className="flex items-start justify-between border-b border-fl-border px-5 py-4">
          <div>
            <p className="eyebrow">Prediction saved</p>
            <h2
              className="font-display text-2xl font-bold"
              id="matchup-dialog-title"
            >
              Your pick is still editable
            </h2>
          </div>
          <button
            aria-label="Close dialog"
            className="focus-ring grid size-10 cursor-pointer place-items-center rounded-lg text-fl-text-muted hover:bg-fl-surface-2 hover:text-fl-text"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="px-5 py-5 text-sm leading-6 text-fl-text-muted">
          Predictions lock at walkouts. FightLobby checks the official fight
          state on the server before saving every change.
        </div>
        <form
          className="flex justify-end border-t border-fl-border px-5 py-4"
          method="dialog"
        >
          <Button>Got it</Button>
        </form>
      </dialog>
    </>
  );
}
