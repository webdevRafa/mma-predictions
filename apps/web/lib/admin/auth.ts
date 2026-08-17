import "server-only";

import type { UserRole } from "@fightlobby/domain";
import { redirect } from "next/navigation";

import { ApiError, assertSameOrigin } from "@/lib/auth/http";
import {
  requireMutationSession,
  requireOnboardedSession,
} from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export function customClaimRoles(
  claims: Record<string, unknown> = {},
): UserRole[] {
  const arrayRoles = Array.isArray(claims.roles) ? claims.roles : [];
  const roles = arrayRoles.filter((role): role is UserRole =>
    ["member", "trusted", "moderator", "admin"].includes(String(role)),
  );
  if (claims.admin === true) roles.push("admin");
  if (claims.moderator === true) roles.push("moderator");
  return [...new Set(roles)];
}

export function hasMatchingRole(
  accountRoles: UserRole[],
  customClaims: Record<string, unknown> | undefined,
  allowed: UserRole[],
) {
  const claims = customClaimRoles(customClaims);
  return (
    accountRoles.some((role) => allowed.includes(role)) &&
    claims.some((role) => allowed.includes(role))
  );
}

export async function requireAdminPage(returnTo: string) {
  const session = await requireOnboardedSession(returnTo);
  const user = await getFirebaseAdmin().auth.getUser(session.uid);
  if (!hasMatchingRole(session.roles, user.customClaims, ["admin"]))
    redirect("/account/restricted");
  return session;
}

export async function requireAdminMutation(
  request: Request,
  allowed: UserRole[] = ["admin"],
) {
  assertSameOrigin(request);
  const session = await requireMutationSession({ bypassSiteReadOnly: true });
  const user = await getFirebaseAdmin().auth.getUser(session.uid);
  if (!hasMatchingRole(session.roles, user.customClaims, allowed))
    throw new ApiError(
      "A matching server role and Firebase custom claim are required",
      403,
      "admin_required",
    );
  return session;
}
