import { z } from "zod";

export const eventStatusSchema = z.enum([
  "draft",
  "scheduled",
  "live",
  "completed",
  "canceled",
  "postponed",
]);
export const fightStatusSchema = z.enum([
  "scheduled",
  "prefight",
  "walkouts",
  "intros",
  "in_progress",
  "end_of_round",
  "completed",
  "canceled",
  "postponed",
]);
export const predictionStatusSchema = z.enum([
  "open",
  "locked",
  "grading",
  "graded",
  "void",
]);
export const cardSegmentSchema = z.enum([
  "early_prelims",
  "prelims",
  "main_card",
]);
export const resultMethodSchema = z.enum([
  "ko_tko",
  "submission",
  "decision_unanimous",
  "decision_split",
  "decision_majority",
  "dq",
  "draw",
  "no_contest",
  "overturned",
  "other",
]);
export const predictionMethodSchema = z.enum([
  "ko_tko",
  "submission",
  "decision",
  "other",
]);
export const dataQualitySchema = z.enum([
  "verified",
  "complete",
  "partial",
  "blocked",
]);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const isoDateSchema = z.iso.date();

export const fighterNameSchema = z
  .object({
    full: z.string().trim().min(1).max(100),
    first: z.string().trim().min(1).max(60).optional(),
    last: z.string().trim().min(1).max(60).optional(),
    nickname: z.string().trim().min(1).max(80).optional(),
    normalized: z.string().trim().min(1).max(120),
  })
  .strict();

export const fighterRecordSchema = z
  .object({
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    draws: z.number().int().nonnegative(),
    noContests: z.number().int().nonnegative(),
  })
  .strict();

export const careerStatsSchema = z
  .object({
    significantStrikesLandedPerMinute: z.number().nonnegative().optional(),
    significantStrikeAccuracy: z.number().min(0).max(1).optional(),
    significantStrikeDefense: z.number().min(0).max(1).optional(),
    takedownsPer15: z.number().nonnegative().optional(),
    takedownAccuracy: z.number().min(0).max(1).optional(),
    takedownDefense: z.number().min(0).max(1).optional(),
    submissionsPer15: z.number().nonnegative().optional(),
  })
  .strict();

export const predictionPickSchema = z
  .object({
    winnerFighterId: z.string().trim().min(1),
    method: predictionMethodSchema,
    detail: z
      .union([
        z.number().int().min(1).max(5),
        z.enum(["unanimous", "split", "majority"]),
      ])
      .optional(),
    confidence: z.number().int().min(50).max(100),
  })
  .strict()
  .superRefine((pick, context) => {
    if (
      (pick.method === "ko_tko" || pick.method === "submission") &&
      typeof pick.detail !== "number"
    ) {
      context.addIssue({
        code: "custom",
        path: ["detail"],
        message: "Finish round is required for KO/TKO or submission picks",
      });
    }
    if (
      pick.method === "decision" &&
      !["unanimous", "split", "majority"].includes(String(pick.detail))
    ) {
      context.addIssue({
        code: "custom",
        path: ["detail"],
        message: "Decision subtype is required for decision picks",
      });
    }
    if (pick.method === "other" && pick.detail !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["detail"],
        message: "Other picks cannot include a finish detail",
      });
    }
  });
