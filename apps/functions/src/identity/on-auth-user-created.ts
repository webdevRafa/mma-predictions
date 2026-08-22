import { FieldValue } from "firebase-admin/firestore";
import { auth as authV1 } from "firebase-functions/v1";

import { getAdminServices } from "../lib/firebase/admin.js";

export const onAuthUserCreated = authV1.user().onCreate(async (user) => {
  const { firestore } = getAdminServices();
  const userRef = firestore.collection("users").doc(user.uid);
  const profileRef = firestore.collection("profiles").doc(user.uid);
  await firestore.runTransaction(async (transaction) => {
    const [privateUser, profile] = await Promise.all([
      transaction.get(userRef),
      transaction.get(profileRef),
    ]);
    if (!privateUser.exists) {
      transaction.create(userRef, {
        uid: user.uid,
        accountStatus: "active",
        roles: ["member"],
        termsVersion: "pending",
        onboardingComplete: false,
        preferences: {},
        moderation: { trustLevel: 0 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (!profile.exists) {
      transaction.create(profileRef, {
        uid: user.uid,
        handleHistory: [],
        joinedAt: FieldValue.serverTimestamp(),
        stats: {
          gradedPicks: 0,
          correctWinners: 0,
          winnerAccuracy: 0,
          totalPoints: 0,
          exactPicks: 0,
          currentStreak: 0,
          longestStreak: 0,
          eventChampionships: 0,
        },
        badges: [],
        profileVisibility: "limited",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
});
