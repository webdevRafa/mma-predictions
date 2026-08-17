import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function getAdminServices() {
  const app = getApps()[0] ?? initializeApp();
  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    database: getDatabase(app),
    storage: getStorage(app),
  };
}
