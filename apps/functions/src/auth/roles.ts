import type { DecodedIdToken } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";

import type { UserRole } from "@fightlobby/domain";

export function tokenRoles(token: DecodedIdToken): UserRole[] {
  const roles = Array.isArray(token.roles) ? token.roles : [];
  return roles.filter((role): role is UserRole =>
    ["member", "trusted", "moderator", "admin"].includes(String(role)),
  );
}

export function requireRole(
  token: DecodedIdToken | undefined,
  allowed: UserRole[],
): void {
  if (!token)
    throw new HttpsError("unauthenticated", "Authentication is required");
  if (!tokenRoles(token).some((role) => allowed.includes(role)))
    throw new HttpsError(
      "permission-denied",
      "This account does not have the required role",
    );
}
