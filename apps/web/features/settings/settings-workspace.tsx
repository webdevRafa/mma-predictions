"use client";

import { BadgeCheck, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { BlockedMemberList } from "@/features/chat/blocked-member-list";
import { PreferenceForm } from "@/features/settings/preference-form";
import { ProfileSettingsForm } from "@/features/settings/profile-settings-form";
import {
  settingsSectionForPath,
  settingsSections,
} from "@/features/settings/settings-sections";
import type { PrivateAccountView } from "@/lib/auth/private-account-view";

interface BlockedMember {
  uid: string;
  handle?: string;
}

function AccountPanel({ account }: { account: PrivateAccountView }) {
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

function ProfilePanel({
  account,
  onSaved,
}: {
  account: PrivateAccountView;
  onSaved: (update: {
    handle: string;
    displayName: string;
    profileVisibility: "public" | "limited";
  }) => void;
}) {
  return (
    <Card>
      <CardHeader
        eyebrow="Public identity"
        title="Profile settings"
        description="Only the fields below can appear publicly. Email and provider IDs are never included."
      />
      <div className="p-5 sm:p-6">
        <ProfileSettingsForm
          displayName={account.displayName}
          handle={account.handle}
          onSaved={onSaved}
          profileVisibility={account.profileVisibility}
        />
      </div>
    </Card>
  );
}

function NotificationsPanel({
  account,
  onSaved,
}: {
  account: PrivateAccountView;
  onSaved: (update: Record<string, string | boolean>) => void;
}) {
  const { preferences } = account;
  return (
    <Card>
      <CardHeader
        eyebrow="Private preferences"
        title="Notifications"
        description="Delivery arrives in a later engagement pass; these choices establish your consent now."
      />
      <div className="p-5 sm:p-6">
        <PreferenceForm
          onSaved={onSaved}
          values={{
            emailEventReminders: preferences.emailEventReminders,
            emailResults: preferences.emailResults,
          }}
        >
          {[
            [
              "emailEventReminders",
              "Event reminders",
              "A reminder before followed UFC cards begin.",
              preferences.emailEventReminders,
            ],
            [
              "emailResults",
              "Prediction results",
              "A summary after your picks are officially graded.",
              preferences.emailResults,
            ],
          ].map(([name, title, copy, checked]) => (
            <label
              className="flex items-start justify-between gap-5 rounded-xl border border-fl-border bg-fl-surface-2 p-4"
              key={String(name)}
            >
              <span>
                <span className="block text-sm font-semibold">
                  {String(title)}
                </span>
                <span className="mt-1 block text-xs leading-5 text-fl-text-muted">
                  {String(copy)}
                </span>
              </span>
              <input
                className="mt-1 accent-fl-accent"
                defaultChecked={Boolean(checked)}
                name={String(name)}
                type="checkbox"
              />
            </label>
          ))}
        </PreferenceForm>
      </div>
    </Card>
  );
}

function PrivacyPanel({
  account,
  onSaved,
}: {
  account: PrivateAccountView;
  onSaved: (update: Record<string, string | boolean>) => void;
}) {
  const { preferences } = account;
  return (
    <Card>
      <CardHeader
        eyebrow="Pick privacy"
        title="Upcoming predictions"
        description="Locked picks can be public for transparency. Open picks stay private by default."
      />
      <div className="p-5 sm:p-6">
        <PreferenceForm
          onSaved={onSaved}
          values={{
            hideUpcomingPicks: preferences.hideUpcomingPicks,
            timezone: preferences.timezone,
          }}
        >
          <label className="flex items-start justify-between gap-5 rounded-xl border border-fl-border bg-fl-surface-2 p-4">
            <span>
              <span className="block text-sm font-semibold">
                Hide upcoming picks
              </span>
              <span className="mt-1 block text-xs leading-5 text-fl-text-muted">
                Do not publish future picks unless you explicitly share one.
              </span>
            </span>
            <input
              className="mt-1 accent-fl-accent"
              defaultChecked={preferences.hideUpcomingPicks}
              name="hideUpcomingPicks"
              type="checkbox"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
              Time zone
            </span>
            <input
              className="focus-ring min-h-12 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm"
              defaultValue={preferences.timezone}
              name="timezone"
            />
          </label>
        </PreferenceForm>
      </div>
    </Card>
  );
}

export function SettingsWorkspace({
  initialAccount,
  initialBlockedMembers,
}: {
  initialAccount: PrivateAccountView;
  initialBlockedMembers: BlockedMember[];
}) {
  const pathname = usePathname();
  const section = settingsSectionForPath(pathname);
  const [account, setAccount] = useState(initialAccount);
  const [blockedMembers, setBlockedMembers] = useState(initialBlockedMembers);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    window.history.pushState(null, "", href);
  }

  function updatePreferences(update: Record<string, string | boolean>) {
    setAccount((current) => ({
      ...current,
      preferences: { ...current.preferences, ...update },
    }));
  }

  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <header>
        <p className="eyebrow">Private account area</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-6xl">
          SETTINGS
        </h1>
        <p className="mt-3 text-sm text-fl-text-muted">
          Signed in as @{account.handle}
        </p>
      </header>
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings"
          className="flex gap-2 overflow-x-auto lg:flex-col"
        >
          {settingsSections.map(({ href, id, label }) => {
            const active = id === section;
            return (
              <a
                aria-current={active ? "page" : undefined}
                className={`focus-ring shrink-0 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "border-fl-accent bg-fl-accent/10 text-fl-text"
                    : "border-fl-border bg-fl-surface-1 text-fl-text-muted hover:border-fl-accent hover:text-fl-text"
                }`}
                href={href}
                key={href}
                onClick={(event) => navigate(event, href)}
              >
                {label}
              </a>
            );
          })}
        </nav>
        <div
          aria-live="polite"
          className="min-w-0"
          id={`settings-panel-${section}`}
        >
          {section === "account" ? <AccountPanel account={account} /> : null}
          {section === "profile" ? (
            <ProfilePanel
              account={account}
              onSaved={(update) =>
                setAccount((current) => ({ ...current, ...update }))
              }
            />
          ) : null}
          {section === "notifications" ? (
            <NotificationsPanel account={account} onSaved={updatePreferences} />
          ) : null}
          {section === "privacy" ? (
            <PrivacyPanel account={account} onSaved={updatePreferences} />
          ) : null}
          {section === "blocked-users" ? (
            <Card>
              <CardHeader eyebrow="Community controls" title="Blocked users" />
              <BlockedMemberList
                initialMembers={blockedMembers}
                onUnblocked={(uid) =>
                  setBlockedMembers((current) =>
                    current.filter((member) => member.uid !== uid),
                  )
                }
              />
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
