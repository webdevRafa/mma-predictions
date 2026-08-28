import { createHash } from "node:crypto";

import { normalizeSearchText } from "@fightlobby/domain";
import type { ProviderEntityType } from "@fightlobby/providers";
import { FieldValue, type Firestore } from "firebase-admin/firestore";

function collectionFor(entityType: ProviderEntityType) {
  return entityType === "event"
    ? "events"
    : entityType === "fight"
      ? "fights"
      : "fighters";
}

function prefixFor(entityType: ProviderEntityType) {
  return entityType === "event"
    ? "evt"
    : entityType === "fight"
      ? "fgt"
      : "ftr";
}

function mappingId(
  providerKey: string,
  entityType: ProviderEntityType,
  externalId: string,
) {
  const digest = createHash("sha256")
    .update(`${providerKey}:${entityType}:${externalId}`)
    .digest("hex")
    .slice(0, 32);
  return `${providerKey}_${entityType}_${digest}`;
}

export interface MappingCandidate {
  normalizedName?: string;
  birthDate?: string;
}

export interface ResolvedMapping {
  internalId: string;
  state: "existing" | "deduplicated" | "created" | "dry_run";
}

export async function resolveProviderMapping(
  firestore: Firestore,
  input: {
    providerKey: string;
    entityType: ProviderEntityType;
    externalId: string;
    candidate?: MappingCandidate;
    dryRun: boolean;
  },
): Promise<ResolvedMapping> {
  const id = mappingId(input.providerKey, input.entityType, input.externalId);
  const mappingRef = firestore.collection("providerMappings").doc(id);
  const existing = await mappingRef.get();
  const existingInternalId: unknown = existing.get("internalId");
  if (typeof existingInternalId === "string")
    return { internalId: existingInternalId, state: "existing" };

  let deduplicatedId: string | undefined;
  if (
    input.entityType === "fighter" &&
    input.candidate?.normalizedName &&
    input.candidate.birthDate
  ) {
    const matches = await firestore
      .collection("fighters")
      .where(
        "name.normalized",
        "==",
        normalizeSearchText(input.candidate.normalizedName),
      )
      .where("birthDate", "==", input.candidate.birthDate)
      .limit(2)
      .get();
    if (matches.size === 1) deduplicatedId = matches.docs[0]!.id;
    if (matches.size > 1)
      throw new Error(
        `Ambiguous fighter match for ${input.candidate.normalizedName}; manual review required`,
      );
  }

  const allocatedId =
    deduplicatedId ??
    `${prefixFor(input.entityType)}_${firestore
      .collection(collectionFor(input.entityType))
      .doc()
      .id.toLowerCase()}`;
  if (input.dryRun)
    return {
      internalId: allocatedId,
      state: deduplicatedId ? "deduplicated" : "dry_run",
    };

  return firestore.runTransaction(async (transaction) => {
    const latest = await transaction.get(mappingRef);
    const latestInternalId: unknown = latest.get("internalId");
    if (typeof latestInternalId === "string")
      return { internalId: latestInternalId, state: "existing" as const };
    transaction.create(mappingRef, {
      id,
      providerKey: input.providerKey,
      entityType: input.entityType,
      externalId: input.externalId,
      internalId: allocatedId,
      matchMethod: deduplicatedId ? "exact_name_birth_date" : "new_identity",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      internalId: allocatedId,
      state: deduplicatedId ? ("deduplicated" as const) : ("created" as const),
    };
  });
}
