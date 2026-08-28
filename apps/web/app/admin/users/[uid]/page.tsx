import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AdminNotice,
  AdminSafetyFields,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin user",
  robots: { index: false, follow: false },
};

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ adminSuccess?: string; adminError?: string }>;
}) {
  await requireAdminPage("/admin/users");
  const { uid } = await params;
  const { auth, firestore } = getFirebaseAdmin();
  const [user, profile, authUser, sanctions] = await Promise.all([
    firestore.collection("users").doc(uid).get(),
    firestore.collection("profiles").doc(uid).get(),
    auth.getUser(uid).catch(() => null),
    firestore
      .collection("userSanctions")
      .where("targetUid", "==", uid)
      .limit(50)
      .get(),
  ]);
  if (!user.exists || !authUser) notFound();
  const roles: unknown = user.get("roles");
  const roleList = Array.isArray(roles) ? roles.map(String) : ["member"];
  const query = await searchParams;
  const returnTo = `/admin/users/${uid}`;
  return (
    <main id="main-content">
      <AdminNotice
        error={query.adminError}
        success={
          query.adminSuccess ? "User action completed and audited." : undefined
        }
      />
      <p className="eyebrow">User administration</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-7xl">
        @{String(profile.get("handle") ?? uid)}
      </h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{String(user.get("accountStatus") ?? "unknown")}</Badge>
        {roleList.map((role) => (
          <Badge key={role} tone={role === "admin" ? "warning" : "neutral"}>
            {role}
          </Badge>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Custom claims + private record"
            title="Roles"
            description="Both sources are updated; admin authorization requires them to agree."
          />
          <form action="/api/admin/actions" className="p-5" method="post">
            <input name="action" type="hidden" value="set_user_roles" />
            <input name="targetUid" type="hidden" value={uid} />
            <div className="grid grid-cols-2 gap-3">
              {["member", "trusted", "moderator", "admin"].map((role) => (
                <label
                  className="flex items-center gap-2 rounded-lg border border-fl-border p-3 text-sm"
                  key={role}
                >
                  <input
                    defaultChecked={roleList.includes(role)}
                    name="roles"
                    type="checkbox"
                    value={role}
                  />{" "}
                  {role}
                </label>
              ))}
            </div>
            <AdminSafetyFields
              confirmation={`ROLES ${uid}`}
              danger
              returnTo={returnTo}
              submitLabel="Update roles"
            />
          </form>
        </Card>
        <Card>
          <CardHeader eyebrow="Enforcement" title="Sanction or restore" />
          <form action="/api/admin/actions" className="p-5" method="post">
            <input name="action" type="hidden" value="sanction_user" />
            <input name="targetUid" type="hidden" value={uid} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Action
                <select className={adminInputClass} name="sanction">
                  <option value="ban">Ban</option>
                  <option value="mute">Mute</option>
                  <option value="suspend">Suspend</option>
                  <option value="unban">Unban / revoke all</option>
                </select>
              </label>
              <label className={adminLabelClass}>
                Duration minutes
                <input
                  className={adminInputClass}
                  max="43200"
                  min="5"
                  name="durationMinutes"
                  placeholder="Required for mute/suspend"
                  type="number"
                />
              </label>
            </div>
            <p className="mt-4 text-xs text-fl-warning">
              The default is <code>BAN {uid}</code>. If you select another
              action, replace BAN with MUTE, SUSPEND, or UNBAN.
            </p>
            <AdminSafetyFields
              confirmation={`BAN ${uid}`}
              danger
              returnTo={returnTo}
              submitLabel="Apply sanction"
            />
          </form>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader
          eyebrow={`${sanctions.size} records`}
          title="Sanction history"
        />
        <div className="divide-y divide-fl-border">
          {sanctions.docs.map((document) => (
            <div
              className="flex items-center justify-between gap-4 px-5 py-4"
              key={document.id}
            >
              <div>
                <p className="font-bold">{String(document.get("type"))}</p>
                <p className="mt-1 text-xs text-fl-text-muted">
                  {String(document.get("reason") ?? "No reason")}
                </p>
              </div>
              <Badge>{String(document.get("status"))}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
