import type { Metadata } from "next";

import {
  AdminNotice,
  AdminSafetyFields,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-form";
import { Card, CardHeader } from "@/components/ui/card";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Feature flags",
  robots: { index: false, follow: false },
};

const flags = [
  ["siteReadOnly", "Site read-only"],
  ["authEnabled", "Authentication"],
  ["predictionsEnabled", "Predictions"],
  ["chatEnabled", "Chat viewing"],
  ["chatPostingEnabled", "Chat posting"],
  ["providerSyncEnabled", "Provider sync"],
  ["liveSyncEnabled", "Live sync"],
  ["adsEnabled", "Ads"],
  ["emailEnabled", "Email"],
  ["socialCardsEnabled", "Social cards"],
] as const;

export default async function FeatureFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ adminSuccess?: string; adminError?: string }>;
}) {
  const snapshot = await getFirebaseAdmin()
    .firestore.collection("featureFlags")
    .doc("current")
    .get();
  const query = await searchParams;
  return (
    <main id="main-content">
      <AdminNotice
        error={query.adminError}
        success={
          query.adminSuccess ? "Feature flags updated and audited." : undefined
        }
      />
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        FEATURE FLAGS
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-fl-text-muted">
        Emergency controls take effect from Firestore without a web deployment.
        Ads remain disabled by default.
      </p>
      <Card className="mt-8">
        <CardHeader eyebrow="Global controls" title="Current environment" />
        <form action="/api/admin/actions" className="p-5" method="post">
          <input name="action" type="hidden" value="feature_flags" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {flags.map(([key, label]) => (
              <label className={adminLabelClass} key={key}>
                {label}
                <select
                  className={adminInputClass}
                  defaultValue={String(snapshot.get(key) === true)}
                  name={key}
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </label>
            ))}
          </div>
          <AdminSafetyFields
            confirmation="UPDATE FEATURE FLAGS"
            danger
            returnTo="/admin/feature-flags"
            submitLabel="Apply emergency controls"
          />
        </form>
      </Card>
    </main>
  );
}
