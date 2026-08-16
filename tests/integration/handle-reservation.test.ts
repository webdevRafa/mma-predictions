import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reserveHandleTransaction } from "../../apps/web/lib/auth/handles.ts";

const emulatorDescribe =
  process.env.RULES_TEST === "1" ? describe : describe.skip;

emulatorDescribe("transactional handle reservation", () => {
  let app: App;
  let firestore: Firestore;

  beforeAll(() => {
    app = initializeApp(
      { projectId: "fightlobby-local" },
      `handle-race-${Date.now()}`,
    );
    firestore = getFirestore(app);
  });

  afterAll(async () => deleteApp(app));

  it("allows exactly one owner when two accounts race for a handle", async () => {
    const suffix = Date.now().toString(36);
    const uids = [`racer_a_${suffix}`, `racer_b_${suffix}`];
    const handle = `race_${suffix}`.slice(0, 20);
    await Promise.all(
      uids.flatMap((uid) => [
        firestore.collection("users").doc(uid).set({
          uid,
          accountStatus: "active",
          termsVersion: "pending",
        }),
        firestore.collection("profiles").doc(uid).set({ uid }),
      ]),
    );

    const results = await Promise.allSettled(
      uids.map((uid) => reserveHandleTransaction(firestore, uid, handle, true)),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const reservation = await firestore.collection("handles").doc(handle).get();
    expect(uids).toContain(reservation.get("uid"));
  });

  it("does not let a banned account reserve a handle", async () => {
    const suffix = Date.now().toString(36);
    const uid = `banned_${suffix}`;
    const handle = `blocked_${suffix}`.slice(0, 20);
    await Promise.all([
      firestore.collection("users").doc(uid).set({
        uid,
        accountStatus: "banned",
        termsVersion: "pending",
      }),
      firestore.collection("profiles").doc(uid).set({ uid }),
    ]);

    await expect(
      reserveHandleTransaction(firestore, uid, handle, true),
    ).rejects.toMatchObject({ code: "account_banned", status: 403 });
    expect(
      (await firestore.collection("handles").doc(handle).get()).exists,
    ).toBe(false);
  });
});
