"use client";

import {
  BadgeCheck,
  BarChart3,
  ExternalLink,
  Eye,
  Flame,
  Mail,
  ShieldCheck,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { BlockedMemberList } from "@/features/chat/blocked-member-list";
import { FollowingList } from "@/features/profiles/following-list";
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
          Public profile settings, followed members, safety controls, and
          permanent account deletion stay separate from your public stats.
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
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: Trophy,
      label: "Points",
      value: account.stats.totalPoints.toLocaleString(),
    },
    {
      icon: BarChart3,
      label: "Graded picks",
      value: account.stats.gradedPicks.toLocaleString(),
    },
    {
      icon: Target,
      label: "Winner accuracy",
      value: `${Math.round(account.stats.winnerAccuracy * 100)}%`,
    },
    {
      icon: Flame,
      label: "Current streak",
      value: account.stats.currentStreak.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="relative overflow-hidden border-b border-fl-border p-5 sm:p-6">
          <div
            aria-hidden="true"
            className="arena-grid absolute inset-0 opacity-25"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Your public record</p>
              <h2 className="mt-2 font-display text-4xl leading-none font-extrabold sm:text-5xl">
                @{account.handle}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fl-text-muted">
                {account.displayName ? (
                  <span>{account.displayName}</span>
                ) : null}
                {account.displayName ? <span aria-hidden="true">·</span> : null}
                <span className="capitalize">
                  {account.profileVisibility} profile
                </span>
              </div>
            </div>
            <Link
              className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-fl-border bg-fl-surface-2 px-4 text-sm font-bold text-fl-text transition hover:border-fl-text-muted hover:bg-fl-surface-3"
              href={`/u/${account.handle}`}
              rel="noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" size={16} /> Open full profile
              <ExternalLink aria-hidden="true" size={14} />
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-fl-border lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div className="bg-fl-surface-1 p-4 sm:p-5" key={label}>
              <Icon aria-hidden="true" className="text-fl-accent" size={17} />
              <p className="mt-3 font-display text-3xl font-extrabold">
                {value}
              </p>
              <p className="mt-1 text-xs text-fl-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </Card>
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
    </div>
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
        eyebrow="Local display"
        title="Time zone"
        description="Event times are automatically shown in your device time zone. Save a fallback for devices that cannot report one."
      />
      <div className="p-5 sm:p-6">
        <PreferenceForm
          onSaved={onSaved}
          values={{ timezone: preferences.timezone }}
        >
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
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Private account area</p>
          <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-6xl">
            SETTINGS
          </h1>
          <p className="mt-3 text-sm text-fl-text-muted">
            Signed in as @{account.handle}
          </p>
        </div>
        <Link
          className="focus-ring inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-[10px] border border-fl-border bg-fl-surface-1 px-4 text-sm font-bold text-fl-text transition hover:border-fl-accent hover:bg-fl-surface-2"
          href={`/u/${account.handle}`}
          rel="noreferrer"
          target="_blank"
        >
          <Eye aria-hidden="true" size={16} /> View public profile
          <ExternalLink aria-hidden="true" size={14} />
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
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
          {section === "privacy" ? (
            <PrivacyPanel account={account} onSaved={updatePreferences} />
          ) : null}
          {section === "following" ? (
            <Card>
              <CardHeader
                eyebrow="Member network"
                title="Following"
                description="Keep a short list of FightLobby members whose public prediction records you want to revisit."
              />
              <FollowingList />
            </Card>
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
