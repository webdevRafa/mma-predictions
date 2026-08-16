import { createHash } from "node:crypto";

import { canonicalSlug } from "@fightlobby/domain";
import type { MmaDataProvider } from "@fightlobby/providers";
import { getFunctions } from "firebase-admin/functions";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { z } from "zod";

import { requireRole } from "../auth/roles.js";
import { gradeFightPredictionsCore } from "../grading/grade-fight-predictions.js";
import { getAdminServices } from "../lib/firebase/admin.js";
import { resolveProviderMapping } from "./mapping.js";
import {
  getConfiguredProvider,
  providerSyncEnabled,
} from "./provider-factory.js";
import { archiveRawSnapshots } from "./raw-archive.js";
import { revalidatePublicPages } from "./revalidation.js";
import { syncEventCardCore } from "./sync-event-card.js";
import {
  FIGHTER_OVERRIDE_ROOTS,
  applyManualOverrides,
  checksum,
  record,
} from "./sync-utils.js";

const eventTaskSchema = z
  .object({
    externalEventId: z.string().min(1).max(120),
    dryRun: z.boolean().optional().default(false),
  })
  .strict();
const fighterTaskSchema = z
  .object({ externalFighterId: z.string().min(1).max(120) })
  .strict();
const callableSyncSchema = eventTaskSchema.extend({
  dryRun: z.boolean().default(true),
});

function archiveEnabled() {
  return process.env.RAW_PROVIDER_ARCHIVE_ENABLED !== "false";
}

function taskId(
  providerKey: string,
  externalEventId: string,
  date = new Date(),
  windowMinutes = 60,
) {
  const window = Math.floor(date.getTime() / (windowMinutes * 60_000));
  return createHash("sha256")
    .update(`${providerKey}:${externalEventId}:${window}`)
    .digest("hex")
    .slice(0, 40);
}

async function logDiscoveryError(
  firestore: Firestore,
  providerKey: string,
  error: unknown,
) {
  const reference = firestore.collection("providerErrors").doc();
  await reference.set({
    id: reference.id,
    providerKey,
    operation: "discover_upcoming_events",
    message: error instanceof Error ? error.message : "Unknown provider error",
    errorName: error instanceof Error ? error.name : "UnknownError",
    retryable: true,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function discoverUpcomingEventsCore(
  provider: MmaDataProvider,
  options: { from?: Date; to?: Date } = {},
) {
  const now = new Date();
  const from = options.from ?? new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const to = options.to ?? new Date(now.getTime() + 400 * 24 * 60 * 60 * 1_000);
  const services = getAdminServices();
  try {
    const events = await provider.listEvents({ from, to });
    await archiveRawSnapshots(
      services.firestore,
      services.storage,
      provider.drainRawSnapshots?.() ?? [],
      archiveEnabled(),
    );
    const queue = getFunctions(services.app).taskQueue<
      z.infer<typeof eventTaskSchema>
    >("syncEventCardTask");
    const results = await Promise.allSettled(
      events.map((event) =>
        queue.enqueue(
          { externalEventId: event.externalId, dryRun: false },
          {
            id: taskId(provider.providerKey, event.externalId),
            dispatchDeadlineSeconds: 540,
          },
        ),
      ),
    );
    const enqueued = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const duplicates = results.length - enqueued;
    await services.firestore.collection("syncDiscoveryRuns").add({
      providerKey: provider.providerKey,
      from: from.toISOString(),
      to: to.toISOString(),
      discovered: events.length,
      enqueued,
      duplicateOrFailedTasks: duplicates,
      status: "complete",
      createdAt: FieldValue.serverTimestamp(),
    });
    return { discovered: events.length, enqueued, duplicates };
  } catch (error) {
    await archiveRawSnapshots(
      services.firestore,
      services.storage,
      provider.drainRawSnapshots?.() ?? [],
      archiveEnabled(),
    ).catch(() => undefined);
    await logDiscoveryError(services.firestore, provider.providerKey, error);
    throw error;
  }
}

export const syncEventCardTask = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 5,
      minBackoffSeconds: 30,
      maxBackoffSeconds: 900,
      maxDoublings: 5,
    },
    rateLimits: { maxConcurrentDispatches: 3, maxDispatchesPerSecond: 2 },
    timeoutSeconds: 540,
  },
  async (request) => {
    const input = eventTaskSchema.parse(request.data);
    const services = getAdminServices();
    const result = await syncEventCardCore({
      provider: getConfiguredProvider(),
      firestore: services.firestore,
      storage: services.storage,
      externalEventId: input.externalEventId,
      dryRun: input.dryRun,
      archiveEnabled: archiveEnabled(),
    });
    if (result.status === "complete" || result.status === "unchanged")
      for (const fightId of result.gradeFightIds)
        await gradeFightPredictionsCore(
          services.firestore,
          fightId,
          "provider_official_result",
        );
  },
);

