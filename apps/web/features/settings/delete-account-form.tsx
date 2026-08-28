"use client";

import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Deletion request failed");
      window.location.assign("/");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Deletion request failed",
      );
      setBusy(false);
    }
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg border border-fl-danger/30 bg-fl-danger/10 p-4 text-sm leading-6 text-fl-text-muted">
        This cannot be undone. Your Firebase sign-in and eligible Firestore,
        Storage, and live-chat data will be permanently removed. Your handle is
        quarantined instead of immediately becoming available to someone else.
      </div>
      {error ? (
        <p
          className="rounded-lg border border-fl-danger/30 bg-fl-danger/10 p-3 text-sm text-fl-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
          Type DELETE to confirm
        </span>
        <input
          className="focus-ring min-h-12 w-full rounded-lg border border-fl-danger/30 bg-fl-surface-2 px-4 text-sm"
          onChange={(event) => setConfirmation(event.target.value)}
          required
          value={confirmation}
        />
      </label>
      <button
        className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-fl-danger px-5 text-sm font-bold text-white disabled:opacity-50"
        disabled={busy || confirmation !== "DELETE"}
        type="submit"
      >
        <Trash2 aria-hidden="true" size={16} />
        Permanently delete my account
      </button>
    </form>
  );
}
