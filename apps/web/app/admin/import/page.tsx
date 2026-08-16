import type { Metadata } from "next";

import {
  AdminNotice,
  AdminSafetyFields,
  adminInputClass,
} from "@/components/admin/admin-form";
import { Card, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Manual UFC import",
  robots: { index: false, follow: false },
};

export default async function AdminImportPage({
  searchParams,
}: {
  searchParams: Promise<{ adminSuccess?: string; adminError?: string }>;
}) {
  const query = await searchParams;
  return (
    <main id="main-content">
      <AdminNotice
        error={query.adminError}
        success={
          query.adminSuccess
            ? "Fixture validated, imported, and audited."
            : undefined
        }
      />
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        MANUAL JSON IMPORT
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-fl-text-muted">
        Emergency path for a normalized UFC fixture. Validation is identical to
        repository fixtures; existing prediction aggregates and graded state are
        preserved.
      </p>
      <Card className="mt-8">
        <CardHeader
          eyebrow="Emergency data path"
          title="Normalized fixture"
          description="Paste schemaVersion 1 JSON. Review the event ID before typing the confirmation phrase."
        />
        <form action="/api/admin/actions" className="p-5" method="post">
          <input name="action" type="hidden" value="manual_import" />
          <textarea
            className={`${adminInputClass} min-h-96 font-mono text-xs`}
            name="fixture"
            placeholder={'{\n  "schemaVersion": 1,\n  ...\n}'}
            required
          />
          <AdminSafetyFields
            confirmation="IMPORT event-id"
            danger
            returnTo="/admin/import"
            submitLabel="Validate and import"
          >
            <p className="mt-4 rounded-lg border border-fl-warning/30 bg-fl-warning/10 px-4 py-3 text-xs text-fl-warning">
              Replace <code>event-id</code> in the confirmation field with the
              exact <code>event.id</code> from your JSON.
            </p>
          </AdminSafetyFields>
        </form>
      </Card>
    </main>
  );
}
