import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { get, ref, set } from "firebase/database";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref as storageRef, uploadString } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

const rulesDescribe = process.env.RULES_TEST === "1" ? describe : describe.skip;

rulesDescribe("Firebase security boundaries", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    const [firestoreRules, databaseRules, storageRules] = await Promise.all([
      readFile(path.resolve("firebase/firestore.rules"), "utf8"),
      readFile(path.resolve("firebase/database.rules.json"), "utf8"),
      readFile(path.resolve("firebase/storage.rules"), "utf8"),
    ]);
    environment = await initializeTestEnvironment({
      projectId: "fightlobby-local",
      firestore: { host: "127.0.0.1", port: 8080, rules: firestoreRules },
      database: { host: "127.0.0.1", port: 9000, rules: databaseRules },
      storage: { host: "127.0.0.1", port: 9199, rules: storageRules },
    });
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "events/evt_public"), {
        id: "evt_public",
        status: "scheduled",
      });
      await setDoc(doc(context.firestore(), "users/member_a"), {
        uid: "member_a",
        email: "private@example.test",
      });
      await setDoc(
        doc(context.firestore(), "providerEntityState/event_evt_public"),
        {
          providerKey: "licensed-provider",
          externalId: "private-provider-id",
          manualOverrides: {},
        },
      );
      await setDoc(doc(context.firestore(), "profiles/member_a"), {
        uid: "member_a",
        handleNormalized: "member_a",
        profileVisibility: "public",
      });
      await setDoc(doc(context.firestore(), "profiles/incomplete"), {
        uid: "incomplete",
        profileVisibility: "limited",
      });
      await setDoc(doc(context.firestore(), "profiles/leaked"), {
        uid: "leaked",
        handleNormalized: "leaked_member",
        profileVisibility: "public",
        email: "must-not-leak@example.test",
      });
      await set(
        ref(context.database(), "chat/v1/rooms/room_a/messages/msg_a"),
        { body: "hello" },
      );
      await uploadString(
        storageRef(context.storage(), "public/test.txt"),
        "public asset",
      );
    });
  });

  afterAll(async () => environment.cleanup());

  it("allows public reads but denies canonical client writes", async () => {
    const firestore = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(firestore, "events/evt_public")));
    await assertFails(
      setDoc(doc(firestore, "events/evt_public"), { status: "live" }),
    );
    await assertFails(
      setDoc(doc(firestore, "predictions/fgt_public_member_a"), {
        fightId: "fgt_public",
        uid: "member_a",
      }),
    );
    await assertFails(
      setDoc(doc(firestore, "fights/fgt_public/predictionShards/shard_01"), {
        total: 1,
      }),
    );
  });

  it("keeps private user documents owner-only", async () => {
    await assertFails(
      getDoc(
        doc(environment.unauthenticatedContext().firestore(), "users/member_a"),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          environment.authenticatedContext("member_b").firestore(),
          "users/member_a",
        ),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(
          environment.authenticatedContext("member_a").firestore(),
          "users/member_a",
        ),
      ),
    );
  });

  it("never exposes provider state or external identifiers to clients", async () => {
    const path = "providerEntityState/event_evt_public";
    await assertFails(
      getDoc(doc(environment.unauthenticatedContext().firestore(), path)),
    );
    await assertFails(
      getDoc(
        doc(environment.authenticatedContext("member_a").firestore(), path),
      ),
    );
  });

  it("only exposes complete profiles with no private identity fields", async () => {
    const firestore = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(firestore, "profiles/member_a")));
    await assertFails(getDoc(doc(firestore, "profiles/incomplete")));
    await assertFails(getDoc(doc(firestore, "profiles/leaked")));
  });

  it("allows public chat reads and own presence but no direct messages", async () => {
    const publicDatabase = environment.unauthenticatedContext().database();
    await assertSucceeds(
      get(ref(publicDatabase, "chat/v1/rooms/room_a/messages")),
    );
    const memberDatabase = environment
      .authenticatedContext("member_a")
      .database();
    await assertSucceeds(
      set(ref(memberDatabase, "chat/v1/rooms/room_a/presence/member_a"), {
        connected: true,
        lastSeen: Date.now(),
      }),
    );
    await assertFails(
      set(ref(memberDatabase, "chat/v1/rooms/room_a/presence/member_b"), {
        connected: true,
        lastSeen: Date.now(),
      }),
    );
    await assertFails(
      set(ref(memberDatabase, "chat/v1/rooms/room_a/messages/msg_b"), {
        body: "blocked",
      }),
    );
  });

  it("serves public assets and protects raw provider payloads", async () => {
    const storage = environment.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(storageRef(storage, "public/test.txt")));
    await assertFails(
      getBytes(storageRef(storage, "raw/provider/payload.json")),
    );
  });
});
