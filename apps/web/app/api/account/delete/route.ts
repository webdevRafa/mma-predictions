import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { permanentlyDeleteAccount } from "@/lib/auth/delete-account";
import {
  requireMutationSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const deleteSchema = z.object({ confirmation: z.literal("DELETE") });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireMutationSession();
    await parseJson(request, deleteSchema);
    await permanentlyDeleteAccount(getFirebaseAdmin(), session.uid);
    const response = Response.json({ deleted: true });
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
