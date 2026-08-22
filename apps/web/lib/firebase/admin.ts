import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function privateKey(): string | undefined {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function getFirebaseAdmin() {
  const existing = getApps()[0];
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = privateKey();
  const databaseURL =
    process.env.VITE_FIREBASE_DATABASE_URL ??
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const storageBucket =
    process.env.VITE_FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const app =
    existing ??
    initializeApp({
      credential:
        projectId && clientEmail && key
          ? cert({ projectId, clientEmail, privateKey: key })
          : applicationDefault(),
      ...(projectId ? { projectId } : {}),
      ...(databaseURL ? { databaseURL } : {}),
      ...(storageBucket ? { storageBucket } : {}),
    });
  return {
    app,
    appCheck: getAppCheck(app),
    auth: getAuth(app),
    firestore: getFirestore(app),
    database: getDatabase(app),
    storage: getStorage(app),
  };
}
