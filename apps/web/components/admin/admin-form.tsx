import type { ReactNode } from "react";

export const adminInputClass =
  "focus-ring mt-2 w-full rounded-lg border border-fl-border bg-fl-bg px-3 py-2.5 text-sm text-fl-text placeholder:text-fl-text-dim";
export const adminLabelClass =
  "block text-xs font-bold tracking-[.06em] text-fl-text-muted uppercase";

export function AdminSafetyFields({
  confirmation,
  returnTo,
  submitLabel = "Save audited change",
  children,
  danger = false,
}: {
  confirmation: string;
  returnTo: string;
  submitLabel?: string;
  children?: ReactNode;
  danger?: boolean;
}) {
  return (
    <>
      {children}
      <div className="mt-5 grid gap-4 border-t border-fl-border pt-5 sm:grid-cols-2">
        <label className={adminLabelClass}>
          Reason
          <textarea
            className={adminInputClass}
            maxLength={500}
            minLength={5}
            name="reason"
            placeholder="Why is this change necessary?"
            required
            rows={3}
          />
        </label>
        <label className={adminLabelClass}>
          Type to confirm
          <input
            autoComplete="off"
            className={adminInputClass}
            name="confirmation"
            placeholder={confirmation}
            required
          />
          <span className="mt-2 block font-mono text-[10px] tracking-normal text-fl-warning normal-case">
            Required: {confirmation}
          </span>
        </label>
      </div>
      <input name="returnTo" type="hidden" value={returnTo} />
      <button
        className={`focus-ring mt-5 rounded-lg px-4 py-3 text-xs font-extrabold tracking-[.06em] uppercase ${
          danger
            ? "bg-fl-danger text-white"
            : "bg-fl-accent text-fl-bg hover:bg-fl-accent-strong"
        }`}
        type="submit"
      >
        {submitLabel}
      </button>
    </>
  );
}

export function AdminNotice({
  success,
  error,
}: {
  success?: string | undefined;
  error?: string | undefined;
}) {
  if (!success && !error) return null;
  return (
    <div
      className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
        error
          ? "border-fl-danger/40 bg-fl-danger/10 text-fl-danger"
          : "border-fl-success/40 bg-fl-success/10 text-fl-success"
      }`}
      role="status"
    >
      {error ?? success}
    </div>
  );
}

export function ProviderDiffTable({
  rows,
}: {
  rows: Array<{
    field: string;
    provider: unknown;
    canonical: unknown;
    override: unknown;
    overridden: boolean;
  }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
          <tr>
            <th className="px-4 py-3">Field</th>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Canonical</th>
            <th className="px-4 py-3">Override</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-fl-border">
          {rows.map((row) => (
            <tr key={row.field}>
              <th className="px-4 py-3 font-mono">{row.field}</th>
              <td className="max-w-64 px-4 py-3 font-mono break-words text-fl-text-muted">
                {JSON.stringify(row.provider) ?? "—"}
              </td>
              <td className="max-w-64 px-4 py-3 font-mono break-words">
                {JSON.stringify(row.canonical) ?? "—"}
              </td>
              <td className="max-w-64 px-4 py-3 font-mono break-words text-fl-accent">
                {row.overridden ? JSON.stringify(row.override) : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-5 text-fl-text-muted" colSpan={4}>
                Canonical fields match the current provider snapshot.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
