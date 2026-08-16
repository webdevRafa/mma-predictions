export type Environment = Readonly<Record<string, string | undefined>>;

export interface ReadinessIssue {
  code: string;
  message: string;
}

export interface ProductionReadinessReport {
  ready: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

const requiredValues = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "VITE_FIREBASE_APP_CHECK_SITE_KEY",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "SPORTSDATAIO_MMA_KEY",
] as const;

const adConfiguration = [
  "ADSENSE_PUBLISHER_ID",
  "NEXT_PUBLIC_ADSENSE_CLIENT_ID",
  "NEXT_PUBLIC_ADSENSE_SLOT_HOME_PRIMARY",
  "NEXT_PUBLIC_ADSENSE_SLOT_HOME_SECONDARY",
  "NEXT_PUBLIC_ADSENSE_SLOT_EVENT_PRIMARY",
  "NEXT_PUBLIC_ADSENSE_SLOT_EVENT_SECONDARY",
  "NEXT_PUBLIC_ADSENSE_SLOT_FIGHT_PRIMARY",
  "NEXT_PUBLIC_ADSENSE_SLOT_FIGHT_SECONDARY",
] as const;

function value(environment: Environment, key: string) {
  return environment[key]?.trim() ?? "";
}

function looksLikePlaceholder(input: string) {
  return /^(?:change[-_ ]?me|example|placeholder|todo|your[-_ ])/i.test(input);
}

function issue(code: string, message: string): ReadinessIssue {
  return { code, message };
}

function canonicalUrlIssue(environment: Environment): ReadinessIssue | null {
  const configured = value(environment, "NEXT_PUBLIC_SITE_URL");
  if (!configured)
    return issue("missing_canonical_url", "NEXT_PUBLIC_SITE_URL is required.");
  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".vercel.app")
    )
      return issue(
        "invalid_canonical_url",
        "NEXT_PUBLIC_SITE_URL must be a bare HTTPS custom-domain origin.",
      );
  } catch {
    return issue(
      "invalid_canonical_url",
      "NEXT_PUBLIC_SITE_URL must be a valid absolute URL.",
    );
  }
  return null;
}

export function evaluateProductionReadiness(
  environment: Environment,
): ProductionReadinessReport {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  for (const key of requiredValues) {
    const configured = value(environment, key);
    if (!configured || looksLikePlaceholder(configured))
      blockers.push(
        issue(
          `missing_${key.toLowerCase()}`,
          `${key} must contain a non-placeholder production value.`,
        ),
      );
  }

  const canonicalIssue = canonicalUrlIssue(environment);
  if (canonicalIssue) blockers.push(canonicalIssue);

  const publicProject = value(environment, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const adminProject = value(environment, "FIREBASE_ADMIN_PROJECT_ID");
  if (publicProject && adminProject && publicProject !== adminProject)
    blockers.push(
      issue(
        "firebase_project_mismatch",
        "The public and Admin Firebase project IDs must match.",
      ),
    );
  if (
    publicProject &&
    /(?:^|[-_])(local|demo|staging|test)(?:$|[-_])/i.test(publicProject)
  )
    blockers.push(
      issue(
        "non_production_firebase_project",
        "The configured Firebase project ID appears to be non-production.",
      ),
    );

  if (value(environment, "FIGHTLOBBY_DATA_SOURCE") !== "firestore")
    blockers.push(
      issue(
        "fixture_data_source",
        "FIGHTLOBBY_DATA_SOURCE must be firestore in production.",
      ),
    );
  if (value(environment, "MMA_PROVIDER").toLowerCase() !== "sportsdataio")
    blockers.push(
      issue(
        "non_production_provider",
        "MMA_PROVIDER must select the licensed sportsdataio adapter.",
      ),
    );
  if (value(environment, "SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED") !== "true")
    blockers.push(
      issue(
        "provider_rights_unconfirmed",
        "SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED must be true.",
      ),
    );
  if (value(environment, "NEXT_PUBLIC_USE_FIREBASE_EMULATORS") !== "false")
    blockers.push(
      issue(
        "firebase_emulators_enabled",
        "NEXT_PUBLIC_USE_FIREBASE_EMULATORS must be explicitly false.",
      ),
    );
  if (value(environment, "FIREBASE_APP_CHECK_ENFORCED") !== "true")
    blockers.push(
      issue(
        "app_check_not_enforced",
        "FIREBASE_APP_CHECK_ENFORCED must be true after production metrics are verified.",
      ),
    );
  if (value(environment, "REVALIDATION_SECRET").length < 32)
    blockers.push(
      issue(
        "weak_revalidation_secret",
        "REVALIDATION_SECRET must contain at least 32 characters.",
      ),
    );

  const configuredAds = adConfiguration.filter((key) =>
    value(environment, key),
  );
  if (configuredAds.length > 0)
    blockers.push(
      issue(
        "ads_configured_before_launch",
        "AdSense publisher, client, and slot variables must remain unset for initial launch.",
      ),
    );

  if (!value(environment, "NEXT_PUBLIC_GA_MEASUREMENT_ID"))
    warnings.push(
      issue(
        "analytics_not_configured",
        "Consent-gated GA4 is not configured; platform health monitoring is still required.",
      ),
    );
  if (!value(environment, "GOOGLE_SITE_VERIFICATION"))
    warnings.push(
      issue(
        "search_console_not_configured",
        "Google site verification is not configured yet.",
      ),
    );

  return { ready: blockers.length === 0, blockers, warnings };
}
