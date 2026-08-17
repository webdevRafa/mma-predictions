"use client";

import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  ReCaptchaEnterpriseProvider,
  getToken,
  initializeAppCheck,
  type AppCheck,
} from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseEnvironment = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseClientConfigured = Boolean(
  firebaseEnvironment.apiKey &&
  firebaseEnvironment.projectId &&
  firebaseEnvironment.appId,
);
export const isFirebaseRealtimeConfigured =
  isFirebaseClientConfigured && Boolean(firebaseEnvironment.databaseURL);
let emulatorsConnected = false;
let appCheck: AppCheck | undefined;

function getFirebaseOptions(): FirebaseOptions {
  const { apiKey, projectId, appId } = firebaseEnvironment;
  if (!apiKey || !projectId || !appId) {
    throw new Error("Firebase client configuration is unavailable");
  }

  return {
    apiKey,
    projectId,
    appId,
    ...(firebaseEnvironment.authDomain
      ? { authDomain: firebaseEnvironment.authDomain }
      : {}),
    ...(firebaseEnvironment.databaseURL
      ? { databaseURL: firebaseEnvironment.databaseURL }
      : {}),
    ...(firebaseEnvironment.storageBucket
      ? { storageBucket: firebaseEnvironment.storageBucket }
      : {}),
    ...(firebaseEnvironment.messagingSenderId
      ? { messagingSenderId: firebaseEnvironment.messagingSenderId }
      : {}),
  };
}

export function getFirebaseClient() {
  const app = getApps()[0] ?? initializeApp(getFirebaseOptions());
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const database = getDatabase(app);
  const storage = getStorage(app);

  if (
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" &&
    !emulatorsConnected
  ) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    connectDatabaseEmulator(database, "127.0.0.1", 9000);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    emulatorsConnected = true;
  }

  return { app, auth, firestore, database, storage };
}

export async function getFirebaseAppCheckToken() {
  const siteKey = process.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
  if (!siteKey) return null;
  const { app } = getFirebaseClient();
  appCheck ??= initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return (await getToken(appCheck)).token;
}
