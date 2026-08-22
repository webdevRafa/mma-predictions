import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDiscussionPostCore,
  listFightDiscussionCore,
  reportDiscussionPostCore,
  type DiscussionMemberContext,
} from "../../apps/web/lib/discussions/server.ts";

const emulatorDescribe =
  process.env.RULES_TEST === "1" ? describe : describe.skip;

emulatorDescribe("persistent matchup posts and replies", () => {
  let app: App;
  let firestore: Firestore;

  beforeAll(() => {
    app = initializeApp(
      { projectId: "fightlobby-local" },
      `discussion-flow-${Date.now()}`,
    );
    firestore = getFirestore(app);
  });

  afterAll(async () => deleteApp(app));

  it("publishes isolated root threads, nested replies, and reports", async () => {
    const suffix = Date.now().toString(36);
    const fightId = `fgt_discussion_${suffix}`;
    const uid = `discussion_member_${suffix}`;
    const reporterUid = `discussion_reporter_${suffix}`;
    const now = 1_800_000_000_000;
    const member: DiscussionMemberContext = {
      uid,
      emailVerified: true,
      onboardingComplete: true,
      accountStatus: "active",
      roles: ["trusted"],
      handle: `analyst_${suffix}`.slice(0, 20),
    };
    await Promise.all([
      firestore.collection("featureFlags").doc("current").set({
        discussionEnabled: true,
        discussionPostingEnabled: true,
      }),
      firestore.collection("fights").doc(fightId).set({ id: fightId }),
      firestore
        .collection("users")
        .doc(uid)
        .set({
          uid,
          accountStatus: "active",
          roles: ["trusted"],
          moderation: { trustLevel: 2 },
        }),
      firestore.collection("profiles").doc(uid).set({
        uid,
        handle: member.handle,
      }),
    ]);

    const root = await createDiscussionPostCore(firestore, member, {
      fightId,
      body: "The pressure battle along the fence decides this matchup.",
      clientNonce: "10000000-0000-4000-8000-000000000001",
      nowMilliseconds: now,
    });
    expect(root).toMatchObject({
      idempotent: false,
      post: { fightId, status: "published", replyCount: 0 },
    });

    const replay = await createDiscussionPostCore(firestore, member, {
      fightId,
      body: "The pressure battle along the fence decides this matchup.",
      clientNonce: "10000000-0000-4000-8000-000000000001",
      nowMilliseconds: now + 1_000,
    });
    expect(replay.idempotent).toBe(true);

    const reply = await createDiscussionPostCore(firestore, member, {
      fightId,
      body: "Agreed. The first clean exit could set the pace.",
      clientNonce: "20000000-0000-4000-8000-000000000002",
      rootPostId: root.post.id,
      parentPostId: root.post.id,
      nowMilliseconds: now + 6_000,
    });
    expect(reply.post).toMatchObject({
      rootPostId: root.post.id,
      parentPostId: root.post.id,
      replyTo: { handle: member.handle },
    });

    const page = await listFightDiscussionCore(firestore, fightId);
    expect(page.threads).toHaveLength(1);
    expect(page.threads[0]).toMatchObject({
      post: { id: root.post.id, replyCount: 1 },
      replies: [{ id: reply.post.id }],
    });
    expect(
      await firestore.collection("chatRooms").doc(fightId).get(),
    ).toMatchObject({ exists: false });

    const report = await reportDiscussionPostCore(firestore, reporterUid, {
      fightId,
      postId: reply.post.id,
      rootPostId: root.post.id,
      reason: "other",
      note: "Needs moderator review",
    });
    expect(report.duplicate).toBe(false);
    expect(
      (await firestore.collection("reports").doc(report.reportId).get()).get(
        "type",
      ),
    ).toBe("discussion_post");
  });
});
