import type { ResultMethod } from "@fightlobby/domain";

export interface QuickResultValue {
  winnerFighterId?: string;
  method: ResultMethod;
  round?: number;
  official: true;
}

export interface QuickResultOption {
  id: string;
  label: string;
  result: QuickResultValue;
}

export interface QuickResultGroup {
  label: string;
  options: QuickResultOption[];
}

export interface QuickResultFight {
  fighterAId: string;
  fighterAName: string;
  fighterBId: string;
  fighterBName: string;
  scheduledRounds: number;
}

export interface ExistingQuickResult {
  winnerFighterId?: string;
  method?: string;
  round?: number;
  official?: boolean;
}

const decisionMethods = [
  ["decision_unanimous", "Unanimous decision"],
  ["decision_split", "Split decision"],
  ["decision_majority", "Majority decision"],
] as const satisfies ReadonlyArray<readonly [ResultMethod, string]>;

function winnerOptions(
  fighterId: string,
  fighterName: string,
  scheduledRounds: number,
): QuickResultOption[] {
  const rounds = Array.from(
    { length: Math.max(1, Math.min(5, scheduledRounds)) },
    (_, index) => index + 1,
  );
  const stoppages = (
    [
      ["ko_tko", "KO/TKO"],
      ["submission", "Submission"],
    ] as const satisfies ReadonlyArray<readonly [ResultMethod, string]>
  ).flatMap(([method, label]) =>
    rounds.map((round) => ({
      id: `${fighterId}:${method}:${round}`,
      label: `${fighterName} — ${label}, round ${round}`,
      result: {
        winnerFighterId: fighterId,
        method,
        round,
        official: true as const,
      },
    })),
  );
  const decisions = decisionMethods.map(([method, label]) => ({
    id: `${fighterId}:${method}`,
    label: `${fighterName} — ${label}`,
    result: {
      winnerFighterId: fighterId,
      method,
      official: true as const,
    },
  }));
  return [
    ...stoppages,
    ...decisions,
    {
      id: `${fighterId}:dq`,
      label: `${fighterName} — Disqualification`,
      result: {
        winnerFighterId: fighterId,
        method: "dq",
        official: true,
      },
    },
    {
      id: `${fighterId}:other`,
      label: `${fighterName} — Other result`,
      result: {
        winnerFighterId: fighterId,
        method: "other",
        official: true,
      },
    },
  ];
}

export function quickResultGroups(fight: QuickResultFight): QuickResultGroup[] {
  return [
    {
      label: `${fight.fighterAName} wins`,
      options: winnerOptions(
        fight.fighterAId,
        fight.fighterAName,
        fight.scheduledRounds,
      ),
    },
    {
      label: `${fight.fighterBName} wins`,
      options: winnerOptions(
        fight.fighterBId,
        fight.fighterBName,
        fight.scheduledRounds,
      ),
    },
    {
      label: "No winner",
      options: [
        {
          id: "no-winner:draw",
          label: "Draw",
          result: { method: "draw", official: true },
        },
        {
          id: "no-winner:no_contest",
          label: "No contest",
          result: { method: "no_contest", official: true },
        },
        {
          id: "no-winner:overturned",
          label: "Overturned result",
          result: { method: "overturned", official: true },
        },
      ],
    },
  ];
}

export function findQuickResultOption(
  fight: QuickResultFight,
  optionId: string,
) {
  return quickResultGroups(fight)
    .flatMap((group) => group.options)
    .find((option) => option.id === optionId);
}

export function describeQuickResult(
  fight: QuickResultFight,
  result: ExistingQuickResult | undefined,
) {
  if (!result?.method) return undefined;
  const exact = quickResultGroups(fight)
    .flatMap((group) => group.options)
    .find(
      (option) =>
        option.result.winnerFighterId === result.winnerFighterId &&
        option.result.method === result.method &&
        option.result.round === result.round,
    );
  if (exact) return exact.label;
  return result.method.replaceAll("_", " ");
}
