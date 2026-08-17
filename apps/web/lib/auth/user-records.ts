import "server-only";

import {
  accountStatusSchema,
  publicProfileStatsSchema,
  userRoleSchema,
  type AccountStatus,
  type PublicProfileStats,
  type UserRole,
} from "@fightlobby/domain";
import { FieldValue } from "firebase-admin/firestore";

import type { PrivateAccountView } from "@/lib/auth/private-account-view";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const emptyPublicProfileStats: PublicProfileStats = {
  gradedPicks: 0,
  correctWinners: 0,
  winnerAccuracy: 0,
  totalPoints: 0,
  exactPicks: 0,
  currentStreak: 0,
  longestStreak: 0,
  eventChampionships: 0,
};

export interface AccountRecordSummary {
  accountStatus: AccountStatus;
  roles: UserRole[];
  onboardingComplete: boolean;
  handle?: string;
}

export async function ensureUserRecords(
  uid: string,
): Promise<AccountRecordSummary> {
  const { firestore } = getFirebaseAdmin();
  const userRef = firestore.collection("users").doc(uid);
  const profileRef = firestore.collection("profiles").doc(uid);

  await firestore.runTransaction(async (transaction) => {
    const [user, profile] = await Promise.all([
      transaction.get(userRef),
      transaction.get(profileRef),
    ]);
    if (!user.exists) {
      transaction.create(userRef, {
        uid,
        accountStatus: "active",
        roles: ["member"],
        termsVersion: "pending",
        onboardingComplete: false,
        preferences: {
          hideUpcomingPicks: true,
          emailEventReminders: false,
          emailResults: false,
        },
        moderation: { trustLevel: 0 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (!profile.exists) {
      transaction.create(profileRef, {
        uid,
        handleHistory: [],
        joinedAt: FieldValue.serverTimestamp(),
        stats: {
          gradedPicks: 0,
          correctWinners: 0,
          winnerAccuracy: 0,
          totalPoints: 0,
          exactPicks: 0,
          currentStreak: 0,
          longestStreak: 0,
          eventChampionships: 0,
        },
        badges: [],
        profileVisibility: "limited",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return getAccountRecordSummary(uid);
}

export async function getAccountRecordSummary(
  uid: string,
): Promise<AccountRecordSummary> {
  const { firestore } = getFirebaseAdmin();
  const [user, profile] = await Promise.all([
    firestore.collection("users").doc(uid).get(),
    firestore.collection("profiles").doc(uid).get(),
  ]);
  const accountStatus = accountStatusSchema.safeParse(
    user.get("accountStatus"),
  );
  const roles: unknown = user.get("roles");
  const parsedRoles = Array.isArray(roles)
    ? roles.flatMap((role) => {
        const parsed = userRoleSchema.safeParse(role);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const handle: unknown = profile.get("handle");
  return {
    accountStatus: accountStatus.success ? accountStatus.data : "suspended",
    roles: parsedRoles.length > 0 ? parsedRoles : ["member"],
    onboardingComplete:
      user.get("onboardingComplete") === true && typeof handle === "string",
    ...(typeof handle === "string" ? { handle } : {}),
  };
}

export async function getPrivateAccountView(
  uid: string,
): Promise<PrivateAccountView> {
  const { auth, firestore } = getFirebaseAdmin();
  const [authUser, user, profile] = await Promise.all([
    auth.getUser(uid),
    firestore.collection("users").doc(uid).get(),
    firestore.collection("profiles").doc(uid).get(),
  ]);
  const preferences: unknown = user.get("preferences");
  const preferenceRecord =
    preferences && typeof preferences === "object"
      ? (preferences as Record<string, unknown>)
      : {};
  const accountStatus: unknown = user.get("accountStatus");
  const handle: unknown = profile.get("handle");
  const displayName: unknown = profile.get("displayName");
  const profileVisibility: unknown = profile.get("profileVisibility");
  const stats = publicProfileStatsSchema.safeParse(profile.get("stats"));
  return {
    email: authUser.email ?? "No email available",
    emailVerified: authUser.emailVerified,
    handle: typeof handle === "string" ? handle : "",
    displayName: typeof displayName === "string" ? displayName : "",
    profileVisibility:
      profileVisibility === "public"
        ? ("public" as const)
        : ("limited" as const),
    accountStatus:
      typeof accountStatus === "string" ? accountStatus : "suspended",
    stats: stats.success ? stats.data : emptyPublicProfileStats,
    preferences: {
      timezone:
        typeof preferenceRecord.timezone === "string"
          ? preferenceRecord.timezone
          : "America/Chicago",
      hideUpcomingPicks: preferenceRecord.hideUpcomingPicks !== false,
      emailEventReminders: preferenceRecord.emailEventReminders === true,
      emailResults: preferenceRecord.emailResults === true,
    },
  };
}
