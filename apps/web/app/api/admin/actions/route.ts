import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { adminActionSchema, executeAdminAction } from "@/lib/admin/actions";
import { requireAdminMutation } from "@/lib/admin/auth";
import { ApiError, apiErrorResponse } from "@/lib/auth/http";

function value(form: FormData, key: string) {
  const result = form.get(key);
  return typeof result === "string" ? result.trim() : "";
}

function optional(form: FormData, key: string) {
  const result = value(form, key);
  return result ? result : undefined;
}

function optionalNumber(form: FormData, key: string) {
  const result = optional(form, key);
  if (result === undefined) return undefined;
  const number = Number(result);
  return Number.isFinite(number) ? number : result;
}

function booleanValue(form: FormData, key: string) {
  return value(form, key) === "true";
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function common(form: FormData) {
  return {
    reason: value(form, "reason"),
    confirmation: value(form, "confirmation"),
    ...(optional(form, "returnTo")
      ? { returnTo: optional(form, "returnTo") }
      : {}),
  };
}

function parseForm(form: FormData): unknown {
  const action = value(form, "action");
  switch (action) {
    case "update_event":
      return {
        action,
        eventId: value(form, "eventId"),
        patch: compact({
          name: optional(form, "name"),
          shortName: optional(form, "shortName"),
          status: optional(form, "status"),
          startsAt: optional(form, "startsAt"),
          venueTimezone: optional(form, "venueTimezone"),
          monetizationEligible: optional(form, "monetizationEligible")
            ? booleanValue(form, "monetizationEligible")
            : undefined,
          dataQuality: optional(form, "dataQuality"),
          editorialSummary: optional(form, "editorialSummary"),
          editorialStatus: optional(form, "editorialStatus"),
        }),
        ...common(form),
      };
    case "update_fight":
      return {
        action,
        fightId: value(form, "fightId"),
        patch: compact({
          status: optional(form, "status"),
          cardSegment: optional(form, "cardSegment"),
          weightClass: optional(form, "weightClass"),
          isTitleFight: optional(form, "isTitleFight")
            ? booleanValue(form, "isTitleFight")
            : undefined,
          scheduledRounds: optionalNumber(form, "scheduledRounds"),
          monetizationEligible: optional(form, "monetizationEligible")
            ? booleanValue(form, "monetizationEligible")
            : undefined,
          dataQuality: optional(form, "dataQuality"),
          biggestQuestion: optional(form, "biggestQuestion"),
          styleContrast: optional(form, "styleContrast"),
          keysForFighterA: optional(form, "keysForFighterA")
            ?.split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          keysForFighterB: optional(form, "keysForFighterB")
            ?.split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          fightLobbyTake: optional(form, "fightLobbyTake"),
          editorialStatus: optional(form, "editorialStatus"),
        }),
        ...common(form),
      };
    case "update_fighter":
      return {
        action,
        fighterId: value(form, "fighterId"),
        patch: compact({
          fullName: optional(form, "fullName"),
          nickname:
            form.has("nickname") && typeof form.get("nickname") === "string"
              ? value(form, "nickname")
              : undefined,
          status: optional(form, "status"),
          countryCode: optional(form, "countryCode")?.toUpperCase(),
          birthDate: optional(form, "birthDate"),
          stance: optional(form, "stance"),
          heightCm: optionalNumber(form, "heightCm"),
          reachCm: optionalNumber(form, "reachCm"),
          currentWeightClass: optional(form, "currentWeightClass"),
          dataQuality: optional(form, "dataQuality"),
        }),
        ...common(form),
      };
    case "reorder_card":
      return {
        action,
        eventId: value(form, "eventId"),
        fightIds: value(form, "fightIds")
          .split(/[\s,]+/)
          .filter(Boolean),
        ...common(form),
      };
    case "prediction_control":
      return {
        action,
        fightId: value(form, "fightId"),
        operation: value(form, "operation"),
        ...common(form),
      };
    case "correct_result":
      return {
        action,
        fightId: value(form, "fightId"),
        result: compact({
          winnerFighterId: optional(form, "winnerFighterId"),
          method: value(form, "method"),
          methodDetail: optional(form, "methodDetail"),
          round: optionalNumber(form, "round"),
          timeInRoundSeconds: optionalNumber(form, "timeInRoundSeconds"),
          official: booleanValue(form, "official"),
        }),
        ...common(form),
      };
    case "feature_flags": {
      const keys = [
        "siteReadOnly",
        "authEnabled",
        "predictionsEnabled",
        "chatEnabled",
        "chatPostingEnabled",
        "providerSyncEnabled",
        "liveSyncEnabled",
        "adsEnabled",
        "emailEnabled",
        "socialCardsEnabled",
      ];
      return {
        action,
        patch: Object.fromEntries(
          keys
            .filter((key) => form.has(key))
            .map((key) => [key, booleanValue(form, key)]),
        ),
        ...common(form),
      };
    }
    case "room_control":
      return {
        action,
        roomId: value(form, "roomId"),
        status: value(form, "status"),
        slowModeSeconds: optionalNumber(form, "slowModeSeconds") ?? 0,
        ...common(form),
      };
    case "remove_message":
      return {
        action,
        roomId: value(form, "roomId"),
        messageId: value(form, "messageId"),
        ...common(form),
      };
    case "remove_discussion_post":
      return {
        action,
        fightId: value(form, "fightId"),
        postId: value(form, "postId"),
        rootPostId: value(form, "rootPostId"),
        ...common(form),
      };
    case "restore_message":
      return {
        action,
        moderationActionId: value(form, "moderationActionId"),
        ...common(form),
      };
    case "resolve_report":
      return {
        action,
        reportId: value(form, "reportId"),
        resolution: value(form, "resolution"),
        ...common(form),
      };
    case "sanction_user":
      return {
        action,
        targetUid: value(form, "targetUid"),
        sanction: value(form, "sanction"),
        durationMinutes: optionalNumber(form, "durationMinutes"),
        ...common(form),
      };
    case "set_user_roles":
      return {
        action,
        targetUid: value(form, "targetUid"),
        roles: form
          .getAll("roles")
          .filter((role): role is string => typeof role === "string"),
        ...common(form),
      };
    case "merge_fighters":
      return {
        action,
        primaryFighterId: value(form, "primaryFighterId"),
        duplicateFighterId: value(form, "duplicateFighterId"),
        ...common(form),
      };
    case "manual_import": {
      const fixtureText = value(form, "fixture");
      let fixture: unknown;
      try {
        fixture = JSON.parse(fixtureText);
      } catch {
        throw new ApiError("Import must be valid JSON", 400, "invalid_json");
      }
      return { action, fixture, ...common(form) };
    }
    default:
      return { action, ...common(form) };
  }
}

function safeReturnTo(request: Request, requested: unknown) {
  if (
    typeof requested === "string" &&
    requested.startsWith("/admin") &&
    !requested.includes("://")
  )
    return requested;
  const referer = request.headers.get("referer");
  if (referer) {
    const url = new URL(referer);
    if (
      url.origin === new URL(request.url).origin &&
      url.pathname.startsWith("/admin")
    )
      return url.pathname;
  }
  return "/admin";
}

export async function POST(request: Request) {
  const isForm =
    request.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded") ||
    request.headers.get("content-type")?.includes("multipart/form-data");
  let raw: unknown;
  try {
    raw = isForm
      ? parseForm(await request.formData())
      : await request.json().catch(() => null);
    const session = await requireAdminMutation(request);
    const parsed = adminActionSchema.safeParse(raw);
    if (!parsed.success)
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "Invalid admin action",
        400,
        "invalid_admin_action",
      );
    const result = await executeAdminAction(parsed.data, session.uid);
    revalidatePath("/", "layout");
    if (!isForm) return NextResponse.json({ ok: true, result });
    const returnTo = safeReturnTo(request, parsed.data.returnTo);
    const target = new URL(returnTo, request.url);
    target.searchParams.set("adminSuccess", "1");
    return NextResponse.redirect(target, 303);
  } catch (error) {
    if (!isForm) return apiErrorResponse(error);
    const returnTo = safeReturnTo(request, recordReturnTo(raw));
    const target = new URL(returnTo, request.url);
    target.searchParams.set(
      "adminError",
      error instanceof ApiError ? error.message : "Admin action failed",
    );
    return NextResponse.redirect(target, 303);
  }
}

function recordReturnTo(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>).returnTo
    : undefined;
}
