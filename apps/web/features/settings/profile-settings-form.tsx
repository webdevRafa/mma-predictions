"use client";

import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import { getFormString } from "@/lib/forms/form-data";

import { AvatarEditor } from "../auth/avatar-editor";

async function responseMessage(response: Response) {
  const payload: unknown = await response.json();
  if (response.ok) return null;
  return typeof payload === "object" &&
    payload &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error &&
    "message" in payload.error
    ? String(payload.error.message)
    : "Changes could not be saved";
}

export function ProfileSettingsForm({
  handle,
  displayName,
  onSaved,
  profileVisibility,
}: {
  handle: string;
  displayName: string;
  onSaved?: (update: {
    handle: string;
    displayName: string;
    profileVisibility: "public" | "limited";
  }) => void;
  profileVisibility: "public" | "limited";
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const nextDisplayName = getFormString(form, "displayName");
      const nextVisibility = getFormString(form, "profileVisibility") as
        "public" | "limited";
      const settingsResponse = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: nextDisplayName || null,
          profileVisibility: nextVisibility,
        }),
      });
      const settingsError = await responseMessage(settingsResponse);
      if (settingsError) throw new Error(settingsError);
      const nextHandle = getFormString(form, "handle").toLowerCase();
      if (nextHandle !== handle) {
        const handleResponse = await fetch("/api/profile/handle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: nextHandle, acceptedTerms: false }),
        });
        const handleError = await responseMessage(handleResponse);
        if (handleError) throw new Error(handleError);
      }
      onSaved?.({
        handle: nextHandle,
        displayName: nextDisplayName,
        profileVisibility: nextVisibility,
      });
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Changes could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <AvatarEditor />
      {status ? (
        <p
          className="rounded-lg border border-fl-border bg-fl-surface-2 p-3 text-sm"
          role="status"
        >
          {status}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
          Public handle
        </span>
        <input
          autoCapitalize="none"
          className="focus-ring min-h-12 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm"
          defaultValue={handle}
          maxLength={20}
          minLength={3}
          name="handle"
          required
        />
      </label>
      <p className="-mt-3 text-xs text-fl-text-dim">
        Handle changes are limited to once every 30 days. Old links redirect.
      </p>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
          Display name
        </span>
        <input
          className="focus-ring min-h-12 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm"
          defaultValue={displayName}
          maxLength={50}
          name="displayName"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
          Profile visibility
        </span>
        <select
          className="focus-ring min-h-12 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm"
          defaultValue={profileVisibility}
          name="profileVisibility"
        >
          <option value="public">Public</option>
          <option value="limited">Limited</option>
        </select>
      </label>
      <button
        className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        <Save aria-hidden="true" size={16} />
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
