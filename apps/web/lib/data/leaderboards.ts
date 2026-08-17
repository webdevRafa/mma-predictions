import "server-only";

import { cache } from "react";

import { getLeaderboardRepository } from "@/lib/repositories/leaderboards";

export const listLeaderboards = cache(() =>
  getLeaderboardRepository().listBoards(),
);
