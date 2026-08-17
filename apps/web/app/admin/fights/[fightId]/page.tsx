import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AdminNotice,
  AdminSafetyFields,
  ProviderDiffTable,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { providerDiff } from "@/lib/admin/diff";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit fight",
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

function numericText(value: unknown, fallback = "") {
  return typeof value === "number" ? String(value) : fallback;
}

export default async function AdminFightPage({
  params,
  searchParams,
}: {
  params: Promise<{ fightId: string }>;
  searchParams: Promise<{ adminSuccess?: string; adminError?: string }>;
}) {
  await requireAdminPage("/admin/fights");
  const { fightId } = await params;
  const firestore = getFirebaseAdmin().firestore;
  const [fightSnapshot, stateSnapshot] = await Promise.all([
    firestore.collection("fights").doc(fightId).get(),
    firestore.collection("providerEntityState").doc(`fight_${fightId}`).get(),
  ]);
  if (!fightSnapshot.exists) notFound();
  const fight = fightSnapshot.data()!;
  const fighterA = record(fight.fighterA);
  const fighterB = record(fight.fighterB);
  const fighterAName = text(record(fighterA.name).full, "Fighter A");
  const fighterBName = text(record(fighterB.name).full, "Fighter B");
  const result = record(fight.result);
  const editorial = record(fight.editorial);
  const query = await searchParams;
  const returnTo = `/admin/fights/${fightId}`;
  return (
    <main id="main-content">
      <AdminNotice
        error={query.adminError}
        success={
          query.adminSuccess ? "Audited fight action accepted." : undefined
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Fight editor</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold sm:text-6xl">
            {fighterAName} VS {fighterBName}
          </h1>
          <p className="mt-2 font-mono text-xs text-fl-text-dim">{fightId}</p>
        </div>
        <div className="flex gap-2">
          <Badge>{String(fight.status)}</Badge>
          <Badge tone="info">Picks {String(fight.predictionStatus)}</Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Persistent override" title="Fight fields" />
          <form action="/api/admin/actions" className="p-5" method="post">
            <input name="action" type="hidden" value="update_fight" />
            <input name="fightId" type="hidden" value={fightId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Status
                <select
                  className={adminInputClass}
                  defaultValue={String(fight.status)}
                  name="status"
                >
                  {[
                    "scheduled",
                    "prefight",
                    "walkouts",
                    "intros",
                    "in_progress",
                    "end_of_round",
                    "completed",
                    "canceled",
                    "postponed",
                  ].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className={adminLabelClass}>
                Card segment
                <select
                  className={adminInputClass}
                  defaultValue={String(fight.cardSegment)}
                  name="cardSegment"
                >
                  {["early_prelims", "prelims", "main_card"].map((segment) => (
                    <option key={segment}>{segment}</option>
                  ))}
                </select>
              </label>
              <label className={adminLabelClass}>
                Weight class
                <input
                  className={adminInputClass}
                  defaultValue={String(fight.weightClass ?? "")}
                  name="weightClass"
                />
              </label>
              <label className={adminLabelClass}>
                Scheduled rounds
                <select
                  className={adminInputClass}
                  defaultValue={String(fight.scheduledRounds ?? 3)}
                  name="scheduledRounds"
                >
                  <option value="3">3</option>
                  <option value="5">5</option>
                </select>
              </label>
              <label className={adminLabelClass}>
                Title fight
                <select
                  className={adminInputClass}
                  defaultValue={String(fight.isTitleFight === true)}
                  name="isTitleFight"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <label className={adminLabelClass}>
                Monetization
                <select
                  className={adminInputClass}
                  defaultValue={String(fight.monetizationEligible === true)}
                  name="monetizationEligible"
                >
                  <option value="false">Disabled</option>
                  <option value="true">Eligible</option>
                </select>
              </label>
              <label className={adminLabelClass}>
                Data quality
                <select
                  className={adminInputClass}
                  defaultValue={String(fight.dataQuality ?? "partial")}
                  name="dataQuality"
                >
                  {["verified", "complete", "partial", "blocked"].map(
                    (quality) => (
                      <option key={quality}>{quality}</option>
                    ),
                  )}
                </select>
              </label>
              <label className={adminLabelClass}>
                Editorial status
                <select
                  className={adminInputClass}
                  defaultValue={text(editorial.status, "missing")}
                  name="editorialStatus"
                >
                  {["missing", "draft", "reviewed", "published"].map(
                    (status) => (
                      <option key={status}>{status}</option>
                    ),
                  )}
                </select>
              </label>
              <label className={`${adminLabelClass} sm:col-span-2`}>
                Biggest question
                <textarea
                  className={adminInputClass}
                  defaultValue={text(editorial.biggestQuestion)}
                  maxLength={300}
                  minLength={20}
                  name="biggestQuestion"
                  rows={3}
                />
              </label>
              <label className={`${adminLabelClass} sm:col-span-2`}>
                Style contrast
                <textarea
                  className={adminInputClass}
                  defaultValue={text(editorial.styleContrast)}
                  maxLength={500}
                  minLength={20}
                  name="styleContrast"
                  rows={4}
                />
              </label>
              <label className={adminLabelClass}>
                Keys for {fighterAName} (one per line)
                <textarea
                  className={adminInputClass}
                  defaultValue={
                    Array.isArray(editorial.keysForFighterA)
                      ? editorial.keysForFighterA.join("\n")
                      : ""
                  }
                  name="keysForFighterA"
                  rows={5}
                />
              </label>
              <label className={adminLabelClass}>
                Keys for {fighterBName} (one per line)
                <textarea
                  className={adminInputClass}
                  defaultValue={
                    Array.isArray(editorial.keysForFighterB)
                      ? editorial.keysForFighterB.join("\n")
                      : ""
                  }
                  name="keysForFighterB"
                  rows={5}
                />
              </label>
              <label className={`${adminLabelClass} sm:col-span-2`}>
                Fight Lobby take
                <textarea
                  className={adminInputClass}
                  defaultValue={text(editorial.fightLobbyTake)}
                  maxLength={800}
                  minLength={30}
                  name="fightLobbyTake"
                  rows={5}
                />
              </label>
            </div>
            <AdminSafetyFields
              confirmation={`UPDATE ${fightId}`}
              returnTo={returnTo}
            />
          </form>
        </Card>

        <Card>
          <CardHeader eyebrow="Source comparison" title="Provider diff" />
          <ProviderDiffTable rows={providerDiff(fight, stateSnapshot.data())} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Emergency control"
            title="Prediction lock"
            description="Routine locks are available from the event control board. Emergency reopening always requires a reason and typed confirmation. Existing user picks remain immutable."
          />
          <div className="grid gap-px bg-fl-border sm:grid-cols-2">
            {(["lock", "reopen"] as const).map((operation) => (
              <form
                action="/api/admin/actions"
                className="bg-fl-surface-1 p-5"
                key={operation}
                method="post"
              >
                <input name="action" type="hidden" value="prediction_control" />
                <input name="fightId" type="hidden" value={fightId} />
                <input name="operation" type="hidden" value={operation} />
                <p className="text-sm font-bold capitalize">
                  {operation} predictions
                </p>
                <AdminSafetyFields
                  confirmation={`${operation.toUpperCase()} ${fightId}`}
                  danger={operation === "reopen"}
                  returnTo={returnTo}
                  submitLabel={`${operation} now`}
                />
              </form>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Official result"
            title="Correct and regrade"
            description={`Current result version: ${numericText(result.resultVersion, "0")}. Saving creates an idempotent background regrade job.`}
          />
          <form action="/api/admin/actions" className="p-5" method="post">
            <input name="action" type="hidden" value="correct_result" />
            <input name="fightId" type="hidden" value={fightId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Winner
                <select
                  className={adminInputClass}
                  defaultValue={text(result.winnerFighterId)}
                  name="winnerFighterId"
                >
                  <option value="">No winner</option>
                  <option value={String(fight.fighterAId)}>
                    {fighterAName}
                  </option>
                  <option value={String(fight.fighterBId)}>
                    {fighterBName}
                  </option>
                </select>
              </label>
              <label className={adminLabelClass}>
                Method
                <select
                  className={adminInputClass}
                  defaultValue={text(result.method, "other")}
                  name="method"
                >
                  {[
                    "ko_tko",
                    "submission",
                    "decision_unanimous",
                    "decision_split",
                    "decision_majority",
                    "dq",
                    "draw",
                    "no_contest",
                    "overturned",
                    "other",
                  ].map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </label>
              <label className={adminLabelClass}>
                Method detail
                <input
                  className={adminInputClass}
                  defaultValue={text(result.methodDetail)}
                  name="methodDetail"
                />
              </label>
              <label className={adminLabelClass}>
                Round
                <input
                  className={adminInputClass}
                  defaultValue={numericText(result.round)}
                  max="5"
                  min="1"
                  name="round"
                  type="number"
                />
              </label>
              <label className={adminLabelClass}>
                Time in round (seconds)
                <input
                  className={adminInputClass}
                  defaultValue={numericText(result.timeInRoundSeconds)}
                  max="300"
                  min="0"
                  name="timeInRoundSeconds"
                  type="number"
                />
              </label>
              <label className={adminLabelClass}>
                Official
                <select
                  className={adminInputClass}
                  defaultValue={String(result.official !== false)}
                  name="official"
                >
                  <option value="true">Official</option>
                  <option value="false">Provisional</option>
                </select>
              </label>
            </div>
            <AdminSafetyFields
              confirmation={`RESULT ${fightId}`}
              danger
              returnTo={returnTo}
              submitLabel="Save result and regrade"
            />
          </form>
        </Card>
      </div>
    </main>
  );
}
