import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AdminNotice,
  AdminSafetyFields,
  ProviderDiffTable,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-form";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { providerDiff } from "@/lib/admin/diff";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit fighter",
  robots: { index: false, follow: false },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export default async function AdminFighterPage({
  params,
  searchParams,
}: {
  params: Promise<{ fighterId: string }>;
  searchParams: Promise<{ adminSuccess?: string; adminError?: string }>;
}) {
  await requireAdminPage("/admin/fighters");
  const { fighterId } = await params;
  const firestore = getFirebaseAdmin().firestore;
  const [fighterSnapshot, stateSnapshot] = await Promise.all([
    firestore.collection("fighters").doc(fighterId).get(),
    firestore
      .collection("providerEntityState")
      .doc(`fighter_${fighterId}`)
      .get(),
  ]);
  if (!fighterSnapshot.exists) notFound();
  const fighter = fighterSnapshot.data()!;
  const name = record(fighter.name);
  const query = await searchParams;
  const returnTo = `/admin/fighters/${fighterId}`;
  return (
    <main id="main-content">
      <AdminNotice
        error={query.adminError}
        success={
          query.adminSuccess ? "Audited fighter change saved." : undefined
        }
      />
      <p className="eyebrow">Fighter editor</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-7xl">
        {text(name.full, fighterId)}
      </h1>
      <p className="mt-2 font-mono text-xs text-fl-text-dim">{fighterId}</p>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Persistent override"
            title="Fighter profile"
            description="A blank nickname removes the canonical nickname without merging identities."
          />
          <form action="/api/admin/actions" className="p-5" method="post">
            <input name="action" type="hidden" value="update_fighter" />
            <input name="fighterId" type="hidden" value={fighterId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Full name
                <input
                  className={adminInputClass}
                  defaultValue={text(name.full)}
                  name="fullName"
                />
              </label>
              <label className={adminLabelClass}>
                Nickname
                <input
                  className={adminInputClass}
                  defaultValue={text(name.nickname)}
                  name="nickname"
                />
              </label>
              <label className={adminLabelClass}>
                Status
                <select
                  className={adminInputClass}
                  defaultValue={String(fighter.status ?? "unknown")}
                  name="status"
                >
                  {["active", "inactive", "unknown"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className={adminLabelClass}>
                Country code
                <input
                  className={adminInputClass}
                  defaultValue={String(fighter.countryCode ?? "")}
                  maxLength={2}
                  name="countryCode"
                />
              </label>
              <label className={adminLabelClass}>
                Birth date
                <input
                  className={adminInputClass}
                  defaultValue={String(fighter.birthDate ?? "")}
                  name="birthDate"
                  type="date"
                />
              </label>
              <label className={adminLabelClass}>
                Stance
                <select
                  className={adminInputClass}
                  defaultValue={String(fighter.stance ?? "unknown")}
                  name="stance"
                >
                  {["orthodox", "southpaw", "switch", "open", "unknown"].map(
                    (stance) => (
                      <option key={stance}>{stance}</option>
                    ),
                  )}
                </select>
              </label>
              <label className={adminLabelClass}>
                Height cm
                <input
                  className={adminInputClass}
                  defaultValue={String(fighter.heightCm ?? "")}
                  max="250"
                  min="1"
                  name="heightCm"
                  step="0.1"
                  type="number"
                />
              </label>
              <label className={adminLabelClass}>
                Reach cm
                <input
                  className={adminInputClass}
                  defaultValue={String(fighter.reachCm ?? "")}
                  max="300"
                  min="1"
                  name="reachCm"
                  step="0.1"
                  type="number"
                />
              </label>
              <label className={adminLabelClass}>
                Weight class
                <input
                  className={adminInputClass}
                  defaultValue={String(fighter.currentWeightClass ?? "")}
                  name="currentWeightClass"
                />
              </label>
              <label className={adminLabelClass}>
                Data quality
                <select
                  className={adminInputClass}
                  defaultValue={String(fighter.dataQuality ?? "partial")}
                  name="dataQuality"
                >
                  {["verified", "complete", "partial", "blocked"].map(
                    (quality) => (
                      <option key={quality}>{quality}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <AdminSafetyFields
              confirmation={`UPDATE ${fighterId}`}
              returnTo={returnTo}
            />
          </form>
        </Card>
        <Card>
          <CardHeader
            eyebrow="Identity-safe comparison"
            title="Provider diff"
            description="Duplicate merges require a dedicated reviewed workflow; this editor never merges by name alone."
          />
          <ProviderDiffTable
            rows={providerDiff(fighter, stateSnapshot.data())}
          />
        </Card>
      </div>
      <Card className="mt-6 border-fl-danger/30">
        <CardHeader
          eyebrow="Identity operation"
          title="Merge a duplicate into this fighter"
          description="This rewrites matchup references, affected picks, provider mappings, and old slug history. A same-matchup conflict is refused."
        />
        <form action="/api/admin/actions" className="p-5" method="post">
          <input name="action" type="hidden" value="merge_fighters" />
          <input name="primaryFighterId" type="hidden" value={fighterId} />
          <label className={adminLabelClass}>
            Duplicate fighter ID
            <input
              className={adminInputClass}
              name="duplicateFighterId"
              required
            />
          </label>
          <p className="mt-4 text-xs text-fl-warning">
            Confirmation format:{" "}
            <code>MERGE duplicate-id INTO {fighterId}</code>
          </p>
          <AdminSafetyFields
            confirmation={`MERGE duplicate-id INTO ${fighterId}`}
            danger
            returnTo={returnTo}
            submitLabel="Merge duplicate"
          />
        </form>
      </Card>
    </main>
  );
}
