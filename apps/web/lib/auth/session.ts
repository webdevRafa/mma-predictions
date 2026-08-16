import "server-only";

import type { AccountStatus, UserRole } from "@fightlobby/domain";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/auth/http";
import { assertMutationAllowed } from "@/lib/auth/policy";
import { safeReturnPath } from "@/lib/auth/return-path";
import { getAccountRecordSummary } from "@/lib/auth/user-records";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME = "fightlobby_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export interface SessionUser {
  uid: string;
  emailVerified: boolean;
  roles: UserRole[];
  accountStatus: AccountStatus;
  onboardingComplete: boolean;
  handle?: string;
}

export async function getOptionalSession(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const decoded = await getFirebaseAdmin().auth.verifySessionCookie(
      cookie,
      true,
    );
    const account = await getAccountRecordSummary(decoded.uid);
    return {
      uid: decoded.uid,
      emailVerified: decoded.email_verified === true,
      ...account,
    };
  } catch {
    return null;
  }
}

export async function requireSession(returnTo: string) {
  const session = await getOptionalSession();
  if (!session)
    redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
  return session;
}

export async function requireOnboardedSession(returnTo: string) {
  const session = await requireSession(returnTo);
  if (!session.onboardingComplete)
    redirect(
      `/onboarding?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`,
    );
  if (["banned", "deleted"].includes(session.accountStatus))
    redirect("/account/restricted");
  return session;
}

export async function requireMutationSession(
  options: { bypassSiteReadOnly?: boolean } = {},
) {
  const session = await getOptionalSession();
  if (!session)
    throw new ApiError("Authentication is required", 401, "unauthenticated");
  assertMutationAllowed(session.accountStatus);
  if (!options.bypassSiteReadOnly) {
    const flags = await getFirebaseAdmin()
      .firestore.collection("featureFlags")
      .doc("current")
      .get();
    if (flags.get("siteReadOnly") === true)
      throw new ApiError(
        "FightLobby is temporarily read-only",
        503,
        "site_read_only",
      );
  }
  return session;
}
