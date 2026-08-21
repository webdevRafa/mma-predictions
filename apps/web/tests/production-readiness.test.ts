import { describe, expect, it } from "vitest";

import {
  evaluateProductionReadiness,
  type Environment,
} from "../lib/operations/production-readiness";

function productionEnvironment(
  overrides: Environment = {},
): Record<string, string | undefined> {
  return {
    VITE_FIREBASE_API_KEY: "public-firebase-key",
    VITE_FIREBASE_AUTH_DOMAIN: "mma-cortex.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "mma-cortex",
    VITE_FIREBASE_DATABASE_URL:
      "https://mma-cortex-default-rtdb.firebaseio.com",
    VITE_FIREBASE_STORAGE_BUCKET: "mma-cortex.firebasestorage.app",
    VITE_FIREBASE_APP_ID: "1:123:web:abc",
    VITE_FIREBASE_APP_CHECK_SITE_KEY: "app-check-site-key",
    FIREBASE_ADMIN_PROJECT_ID: "mma-cortex",
    FIREBASE_ADMIN_CLIENT_EMAIL:
      "firebase-admin@mma-cortex.iam.gserviceaccount.com",
    FIREBASE_ADMIN_PRIVATE_KEY: "private-key-material",
    FIGHTLOBBY_DATA_SOURCE: "firestore",
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
    FIREBASE_APP_CHECK_ENFORCED: "true",
    REVALIDATION_SECRET: "a-secure-secret-with-more-than-32-characters",
    NEXT_PUBLIC_SITE_URL: "https://fightlobby.com",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-ABC123",
    GOOGLE_SITE_VERIFICATION: "verification-token",
    ...overrides,
  };
}

describe("production readiness", () => {
  it("accepts a production-only configuration with ads disabled", () => {
    const report = evaluateProductionReadiness(productionEnvironment());
    expect(report).toEqual({ ready: true, blockers: [], warnings: [] });
  });

  it("rejects fixture data, emulators, and disabled App Check", () => {
    const report = evaluateProductionReadiness(
      productionEnvironment({
        FIGHTLOBBY_DATA_SOURCE: "fixture",
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
        FIREBASE_APP_CHECK_ENFORCED: "false",
      }),
    );
    expect(report.blockers.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "fixture_data_source",
        "firebase_emulators_enabled",
        "app_check_not_enforced",
      ]),
    );
  });

  it("requires a matching production Firebase project", () => {
    const report = evaluateProductionReadiness(
      productionEnvironment({
        VITE_FIREBASE_PROJECT_ID: "fightlobby-staging",
      }),
    );
    expect(report.blockers.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "firebase_project_mismatch",
        "non_production_firebase_project",
      ]),
    );
  });

  it("requires a custom HTTPS canonical origin", () => {
    const report = evaluateProductionReadiness(
      productionEnvironment({
        NEXT_PUBLIC_SITE_URL: "https://fightlobby.vercel.app/preview",
      }),
    );
    expect(report.blockers.map(({ code }) => code)).toContain(
      "invalid_canonical_url",
    );
  });

  it("keeps every AdSense launch variable unset", () => {
    const report = evaluateProductionReadiness(
      productionEnvironment({ NEXT_PUBLIC_ADSENSE_CLIENT_ID: "ca-pub-123" }),
    );
    expect(report.blockers.map(({ code }) => code)).toContain(
      "ads_configured_before_launch",
    );
  });

  it("reports missing observability integrations as warnings", () => {
    const report = evaluateProductionReadiness(
      productionEnvironment({
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
        GOOGLE_SITE_VERIFICATION: "",
      }),
    );
    expect(report.ready).toBe(true);
    expect(report.warnings.map(({ code }) => code)).toEqual([
      "analytics_not_configured",
      "search_console_not_configured",
    ]);
  });
});
