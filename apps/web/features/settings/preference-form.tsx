"use client";

import { Save } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { getFormString } from "@/lib/forms/form-data";

export function PreferenceForm({
  children,
  onSaved,
  values,
}: {
  children: ReactNode;
  onSaved?: (values: Record<string, string | boolean>) => void;
  values: Record<string, string | boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, fallback]) => [
        key,
        typeof fallback === "boolean"
          ? form.get(key) === "on"
          : getFormString(form, key, fallback),
      ]),
    );
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Preferences could not be saved",
        );
      onSaved?.(payload);
      setStatus("Preferences saved.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Preferences could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {status ? (
        <p
          className="rounded-lg border border-fl-border bg-fl-surface-2 p-3 text-sm"
          role="status"
        >
          {status}
        </p>
      ) : null}
      {children}
      <button
        className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        <Save aria-hidden="true" size={16} />
        {busy ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
