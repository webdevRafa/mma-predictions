import { readConsent } from "@/lib/privacy/consent";

export type AnalyticsEventName =
  | "view_event"
  | "view_fight"
  | "prediction_started"
  | "signup_prompted"
  | "signup_completed"
  | "handle_created"
  | "prediction_submitted"
  | "prediction_updated"
  | "prediction_revealed"
  | "prediction_graded"
  | "chat_opened"
  | "chat_message_sent"
  | "chat_message_reported"
  | "leaderboard_viewed"
  | "profile_shared"
  | "fighter_followed"
  | "event_followed"
  | "ad_slot_viewed"
  | "web_vital";

type AnalyticsValue = string | number | boolean;
export type AnalyticsParameters = Record<string, AnalyticsValue | undefined>;

const forbiddenParameter =
  /(email|message|body|content|password|token|handle|display_?name|user_?name|pick_detail)/i;

export function sanitizeAnalyticsParameters(
  parameters: AnalyticsParameters = {},
) {
  return Object.fromEntries(
    Object.entries(parameters)
      .filter(
        ([key, value]) =>
          !forbiddenParameter.test(key) &&
          (typeof value === "string" ||
            (typeof value === "number" && Number.isFinite(value)) ||
            typeof value === "boolean"),
      )
      .map(([key, value]) => [
        key.slice(0, 40),
        typeof value === "string" ? value.slice(0, 100) : value,
      ]),
  );
}

export function trackAnalyticsEvent(
  name: AnalyticsEventName,
  parameters: AnalyticsParameters = {},
) {
  if (typeof window === "undefined" || readConsent()?.analytics !== true)
    return false;
  window.gtag?.("event", name, sanitizeAnalyticsParameters(parameters));
  return typeof window.gtag === "function";
}
