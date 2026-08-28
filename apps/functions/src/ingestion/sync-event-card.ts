import {
  canonicalSlug,
  type Event,
  type Fight,
  type Fighter,
} from "@fightlobby/domain";
import type { MmaDataProvider, ProviderEventCard } from "@fightlobby/providers";
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

import { resolveProviderMapping } from "./mapping.js";
import { archiveRawSnapshots } from "./raw-archive.js";
import { revalidatePublicPages } from "./revalidation.js";
import {
  EVENT_OVERRIDE_ROOTS,
  FIGHT_OVERRIDE_ROOTS,
  FIGHTER_OVERRIDE_ROOTS,
  applyManualOverrides,
  changedFields,
  checksum,
  record,
} from "./sync-utils.js";

const SYNC_VERSION = 1;

function withoutVolatileValues(card: ProviderEventCard) {
  return {
    event: { ...card.event, updatedAt: undefined },
    fights: card.fights.map((fight) => ({
      ...fight,
      updatedAt: undefined,
      ...(fight.result
        ? { result: { ...fight.result, updatedAt: undefined } }
        : {}),
    })),
    fighters: card.fighters.map((fighter) => ({
      ...fighter,
      updatedAt: undefined,
    })),
    providerRefs: card.providerRefs,
  };
}

function snapshotData(snapshot: DocumentSnapshot<DocumentData>) {
  return snapshot.exists ? record(snapshot.data()) : {};
}

function preserveSlug(previous: Record<string, unknown>, proposedSlug: string) {
  const existingSlug = previous.slug;
  const history = Array.isArray(previous.slugHistory)
    ? previous.slugHistory.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (typeof existingSlug !== "string")
    return { slug: proposedSlug, slugHistory: history };
  return {
    slug: existingSlug,
    slugHistory:
      existingSlug === proposedSlug || history.includes(proposedSlug)
        ? history
        : [...history, proposedSlug],
  };
}

function ownedEventFields(previous: Record<string, unknown>) {
  return {
    ...(previous.predictionSummary
      ? { predictionSummary: previous.predictionSummary }
      : {}),
    ...(previous.editorial ? { editorial: previous.editorial } : {}),
    ...(typeof previous.chatRoomId === "string"
      ? { chatRoomId: previous.chatRoomId }
      : {}),
  };
}

function ownedFightFields(
  previous: Record<string, unknown>,
  preservePreviousResult: boolean,
) {
  const previousResult = record(previous.result);
  const preservesOfficialResult =
    preservePreviousResult && previousResult.official === true;
  return {
    ...(previous.predictionSummary
      ? { predictionSummary: previous.predictionSummary }
      : {}),
    ...(previous.editorial ? { editorial: previous.editorial } : {}),
    ...(previous.gradingSummary
      ? { gradingSummary: previous.gradingSummary }
      : {}),
    ...(typeof previous.chatRoomId === "string"
      ? { chatRoomId: previous.chatRoomId }
      : {}),
    ...(typeof previous.predictionsLockedAt === "string"
      ? { predictionsLockedAt: previous.predictionsLockedAt }
      : {}),
    ...(["locked", "graded", "void"].includes(String(previous.predictionStatus))
      ? { predictionStatus: previous.predictionStatus }
      : {}),
    ...(preservesOfficialResult ? { result: previous.result } : {}),
    ...(preservesOfficialResult && previous.status === "completed"
      ? { status: "completed" }
      : {}),
  };
}

function providerState(
  entityType: "event" | "fight" | "fighter",
  internalId: string,
  providerKey: string,
  externalId: string,
  sourceChecksum: string,
  providerData: unknown,
  manualOverrides: unknown,
) {
  return {
    id: `${entityType}_${internalId}`,
    entityType,
    internalId,
    providerKey,
    externalId,
    sourceChecksum,
    providerData,
    manualOverrides: manualOverrides ?? {},
    syncVersion: SYNC_VERSION,
    syncedAt: FieldValue.serverTimestamp(),
  };
}

