import { onRequest } from "firebase-functions/v2/https";

export { onAuthUserCreated } from "./identity/on-auth-user-created.js";

export const health = onRequest({ cors: false }, (_request, response) => {
  response.status(200).json({ service: "fightlobby-functions", status: "ok" });
});
