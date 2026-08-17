import { gzip } from "node:zlib";
import { promisify } from "node:util";

import type { ProviderRawSnapshot } from "@fightlobby/providers";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

import { checksum } from "./sync-utils.js";

const gzipAsync = promisify(gzip);

function objectPath(snapshot: ProviderRawSnapshot) {
  const date = new Date(snapshot.fetchedAt);
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const timestamp = snapshot.fetchedAt.replace(/[:.]/g, "-");
  const external = encodeURIComponent(snapshot.externalId);
  return `raw/${snapshot.providerKey}/${snapshot.entityType}/${yyyy}/${mm}/${dd}/${external}/${timestamp}.json.gz`;
}

export async function archiveRawSnapshots(
  firestore: Firestore,
  storage: Storage,
  snapshots: ProviderRawSnapshot[],
  enabled: boolean,
) {
  const manifests: string[] = [];
  for (const snapshot of snapshots) {
    const body = JSON.stringify(snapshot.body);
    const bodyChecksum = checksum(snapshot.body);
    const path = objectPath(snapshot);
    if (enabled) {
      const compressed = await gzipAsync(Buffer.from(body));
      await storage
        .bucket()
        .file(path)
        .save(compressed, {
          contentType: "application/json",
          metadata: {
            contentEncoding: "gzip",
            metadata: {
              providerKey: snapshot.providerKey,
              entityType: snapshot.entityType,
              externalId: snapshot.externalId,
              checksum: bodyChecksum,
            },
          },
          resumable: false,
        });
    }
    const manifestRef = firestore.collection("rawManifests").doc();
    await manifestRef.set({
      id: manifestRef.id,
      providerKey: snapshot.providerKey,
      entityType: snapshot.entityType,
      externalId: snapshot.externalId,
      objectPath: enabled ? path : null,
      archiveStatus: enabled ? "archived" : "disabled",
      checksum: bodyChecksum,
      fetchedAt: snapshot.fetchedAt,
      httpStatus: snapshot.httpStatus,
      providerSchemaVersion: snapshot.schemaVersion,
      normalizationVersion: 1,
      retentionClass: "provider-contract",
      createdAt: FieldValue.serverTimestamp(),
    });
    manifests.push(manifestRef.id);
  }
  return manifests;
}