function resultWithVersion(
  proposed: Fight["result"],
  previous: Record<string, unknown>,
) {
  if (!proposed) return undefined;
  const previousResult = record(previous.result);
  const previousComparable = {
    ...previousResult,
    resultVersion: undefined,
    updatedAt: undefined,
  };
  const proposedComparable = {
    ...proposed,
    resultVersion: undefined,
    updatedAt: undefined,
  };
  const changed = checksum(previousComparable) !== checksum(proposedComparable);
  const previousVersion =
    typeof previousResult.resultVersion === "number"
      ? previousResult.resultVersion
      : 0;
  return {
    ...proposed,
    resultVersion: changed ? previousVersion + 1 : Math.max(previousVersion, 1),
  };
}

interface CanonicalizedCard {
  event: Event & Record<string, unknown>;
  fights: Array<Fight & Record<string, unknown>>;
  fighters: Array<Fighter & Record<string, unknown>>;
  canceledFights: Array<Record<string, unknown> & { id: string }>;
  providerStates: Array<Record<string, unknown> & { id: string }>;
  changes: Array<{
    entityType: "event" | "fight" | "fighter";
    id: string;
    operation: "create" | "update" | "cancel" | "noop";
    fields: string[];
  }>;
}

async function canonicalizeCard(
  firestore: Firestore,
  providerKey: string,
  card: ProviderEventCard,
  sourceChecksum: string,
  dryRun: boolean,
): Promise<CanonicalizedCard> {
  const eventMapping = await resolveProviderMapping(firestore, {
    providerKey,
    entityType: "event",
    externalId: card.providerRefs.event,
    dryRun,
  });
  const fighterMappings = new Map(
    await Promise.all(
      card.fighters.map(async (fighter) => {
        const externalId = card.providerRefs.fighters[fighter.id];
        if (!externalId)
          throw new Error(
            `Missing provider fighter reference for ${fighter.id}`,
          );
        const mapping = await resolveProviderMapping(firestore, {
          providerKey,
          entityType: "fighter",
          externalId,
          candidate: {
            normalizedName: fighter.name.normalized,
            ...(fighter.birthDate ? { birthDate: fighter.birthDate } : {}),
          },
          dryRun,
        });
        return [fighter.id, { ...mapping, externalId }] as const;
      }),
    ),
  );
  const fightMappings = new Map(
    await Promise.all(
      card.fights.map(async (fight) => {
        const externalId = card.providerRefs.fights[fight.id];
        if (!externalId)
          throw new Error(`Missing provider fight reference for ${fight.id}`);
        const mapping = await resolveProviderMapping(firestore, {
          providerKey,
          entityType: "fight",
          externalId,
          dryRun,
        });
        return [fight.id, { ...mapping, externalId }] as const;
      }),
    ),
  );

  const eventRef = firestore.collection("events").doc(eventMapping.internalId);
  const fighterRefs = [...fighterMappings.values()].map((mapping) =>
    firestore.collection("fighters").doc(mapping.internalId),
  );
  const fightRefs = [...fightMappings.values()].map((mapping) =>
    firestore.collection("fights").doc(mapping.internalId),
  );
  const stateCollection = firestore.collection("providerEntityState");
  const [
    eventSnapshot,
    fighterSnapshots,
    fightSnapshots,
    eventStateSnapshot,
    fighterStateSnapshots,
    fightStateSnapshots,
    priorEventFights,
  ] = await Promise.all([
    eventRef.get(),
    Promise.all(fighterRefs.map((reference) => reference.get())),
    Promise.all(fightRefs.map((reference) => reference.get())),
    stateCollection.doc(`event_${eventMapping.internalId}`).get(),
    Promise.all(
      fighterRefs.map((reference) =>
        stateCollection.doc(`fighter_${reference.id}`).get(),
      ),
    ),
    Promise.all(
      fightRefs.map((reference) =>
        stateCollection.doc(`fight_${reference.id}`).get(),
      ),
    ),
    firestore
      .collection("fights")
      .where("eventId", "==", eventMapping.internalId)
      .get(),
  ]);
  const previousEvent = snapshotData(eventSnapshot);
  const previousFighters = new Map(
    fighterSnapshots.map((snapshot) => [snapshot.id, snapshotData(snapshot)]),
  );
  const previousFights = new Map(
    fightSnapshots.map((snapshot) => [snapshot.id, snapshotData(snapshot)]),
  );
  const previousEventState = snapshotData(eventStateSnapshot);
  const previousFighterStates = new Map(
    fighterStateSnapshots.map((snapshot) => [
      snapshot.id.replace(/^fighter_/, ""),
      snapshotData(snapshot),
    ]),
  );
  const previousFightStates = new Map(
    fightStateSnapshots.map((snapshot) => [
      snapshot.id.replace(/^fight_/, ""),
      snapshotData(snapshot),
    ]),
  );

  const fighters = card.fighters.map((fighter) => {
    const mapping = fighterMappings.get(fighter.id)!;
    const previous = previousFighters.get(mapping.internalId) ?? {};
    const previousState = previousFighterStates.get(mapping.internalId) ?? {};
    const proposedSlug = canonicalSlug(fighter.name.full, mapping.internalId);
    const previousEvents = Array.isArray(previous.upcomingEventIds)
      ? previous.upcomingEventIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const base = {
      ...fighter,
      id: mapping.internalId,
      ...preserveSlug(previous, proposedSlug),
      upcomingEventIds: [
        ...new Set([...previousEvents, eventMapping.internalId]),
      ],
      updatedAt: new Date().toISOString(),
    };
    const value = applyManualOverrides(
      base,
      previousState.manualOverrides ?? previous.manualOverrides,
      FIGHTER_OVERRIDE_ROOTS,
    ) as Fighter & Record<string, unknown>;
    return value;
  });
  const fightersByOldId = new Map(
    card.fighters.map((fighter) => {
      const mapping = fighterMappings.get(fighter.id)!;
      return [
        fighter.id,
        fighters.find((value) => value.id === mapping.internalId)!,
      ] as const;
    }),
  );

  const fights = card.fights.map((fight) => {
    const mapping = fightMappings.get(fight.id)!;
    const previous = previousFights.get(mapping.internalId) ?? {};
    const previousState = previousFightStates.get(mapping.internalId) ?? {};
    const fighterA = fightersByOldId.get(fight.fighterAId);
    const fighterB = fightersByOldId.get(fight.fighterBId);
    if (!fighterA || !fighterB)
      throw new Error(`Fight ${fight.id} references an unmapped fighter`);
    const proposedSlug = canonicalSlug(
      `${fighterA.name.full} vs ${fighterB.name.full}`,
      mapping.internalId,
    );
    const result = resultWithVersion(fight.result, previous);
    const base = {
      ...fight,
      id: mapping.internalId,
      ...preserveSlug(previous, proposedSlug),
      eventId: eventMapping.internalId,
      fighterAId: fighterA.id,
      fighterBId: fighterB.id,
      fighterA: {
        id: fighterA.id,
        slug: fighterA.slug,
        name: fighterA.name,
        record: fighterA.record,
        ...(fighterA.countryCode ? { countryCode: fighterA.countryCode } : {}),
      },
      fighterB: {
        id: fighterB.id,
        slug: fighterB.slug,
        name: fighterB.name,
        record: fighterB.record,
        ...(fighterB.countryCode ? { countryCode: fighterB.countryCode } : {}),
      },
      chatRoomId:
        typeof previous.chatRoomId === "string"
          ? previous.chatRoomId
          : `fight_${mapping.internalId}`,
      ...(result ? { result } : {}),
      ...ownedFightFields(previous, !result),
      updatedAt: new Date().toISOString(),
    };
    const value = applyManualOverrides(
      base,
      previousState.manualOverrides ?? previous.manualOverrides,
      FIGHT_OVERRIDE_ROOTS,
    ) as Fight & Record<string, unknown>;
    return value;
  });
  const fightByOldId = new Map(
    card.fights.map((fight) => [
      fight.id,
      fights.find(
        (value) => value.id === fightMappings.get(fight.id)!.internalId,
      )!,
    ]),
  );
  const mappedMainEventId = card.event.mainEventFightId
    ? fightByOldId.get(card.event.mainEventFightId)?.id
    : undefined;
  const eventBase = {
    ...card.event,
    id: eventMapping.internalId,
    ...preserveSlug(
      previousEvent,
      canonicalSlug(card.event.name, eventMapping.internalId),
    ),
    ...(mappedMainEventId ? { mainEventFightId: mappedMainEventId } : {}),
    chatRoomId:
      typeof previousEvent.chatRoomId === "string"
        ? previousEvent.chatRoomId
        : `event_${eventMapping.internalId}`,
    ...ownedEventFields(previousEvent),
    updatedAt: new Date().toISOString(),
  };
  const eventValue = applyManualOverrides(
    eventBase,
    previousEventState.manualOverrides ?? previousEvent.manualOverrides,
    EVENT_OVERRIDE_ROOTS,
  ) as Event & Record<string, unknown>;
  const event = eventValue;

  const priorFightStateSnapshots = await Promise.all(
    priorEventFights.docs.map((document) =>
      stateCollection.doc(`fight_${document.id}`).get(),
    ),
  );
  const priorFightStates = new Map(
    priorFightStateSnapshots.map((snapshot) => [
      snapshot.id.replace(/^fight_/, ""),
      snapshotData(snapshot),
    ]),
  );
  const incomingFightIds = new Set(fights.map((fight) => fight.id));
  const canceledFights = priorEventFights.docs.flatMap((document) => {
    const previous = record(document.data());
    const state = priorFightStates.get(document.id) ?? {};
    if (
      state.providerKey !== providerKey ||
      incomingFightIds.has(document.id) ||
      ["completed", "canceled"].includes(String(previous.status))
    )
      return [];
    const replacement = fights.find(
      (fight) => fight.boutOrder === previous.boutOrder,
    );
    return [
      {
        id: document.id,
        status: "canceled",
        predictionStatus:
          previous.predictionStatus === "graded" ? "graded" : "void",
        ...(replacement ? { replacedByFightId: replacement.id } : {}),
        updatedAt: new Date().toISOString(),
      },
    ];
  });

  const providerStates = [
    providerState(
      "event",
      eventMapping.internalId,
      providerKey,
      card.providerRefs.event,
      sourceChecksum,
      card.event,
      previousEventState.manualOverrides ?? previousEvent.manualOverrides,
    ),
    ...card.fighters.map((fighter) => {
      const mapping = fighterMappings.get(fighter.id)!;
      const previousState = previousFighterStates.get(mapping.internalId) ?? {};
      const previous = previousFighters.get(mapping.internalId) ?? {};
      return providerState(
        "fighter",
        mapping.internalId,
        providerKey,
        mapping.externalId,
        checksum(fighter),
        fighter,
        previousState.manualOverrides ?? previous.manualOverrides,
      );
    }),
    ...card.fights.map((fight) => {
      const mapping = fightMappings.get(fight.id)!;
      const previousState = previousFightStates.get(mapping.internalId) ?? {};
      const previous = previousFights.get(mapping.internalId) ?? {};
      return providerState(
        "fight",
        mapping.internalId,
        providerKey,
        mapping.externalId,
        checksum(fight),
        fight,
        previousState.manualOverrides ?? previous.manualOverrides,
      );
    }),
  ];

  const changes: CanonicalizedCard["changes"] = [];
  const collect = (
    entityType: "event" | "fight" | "fighter",
    id: string,
    previous: Record<string, unknown>,
    next: Record<string, unknown>,
  ) => {
    const fields = changedFields(previous, next).filter(
      (field) => !["updatedAt", "provider"].includes(field),
    );
    changes.push({
      entityType,
      id,
      operation:
        Object.keys(previous).length === 0
          ? "create"
          : fields.length > 0
            ? "update"
            : "noop",
      fields,
    });
  };
  collect("event", event.id, previousEvent, event);
  fighters.forEach((fighter) =>
    collect(
      "fighter",
      fighter.id,
      previousFighters.get(fighter.id) ?? {},
      fighter,
    ),
  );
  fights.forEach((fight) =>
    collect("fight", fight.id, previousFights.get(fight.id) ?? {}, fight),
  );
  canceledFights.forEach((fight) =>
    changes.push({
      entityType: "fight",
      id: fight.id,
      operation: "cancel",
      fields: Object.keys(fight).filter((key) => key !== "id"),
    }),
  );
  return {
    event,
    fights,
    fighters,
    canceledFights,
    providerStates,
    changes,
  };
}