export const discoverUpcomingEvents = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "Etc/UTC",
    retryCount: 3,
    minBackoffSeconds: 60,
  },
  async () => {
    if (!providerSyncEnabled()) {
      logger.info(
        "Provider discovery skipped because licensed ingestion is disabled",
      );
      return;
    }
    await discoverUpcomingEventsCore(getConfiguredProvider());
  },
);

async function enqueueCurrentEvents() {
  if (!providerSyncEnabled()) return { enqueued: 0 };
  const services = getAdminServices();
  const horizon = new Date(Date.now() + 18 * 60 * 60 * 1_000).toISOString();
  const floor = new Date(Date.now() - 8 * 60 * 60 * 1_000).toISOString();
  const snapshots = await services.firestore
    .collection("events")
    .where("startsAt", ">=", floor)
    .where("startsAt", "<=", horizon)
    .limit(30)
    .get();
  const queue = getFunctions(services.app).taskQueue<
    z.infer<typeof eventTaskSchema>
  >("syncEventCardTask");
  const states = await Promise.all(
    snapshots.docs.map((document) =>
      services.firestore
        .collection("providerEntityState")
        .doc(`event_${document.id}`)
        .get(),
    ),
  );
  const externalIds = states.flatMap((state) => {
    const externalId: unknown = state.get("externalId");
    return state.get("providerKey") === "sportsdataio" &&
      typeof externalId === "string"
      ? [externalId]
      : [];
  });
  await Promise.allSettled(
    externalIds.map((externalEventId) =>
      queue.enqueue(
        { externalEventId, dryRun: false },
        { id: taskId("sportsdataio", externalEventId, new Date(), 5) },
      ),
    ),
  );
  return { enqueued: externalIds.length };
}

export const syncLiveEvents = onSchedule(
  { schedule: "every 5 minutes", timeZone: "Etc/UTC", retryCount: 2 },
  async () => {
    await enqueueCurrentEvents();
  },
);

export const reconcileProviderChanges = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Etc/UTC",
    retryCount: 3,
    minBackoffSeconds: 60,
  },
  async () => {
    if (!providerSyncEnabled()) return;
    await discoverUpcomingEventsCore(getConfiguredProvider());
  },
);

