import { BadgeCheck, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/card";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getPrivateAccountView } from "@/lib/auth/user-records";

export default async function SettingsPage() {
  const session = await requireOnboardedSession("/settings");
  const account = await getPrivateAccountView(session.uid);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          eyebrow="Account"
          title="Your FightLobby identity"
          description="This information is private unless a field is explicitly labeled public."
        />
        <div className="grid gap-px bg-fl-border sm:grid-cols-2">
          <div className="bg-fl-surface-1 p-5">
            <p className="eyebrow inline-flex items-center gap-2">
              <Mail aria-hidden="true" size={13} /> Private email
            </p>
            <p className="mt-2 text-sm font-semibold">{account.email}</p>
            <p className="mt-1 text-xs text-fl-text-dim">
              Never shown on your public profile.
            </p>
          </div>
          <div className="bg-fl-surface-1 p-5">
            <p className="eyebrow inline-flex items-center gap-2">
              <BadgeCheck aria-hidden="true" size={13} /> Verification
            </p>
            <p className="mt-2 text-sm font-semibold">
              {account.emailVerified
                ? "Email verified"
                : "Verification pending"}
            </p>
          </div>
          <div className="bg-fl-surface-1 p-5">
            <p className="eyebrow inline-flex items-center gap-2">
              <ShieldCheck aria-hidden="true" size={13} /> Account status
            </p>
            <p className="mt-2 text-sm font-semibold capitalize">
              {account.accountStatus}
            </p>
          </div>
          <div className="bg-fl-surface-1 p-5">
            <p className="eyebrow">Public handle</p>
            <Link
              className="focus-ring mt-2 inline-flex items-center gap-2 rounded-md text-sm font-bold text-fl-accent"
              href={`/u/${account.handle}`}
            >
              @{account.handle} <ExternalLink aria-hidden="true" size={14} />
            </Link>
          </div>
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-2xl font-bold">Account controls</h2>
        <p className="mt-2 text-sm leading-6 text-fl-text-muted">
          Profile visibility, reminders, follows, and account deletion stay
          separate from public stats.
        </p>
        <Link
          className="focus-ring mt-5 inline-block rounded-md text-sm font-bold text-fl-danger"
          href="/account/delete"
        >
          Delete account
        </Link>
      </Card>
    </div>
  );
}