function chatRoom(
  event: Event,
  input: {
    roomId: string;
    type: "event_lobby" | "fight_lobby";
    fightId?: string;
  },
) {
  const eventStarts = new Date(event.startsAt).getTime();
  const opensAt = Timestamp.fromMillis(eventStarts - 7 * 24 * 60 * 60 * 1_000);
  const writableUntil = Timestamp.fromMillis(
    eventStarts + 24 * 60 * 60 * 1_000,
  );
  return {
    id: input.roomId,
    type: input.type,
    eventId: event.id,
    ...(input.fightId ? { fightId: input.fightId } : {}),
    status: Date.now() >= opensAt.toMillis() ? "open" : "scheduled",
    opensAt,
    writableUntil,
    retentionExpiresAt: Timestamp.fromMillis(
      writableUntil.toMillis() + 30 * 24 * 60 * 60 * 1_000,
    ),
    slowModeSeconds: 7,
    messageCount: 0,
    moderationHealth: "normal",
    monetizationEligible: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function writeCanonicalCard(
  firestore: Firestore,
  canonical: CanonicalizedCard,
) {
  const batch = firestore.batch();
  batch.set(
    firestore.collection("events").doc(canonical.event.id),
    canonical.event,
  );
  canonical.fighters.forEach((fighter) =>
    batch.set(firestore.collection("fighters").doc(fighter.id), fighter),
  );
  canonical.fights.forEach((fight) =>
    batch.set(firestore.collection("fights").doc(fight.id), fight),
  );
  canonical.canceledFights.forEach((fight) =>
    batch.set(firestore.collection("fights").doc(fight.id), fight, {
      merge: true,
    }),
  );
  canonical.providerStates.forEach((state) =>
    batch.set(firestore.collection("providerEntityState").doc(state.id), state),
  );

  const roomIds = [
    canonical.event.chatRoomId,
    ...canonical.fights.map((fight) => fight.chatRoomId),
  ];
  const existingRooms = new Set(
    (
      await Promise.all(
        roomIds.map((roomId) =>
          firestore.collection("chatRooms").doc(roomId).get(),
        ),
      )
    )
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => snapshot.id),
  );
  if (!existingRooms.has(canonical.event.chatRoomId))
    batch.create(
      firestore.collection("chatRooms").doc(canonical.event.chatRoomId),
      chatRoom(canonical.event, {
        roomId: canonical.event.chatRoomId,
        type: "event_lobby",
      }),
    );
  canonical.fights.forEach((fight) => {
    if (existingRooms.has(fight.chatRoomId)) return;
    batch.create(
      firestore.collection("chatRooms").doc(fight.chatRoomId),
      chatRoom(canonical.event, {
        roomId: fight.chatRoomId,
        type: "fight_lobby",
        fightId: fight.id,
      }),
    );
  });
  await batch.commit();
}

export interface SyncEventCardInput {
  provider: MmaDataProvider;
  firestore: Firestore;
  storage: Storage;
  externalEventId: string;
  dryRun?: boolean;
  archiveEnabled?: boolean;
  revalidate?: boolean;
}

export async function syncEventCardCore(input: SyncEventCardInput) {
  const dryRun = input.dryRun === true;
  let providerCard: ProviderEventCard | undefined;
  try {
    providerCard = await input.provider.getEventCard(input.externalEventId);
    const sourceChecksum = checksum(withoutVolatileValues(providerCard));
    const runId = `sync_${checksum(
      `${input.provider.providerKey}:${input.externalEventId}:${sourceChecksum}:${dryRun ? "dry" : "write"}`,
    ).slice(0, 36)}`;
    const runRef = input.firestore.collection("syncRuns").doc(runId);
    const rawManifestIds = dryRun
      ? []
      : await archiveRawSnapshots(
          input.firestore,
          input.storage,
          input.provider.drainRawSnapshots?.() ?? [],
          input.archiveEnabled === true,
        );
    if (!dryRun) {
      const previousRun = await runRef.get();
      if (previousRun.get("status") === "complete")
        return {
          id: runId,
          status: "unchanged" as const,
          changes: [],
          gradeFightIds: Array.isArray(previousRun.get("gradeFightIds"))
            ? (previousRun.get("gradeFightIds") as unknown[]).filter(
                (value): value is string => typeof value === "string",
              )
            : [],
        };
      await runRef.set(
        {
          id: runId,
          providerKey: input.provider.providerKey,
          externalEventId: input.externalEventId,
          sourceChecksum,
          status: "processing",
          dryRun: false,
          startedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    const canonical = await canonicalizeCard(
      input.firestore,
      input.provider.providerKey,
      providerCard,
      sourceChecksum,
      dryRun,
    );
    if (dryRun)
      return {
        id: runId,
        status: "dry_run" as const,
        changes: canonical.changes,
      };

    await writeCanonicalCard(input.firestore, canonical);
    const publicPaths = [
      "/",
      "/events",
      `/events/${canonical.event.slug}`,
      ...canonical.fights.map((fight) => `/fights/${fight.slug}`),
      ...canonical.fighters.map((fighter) => `/fighters/${fighter.slug}`),
      "/sitemap.xml",
    ];
    const revalidation =
      input.revalidate === false
        ? { skipped: true }
        : await revalidatePublicPages(publicPaths);
    const gradeFightIds = canonical.fights
      .filter((fight) => fight.status === "completed" && fight.result?.official)
      .map((fight) => fight.id);
    await runRef.set(
      {
        status: "complete",
        eventId: canonical.event.id,
        eventSlug: canonical.event.slug,
        changes: canonical.changes,
        rawManifestIds,
        gradeFightIds,
        revalidation,
        completedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return {
      id: runId,
      status: "complete" as const,
      eventId: canonical.event.id,
      changes: canonical.changes,
      gradeFightIds,
    };
  } catch (error) {
    if (!dryRun) {
      const rawManifestIds = await archiveRawSnapshots(
        input.firestore,
        input.storage,
        input.provider.drainRawSnapshots?.() ?? [],
        input.archiveEnabled === true,
      ).catch(() => []);
      const errorRef = input.firestore.collection("providerErrors").doc();
      await errorRef.set({
        id: errorRef.id,
        providerKey: input.provider.providerKey,
        externalEventId: input.externalEventId,
        message:
          error instanceof Error ? error.message : "Unknown provider error",
        errorName: error instanceof Error ? error.name : "UnknownError",
        rawManifestIds,
        retryable: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    throw error;
  }
}
