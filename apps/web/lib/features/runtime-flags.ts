import "server-only";

import { cache } from "react";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

export interface RuntimeFeatureFlags {
  siteReadOnly: boolean;
  authEnabled: boolean;
  predictionsEnabled: boolean;
  chatEnabled: boolean;
  chatPostingEnabled: boolean;
  providerSyncEnabled: boolean;
  liveSyncEnabled: boolean;
  adsEnabled: boolean;
  emailEnabled: boolean;
  socialCardsEnabled: boolean;
}

export const defaultRuntimeFeatureFlags: RuntimeFeatureFlags = {
  siteReadOnly: false,
  authEnabled: true,
  predictionsEnabled: true,
  chatEnabled: true,
  chatPostingEnabled: true,
  providerSyncEnabled: true,
  liveSyncEnabled: true,
  adsEnabled: false,
  emailEnabled: false,
  socialCardsEnabled: false,
};

export const getRuntimeFeatureFlags = cache(async () => {
  if (process.env.FIGHTLOBBY_DATA_SOURCE !== "firestore")
    return defaultRuntimeFeatureFlags;
  try {
    const snapshot = await getFirebaseAdmin()
      .firestore.collection("featureFlags")
      .doc("current")
      .get();
    const data = snapshot.data() ?? {};
    return Object.fromEntries(
      Object.entries(defaultRuntimeFeatureFlags).map(([key, fallback]) => [
        key,
        typeof data[key] === "boolean" ? data[key] : fallback,
      ]),
    ) as unknown as RuntimeFeatureFlags;
  } catch {
    return defaultRuntimeFeatureFlags;
  }
});
