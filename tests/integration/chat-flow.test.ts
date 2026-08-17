import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import {
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  postChatMessageCore,
  reportChatMessageCore,
  setBlockedUserCore,
  type ChatMemberContext,
} from "../../apps/web/lib/chat/server.ts";
import { closeExpiredChatRoomsCore } from "../../apps/functions/src/chat/moderation-admin.ts";

const emulatorDescribe =
  process.env.RULES_TEST === "1" ? describe : describe.skip;

emulatorDescribe("chat publication, abuse controls, and reports", () => {
  let app: App;
  let firestore: Firestore;
  let database: Database;

  beforeAll(() => {
    app = initializeApp(
      {
        projectId: "fightlobby-local",
        databaseURL: "http://127.0.0.1:9000?ns=fightlobby-local",
      },
      `chat-flow-${Date.now()}`,
    );
    firestore = getFirestore(app);
    database = getDatabase(app);
  });

  afterAll(async () => deleteApp(app));

  it("deduplicates, rate limits, supports replies, and rejects closed access", async () => {
    const suffix = Date.now().toString(36);
    const roomId = `fight_chat_${suffix}`;
    const uid = `chat_member_${suffix}`;
    const reporterUid = `chat_reporter_${suffix}`;
    const now = 1_800_000_000_000;
    const member: ChatMemberContext = {
      uid,
      emailVerified: true,
      onboardingComplete: true,
      accountStatus: "active",
      roles: ["member"],
      handle: `member_${suffix}`.slice(0, 20),
    };
    await Promise.all([
      firestore.collection("featureFlags").doc("current").set({
        chatEnabled: true,
        chatPostingEnabled: true,
      }),
      firestore
        .collection("chatRooms")
        .doc(roomId)
        .set({
          id: roomId,
          status: "open",
          opensAt: Timestamp.fromMillis(now - 60_000),
          writableUntil: Timestamp.fromMillis(now + 3_600_000),
          slowModeSeconds: 0,
          messageCount: 0,
        }),
      firestore
        .collection("users")
        .doc(uid)
        .set({
          uid,
          accountStatus: "active",
          roles: ["member"],
          moderation: { trustLevel: 0 },
        }),
      firestore
        .collection("profiles")
        .doc(uid)
        .set({
          uid,
          handle: member.handle,
          avatar: { version: 0 },
        }),
    ]);

    const first = await postChatMessageCore(firestore, database, member, {
      roomId,
      body: "That counter left hook was clean.",
      clientNonce: "10000000-0000-4000-8000-000000000001",
      nowMilliseconds: now,
    });
    expect(first).toMatchObject({
      idempotent: false,
      message: { status: "published", author: { handle: member.handle } },
    });

    const replay = await postChatMessageCore(firestore, database, member, {
      roomId,
      body: "That counter left hook was clean.",
      clientNonce: "10000000-0000-4000-8000-000000000001",
      nowMilliseconds: now + 1_000,
    });
    expect(replay).toMatchObject({ idempotent: true });
    expect(
      (await firestore.collection("chatRooms").doc(roomId).get()).get(
        "messageCount",
      ),
    ).toBe(1);

    await expect(
      postChatMessageCore(firestore, database, member, {
        roomId,
        body: "That counter left hook was clean.",
        clientNonce: "20000000-0000-4000-8000-000000000002",
        nowMilliseconds: now + 16_000,
      }),
    ).rejects.toMatchObject({ code: "chat_duplicate", status: 429 });

    const second = await postChatMessageCore(firestore, database, member, {
      roomId,
      body: "The body work is changing the pace.",
      clientNonce: "30000000-0000-4000-8000-000000000003",
      nowMilliseconds: now + 16_000,
    });
    const reply = await postChatMessageCore(firestore, database, member, {
      roomId,
      body: "Agreed — watch the next level change.",
      clientNonce: "40000000-0000-4000-8000-000000000004",
      replyToMessageId: second.message.id,
      nowMilliseconds: now + 32_000,
    });
    expect(reply.message.replyTo).toMatchObject({
      messageId: second.message.id,
      handle: member.handle,
    });

    const report = await reportChatMessageCore(
      firestore,
      database,
      reporterUid,
      {
        roomId,
        messageId: first.message.id,
        reason: "other",
      },
    );
    expect(report.duplicate).toBe(false);
    expect(
      (await firestore.collection("reports").doc(report.reportId).get()).get(
        "messageSnapshot.body",
      ),
    ).toBe("That counter left hook was clean.");

    await setBlockedUserCore(firestore, reporterUid, uid, true);
    expect(
      (
        await firestore
          .collection("users")
          .doc(reporterUid)
          .collection("blocks")
          .doc(uid)
          .get()
      ).exists,
    ).toBe(true);

    await firestore
      .collection("users")
      .doc(uid)
      .set({ accountStatus: "banned" }, { merge: true });
    await expect(
      postChatMessageCore(firestore, database, member, {
        roomId,
        body: "This must be rejected.",
        clientNonce: "50000000-0000-4000-8000-000000000005",
        nowMilliseconds: now + 60_000,
      }),
    ).rejects.toMatchObject({ code: "chat_banned", status: 403 });

    await Promise.all([
      firestore
        .collection("users")
        .doc(uid)
        .set({ accountStatus: "active" }, { merge: true }),
      firestore
        .collection("chatRooms")
        .doc(roomId)
        .set({ status: "read_only" }, { merge: true }),
    ]);
    await expect(
      postChatMessageCore(firestore, database, member, {
        roomId,
        body: "The room is closed now.",
        clientNonce: "60000000-0000-4000-8000-000000000006",
        nowMilliseconds: now + 80_000,
      }),
    ).rejects.toMatchObject({ code: "chat_read_only", status: 409 });

    const scheduledRoomId = `fight_scheduled_${suffix}`;
    const expiredRoomId = `fight_expired_${suffix}`;
    await Promise.all([
      firestore
        .collection("chatRooms")
        .doc(scheduledRoomId)
        .set({
          id: scheduledRoomId,
          status: "scheduled",
          opensAt: Timestamp.fromMillis(now - 1_000),
          writableUntil: Timestamp.fromMillis(now + 60_000),
        }),
      firestore
        .collection("chatRooms")
        .doc(expiredRoomId)
        .set({
          id: expiredRoomId,
          status: "slow_mode",
          opensAt: Timestamp.fromMillis(now - 60_000),
          writableUntil: Timestamp.fromMillis(now - 1_000),
        }),
    ]);
    await closeExpiredChatRoomsCore(firestore, Timestamp.fromMillis(now));
    expect(
      (await firestore.collection("chatRooms").doc(scheduledRoomId).get()).get(
        "status",
      ),
    ).toBe("open");
    expect(
      (await firestore.collection("chatRooms").doc(expiredRoomId).get()).get(
        "status",
      ),
    ).toBe("read_only");
  });
});
