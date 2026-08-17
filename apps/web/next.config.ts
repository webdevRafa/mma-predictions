import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

const processDirectory = process.cwd();
const workspaceRoot = existsSync(
  path.join(processDirectory, "pnpm-workspace.yaml"),
)
  ? processDirectory
  : path.resolve(processDirectory, "../..");

loadEnvConfig(
  workspaceRoot,
  process.env.NODE_ENV === "development",
  console,
  true,
);

function publicEnvironment(primary: string, legacy?: string) {
  const currentValue = process.env[primary];
  return currentValue || (legacy ? process.env[legacy] : undefined);
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: publicEnvironment(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "VITE_FIREBASE_API_KEY",
    ),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: publicEnvironment(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_AUTH_DOMAIN",
    ),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: publicEnvironment(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_PROJECT_ID",
    ),
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: publicEnvironment(
      "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
      "VITE_FIREBASE_DATABASE_URL",
    ),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: publicEnvironment(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_STORAGE_BUCKET",
    ),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: publicEnvironment(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
    ),
    NEXT_PUBLIC_FIREBASE_APP_ID: publicEnvironment(
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      "VITE_FIREBASE_APP_ID",
    ),
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: publicEnvironment(
      "NEXT_PUBLIC_USE_FIREBASE_EMULATORS",
    ),
    VITE_FIREBASE_APP_CHECK_SITE_KEY: publicEnvironment(
      "VITE_FIREBASE_APP_CHECK_SITE_KEY",
      "NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY",
    ),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: publicEnvironment(
      "NEXT_PUBLIC_GA_MEASUREMENT_ID",
      "VITE_FIREBASE_MEASUREMENT_ID",
    ),
    NEXT_PUBLIC_ADSENSE_CLIENT_ID: publicEnvironment(
      "NEXT_PUBLIC_ADSENSE_CLIENT_ID",
    ),
  },
  poweredByHeader: false,
  reactStrictMode: true,
  headers: () =>
    Promise.resolve([
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]),
  transpilePackages: ["@fightlobby/domain"],
};

export default nextConfig;
