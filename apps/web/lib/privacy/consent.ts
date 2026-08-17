export const CONSENT_STORAGE_KEY = "fightlobby_consent_v1";
export const CONSENT_VERSION = 1;

export interface ConsentPreferences {
  analytics: boolean;
  advertising: boolean;
  decidedAt: string;
  version: typeof CONSENT_VERSION;
  source: "fightlobby" | "certified_cmp";
}

export type ConsentChoice = Pick<
  ConsentPreferences,
  "analytics" | "advertising"
>;

export function isConsentPreferences(
  value: unknown,
): value is ConsentPreferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === CONSENT_VERSION &&
    typeof candidate.analytics === "boolean" &&
    typeof candidate.advertising === "boolean" &&
    typeof candidate.decidedAt === "string" &&
    ["fightlobby", "certified_cmp"].includes(String(candidate.source))
  );
}

export function readConsent(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isConsentPreferences(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConsent(
  choice: ConsentChoice,
  source: ConsentPreferences["source"] = "fightlobby",
) {
  const preferences: ConsentPreferences = {
    ...choice,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
    source,
  };
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preferences));
  return preferences;
}

export function googleConsentValues(choice: ConsentChoice) {
  return {
    analytics_storage: choice.analytics ? "granted" : "denied",
    ad_storage: choice.advertising ? "granted" : "denied",
    ad_user_data: choice.advertising ? "granted" : "denied",
    ad_personalization: choice.advertising ? "granted" : "denied",
  } as const;
}

export function applyGoogleConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  window.gtag("consent", "update", googleConsentValues(choice));
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