export const refreshFighterTask = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2, maxDispatchesPerSecond: 1 },
  },
  async (request) => {
    const input = fighterTaskSchema.parse(request.data);
    const provider = getConfiguredProvider();
    const services = getAdminServices();
    try {
      const fighter = await provider.getFighter(input.externalFighterId);
      const mapping = await resolveProviderMapping(services.firestore, {
        providerKey: provider.providerKey,
        entityType: "fighter",
        externalId: input.externalFighterId,
        candidate: {
          normalizedName: fighter.name.normalized,
          ...(fighter.birthDate ? { birthDate: fighter.birthDate } : {}),
        },
        dryRun: false,
      });
      const reference = services.firestore
        .collection("fighters")
        .doc(mapping.internalId);
      const stateReference = services.firestore
        .collection("providerEntityState")
        .doc(`fighter_${mapping.internalId}`);
      const [snapshot, stateSnapshot] = await Promise.all([
        reference.get(),
        stateReference.get(),
      ]);
      const previous = record(snapshot.data());
      const previousState = record(stateSnapshot.data());
      const previousSlug =
        typeof previous.slug === "string"
          ? previous.slug
          : canonicalSlug(fighter.name.full, mapping.internalId);
      const { providerExternalId, ...canonicalSource } = fighter;
      void providerExternalId;
      const previousEvents = Array.isArray(previous.upcomingEventIds)
        ? previous.upcomingEventIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const base = {
        ...canonicalSource,
        id: mapping.internalId,
        slug: previousSlug,
        slugHistory: Array.isArray(previous.slugHistory)
          ? previous.slugHistory
          : [],
        upcomingEventIds: previousEvents,
        updatedAt: new Date().toISOString(),
      };
      const value = applyManualOverrides(
        base,
        previousState.manualOverrides ?? previous.manualOverrides,
        FIGHTER_OVERRIDE_ROOTS,
      );
      await archiveRawSnapshots(
        services.firestore,
        services.storage,
        provider.drainRawSnapshots?.() ?? [],
        archiveEnabled(),
      );
      const batch = services.firestore.batch();
      batch.set(reference, value);
      batch.set(stateReference, {
        id: stateReference.id,
        entityType: "fighter",
        internalId: mapping.internalId,
        providerKey: provider.providerKey,
        externalId: input.externalFighterId,
        sourceChecksum: checksum(fighter),
        providerData: canonicalSource,
        manualOverrides:
          previousState.manualOverrides ?? previous.manualOverrides ?? {},
        syncVersion: 1,
        syncedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      await revalidatePublicPages([
        `/fighters/${previousSlug}`,
        "/sitemap.xml",
      ]);
    } catch (error) {
      await archiveRawSnapshots(
        services.firestore,
        services.storage,
        provider.drainRawSnapshots?.() ?? [],
        archiveEnabled(),
      ).catch(() => undefined);
      const errorRef = services.firestore.collection("providerErrors").doc();
      await errorRef.set({
        id: errorRef.id,
        providerKey: provider.providerKey,
        externalFighterId: input.externalFighterId,
        operation: "refresh_fighter",
        message:
          error instanceof Error ? error.message : "Unknown provider error",
        retryable: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      throw error;
    }
  },
);

export async function nightlyIntegrityCheckCore(firestore: Firestore) {
  const [events, fights] = await Promise.all([
    firestore.collection("events").limit(500).get(),
    firestore.collection("fights").limit(500).get(),
  ]);
  const eventIds = new Set(events.docs.map((document) => document.id));
  const fighterIds = new Set(
    fights.docs.flatMap((document) => {
      const fighterA: unknown = document.get("fighterAId");
      const fighterB: unknown = document.get("fighterBId");
      return [fighterA, fighterB].filter(
        (value): value is string => typeof value === "string",
      );
    }),
  );
  const fighterSnapshots = await Promise.all(
    [...fighterIds].map((id) => firestore.collection("fighters").doc(id).get()),
  );
  const missingFighters = new Set(
    fighterSnapshots
      .filter((snapshot) => !snapshot.exists)
      .map((snapshot) => snapshot.id),
  );
  const issues = fights.docs.flatMap((document) => {
    const eventId: unknown = document.get("eventId");
    const fighterAId: unknown = document.get("fighterAId");
    const fighterBId: unknown = document.get("fighterBId");
    const messages: string[] = [];
    if (typeof eventId !== "string" || !eventIds.has(eventId))
      messages.push("missing_event");
    if (typeof fighterAId !== "string" || missingFighters.has(fighterAId))
      messages.push("missing_fighter_a");
    if (typeof fighterBId !== "string" || missingFighters.has(fighterBId))
      messages.push("missing_fighter_b");
    return messages.map((type) => ({ fightId: document.id, type }));
  });
  const reference = firestore.collection("integrityRuns").doc();
  await reference.set({
    id: reference.id,
    status: issues.length === 0 ? "healthy" : "issues_found",
    eventsChecked: events.size,
    fightsChecked: fights.size,
    issues,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: reference.id, issues };
}

export const nightlyIntegrityCheck = onSchedule(
  { schedule: "0 5 * * *", timeZone: "Etc/UTC", retryCount: 2 },
  async () => {
    await nightlyIntegrityCheckCore(getAdminServices().firestore);
  },
);

export const runEventSync = onCall(
  { enforceAppCheck: true, timeoutSeconds: 540 },
  async (request) => {
    requireRole(request.auth?.token, ["admin"]);
    const input = callableSyncSchema.safeParse(request.data);
    if (!input.success)
      throw new HttpsError("invalid-argument", "Invalid event sync request");
    try {
      const services = getAdminServices();
      return await syncEventCardCore({
        provider: getConfiguredProvider(),
        firestore: services.firestore,
        storage: services.storage,
        externalEventId: input.data.externalEventId,
        dryRun: input.data.dryRun,
        archiveEnabled: archiveEnabled(),
      });
    } catch (error) {
      throw new HttpsError(
        "failed-precondition",
        error instanceof Error ? error.message : "Event sync failed",
      );
    }
  },
);
