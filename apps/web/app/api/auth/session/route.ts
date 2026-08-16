import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { safeReturnPath } from "@/lib/auth/return-path";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getOptionalSession,
} from "@/lib/auth/session";
import { ensureUserRecords } from "@/lib/auth/user-records";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const sessionSchema = z.object({
  idToken: z.string().min(100).max(20_000),
  returnTo: z.string().max(2_000).optional(),
});

export async function GET() {
  const session = await getOptionalSession();
  return Response.json({ authenticated: Boolean(session), session });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, sessionSchema);
    const { auth } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(input.idToken, true);
    const account = await ensureUserRecords(decoded.uid);
    const sessionCookie = await auth.createSessionCookie(input.idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });
    const response = Response.json({
      authenticated: true,
      onboardingRequired: !account.onboardingComplete,
      accountStatus: account.accountStatus,
      returnTo: safeReturnPath(input.returnTo),
    });
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=${sessionCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}; Priority=High${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const response = Response.json({ authenticated: false });
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
