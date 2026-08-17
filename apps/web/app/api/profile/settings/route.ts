import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const settingsSchema = z
  .object({
    displayName: z.string().trim().min(2).max(50).nullable().optional(),
    profileVisibility: z.enum(["public", "limited"]).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    hideUpcomingPicks: z.boolean().optional(),
    emailEventReminders: z.boolean().optional(),
    emailResults: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "No settings were provided",
  );

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, settingsSchema);
    const { firestore } = getFirebaseAdmin();
    const batch = firestore.batch();
    const profileUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (input.displayName !== undefined) {
      profileUpdate.displayName =
        input.displayName === null ? FieldValue.delete() : input.displayName;
    }
    if (input.profileVisibility !== undefined) {
      profileUpdate.profileVisibility = input.profileVisibility;
    }
    if (Object.keys(profileUpdate).length > 1) {
      batch.set(
        firestore.collection("profiles").doc(session.uid),
        profileUpdate,
        { merge: true },
      );
    }
    const preferences = {
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.hideUpcomingPicks !== undefined
        ? { hideUpcomingPicks: input.hideUpcomingPicks }
        : {}),
      ...(input.emailEventReminders !== undefined
        ? { emailEventReminders: input.emailEventReminders }
        : {}),
      ...(input.emailResults !== undefined
        ? { emailResults: input.emailResults }
        : {}),
    };
    if (Object.keys(preferences).length > 0) {
      batch.set(
        firestore.collection("users").doc(session.uid),
        { preferences, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    await batch.commit();
    return Response.json({ updated: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
