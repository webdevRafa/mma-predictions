import type {
  FightResult,
  PredictionMethod,
  PredictionPick,
} from "../types/domain.ts";

export const SCORING_VERSION = 1;

export type PredictionScore =
  | {
      status: "void";
      reason: "unofficial" | "no_winner" | "void_result";
      points: 0;
    }
  | {
      status: "graded";
      winnerCorrect: boolean;
      methodCorrect: boolean;
      detailCorrect: boolean;
      points: number;
    };

function resultMethodGroup(result: FightResult): PredictionMethod | null {
  if (result.method === "ko_tko" || result.method === "submission")
    return result.method;
  if (
    result.method === "decision_unanimous" ||
    result.method === "decision_split" ||
    result.method === "decision_majority"
  )
    return "decision";
  return null;
}

function resultDetail(result: FightResult) {
  if (result.method === "ko_tko" || result.method === "submission")
    return result.round;
  if (result.method === "decision_unanimous") return "unanimous" as const;
  if (result.method === "decision_split") return "split" as const;
  if (result.method === "decision_majority") return "majority" as const;
  return undefined;
}

export function scorePredictionV1(
  pick: PredictionPick,
  result: FightResult,
): PredictionScore {
  if (!result.official)
    return { status: "void", reason: "unofficial", points: 0 };
  if (!result.winnerFighterId)
    return { status: "void", reason: "no_winner", points: 0 };
  const method = resultMethodGroup(result);

  const winnerCorrect = pick.winnerFighterId === result.winnerFighterId;
  if (!winnerCorrect) {
    return {
      status: "graded",
      winnerCorrect: false,
      methodCorrect: false,
      detailCorrect: false,
      points: 0,
    };
  }
  const methodCorrect = method !== null && pick.method === method;
  const expectedDetail = resultDetail(result);
  const detailCorrect =
    methodCorrect &&
    expectedDetail !== undefined &&
    pick.detail === expectedDetail;
  return {
    status: "graded",
    winnerCorrect: true,
    methodCorrect,
    detailCorrect,
    points: 5 + (methodCorrect ? 3 : 0) + (detailCorrect ? 2 : 0),
  };
}
