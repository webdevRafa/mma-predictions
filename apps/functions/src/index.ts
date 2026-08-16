import { onRequest } from "firebase-functions/v2/https";

export { onAuthUserCreated } from "./identity/on-auth-user-created.js";
export {
  applyUserSanction,
  closeExpiredChatRooms,
  expireUserSanctions,
  removeChatMessage,
} from "./chat/moderation-admin.js";
export {
  gradeFightPredictions,
  regradeFightPredictions,
} from "./grading/grade-fight-predictions.js";
export { lockFightPredictions } from "./predictions/lock-fight-predictions.js";

export const health = onRequest({ cors: false }, (_request, response) => {
  response.status(200).json({ service: "fightlobby-functions", status: "ok" });
});
