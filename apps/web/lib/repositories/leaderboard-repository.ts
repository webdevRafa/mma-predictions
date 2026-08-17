import type { Leaderboard } from "@fightlobby/domain";

export interface LeaderboardRepository {
  listBoards(): Promise<Leaderboard[]>;
}
