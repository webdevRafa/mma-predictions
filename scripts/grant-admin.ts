import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function privateKey() {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

async function main() {
  const uid = process.argv[2]?.trim();
  if (!uid) throw new Error("Usage: pnpm admin:grant <firebase-uid>");
  if (process.env.FIGHTLOBBY_ADMIN_BOOTSTRAP_CONFIRM !== uid)
    throw new Error(
      "Set FIGHTLOBBY_ADMIN_BOOTSTRAP_CONFIRM to the exact UID before granting admin access",
    );
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = privateKey();
  const app = initializeApp({
    credential:
      projectId && clientEmail && key
        ? cert({ projectId, clientEmail, privateKey: key })
        : applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const user = await auth.getUser(uid);
  const previousClaims = user.customClaims ?? {};
  const previousRoles = Array.isArray(previousClaims.roles)
    ? previousClaims.roles.map(String)
    : [];
  const roles = [...new Set(["member", ...previousRoles, "admin"])];
  await auth.setCustomUserClaims(uid, {
    ...previousClaims,
    roles,
    admin: true,
  });
  const batch = firestore.batch();
  batch.set(
    firestore.collection("users").doc(uid),
    { roles, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  const audit = firestore.collection("auditLogs").doc();
  batch.set(audit, {
    id: audit.id,
    category: "admin",
    actorUid: uid,
    action: "bootstrap_admin",
    targetType: "user",
    targetId: uid,
    reason: "Explicit local operator bootstrap",
    before: { roles: previousRoles },
    after: { roles },
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  console.log(
    `Granted audited admin role to ${uid}. Sign out and back in to refresh claims.`,
  );
}

void main();
