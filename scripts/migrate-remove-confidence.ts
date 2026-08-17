import {
  applicationDefault,
  cert,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from "firebase-admin/firestore";

const expectedProjectId = "mma-cortex";
const requiredConfirmation = `${expectedProjectId}:remove-confidence`;

function privateKey() {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function migrate(firestore: Firestore, apply: boolean) {
  const predictions = await firestore.collection("predictions").get();
  let predictionUpdates = 0;
  let legacyLocks = 0;
  let revisionUpdates = 0;
  let batch: WriteBatch = firestore.batch();
  let pending = 0;

  async function flush() {
    if (!apply || pending === 0) return;
    await batch.commit();
    batch = firestore.batch();
    pending = 0;
  }

  async function update(
    reference: DocumentReference,
    patch: Record<string, unknown>,
  ) {
    if (apply) {
      batch.update(reference, patch);
      pending += 1;
      if (pending >= 400) await flush();
    }
  }

  for (const prediction of predictions.docs) {
    const data = record(prediction.data());
    const pick = record(data.pick);
    const patch: Record<string, unknown> = {};
    if (Object.hasOwn(pick, "confidence")) {
      patch["pick.confidence"] = FieldValue.delete();
    }
    if (data.status === "active") {
      patch.status = "locked";
      patch.lockedAt =
        data.lockedAt ??
        data.updatedAt ??
        data.submittedAt ??
        FieldValue.serverTimestamp();
      legacyLocks += 1;
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = FieldValue.serverTimestamp();
      predictionUpdates += 1;
      await update(prediction.ref, patch);
    }

    const revisions = await prediction.ref.collection("revisions").get();
    for (const revision of revisions.docs) {
      const revisionData = record(revision.data());
      const revisionPatch: Record<string, unknown> = {};
      if (Object.hasOwn(record(revisionData.oldPick), "confidence"))
        revisionPatch["oldPick.confidence"] = FieldValue.delete();
      if (Object.hasOwn(record(revisionData.newPick), "confidence"))
        revisionPatch["newPick.confidence"] = FieldValue.delete();
      if (Object.keys(revisionPatch).length > 0) {
        revisionUpdates += 1;
        await update(revision.ref, revisionPatch);
      }
    }
  }
  await flush();
  return {
    scanned: predictions.size,
    predictionUpdates,
    legacyLocks,
    revisionUpdates,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const actorUid = argument("--actor");
  if (apply && !actorUid)
    throw new Error(
      "--actor <firebase-uid> is required when applying the migration",
    );
  if (
    apply &&
    process.env.FIGHTLOBBY_MIGRATION_CONFIRM !== requiredConfirmation
  )
    throw new Error(
      `Set FIGHTLOBBY_MIGRATION_CONFIRM=${requiredConfirmation} before applying`,
    );
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (projectId !== expectedProjectId)
    throw new Error(
      `Refusing to run against project ${projectId ?? "unknown"}`,
    );
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = privateKey();
  const app = initializeApp({
    credential:
      clientEmail && key
        ? cert({ projectId, clientEmail, privateKey: key })
        : applicationDefault(),
    projectId,
  });
  try {
    const firestore = getFirestore(app);
    const result = await migrate(firestore, apply);
    if (apply) {
      const audit = firestore.collection("auditLogs").doc();
      await audit.set({
        id: audit.id,
        category: "admin",
        actorUid,
        action: "remove_prediction_confidence",
        targetType: "prediction_system",
        targetId: "all_predictions",
        reason: "Remove retired confidence field and lock legacy active picks",
        before: { scanned: result.scanned },
        after: result,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    console.log(
      JSON.stringify(
        { mode: apply ? "applied" : "dry-run", ...result },
        null,
        2,
      ),
    );
  } finally {
    await deleteApp(app);
  }
}

void main();
