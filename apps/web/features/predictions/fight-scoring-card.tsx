"use client";

import type { Fight, PredictionGrade } from "@fightlobby/domain";
import { LoaderCircle, Trophy } from "lucide-react";

import { ScoringExplainerCard } from "@/components/predictions/scoring-explainer-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePredictionScoring } from "@/features/predictions/prediction-scoring-context";
import { getMatchScoringPanelMode } from "@/lib/predictions/scoring-state";

function gradeSummary(grade: PredictionGrade) {
  if (!grade.winnerCorrect)
    return "The official result is in. This pick did not score.";
  if (grade.detailCorrect)
    return "Winner, method, and finish detail all matched the official result.";
  if (grade.methodCorrect)
    return "The winner and method matched the official result.";
  return "The winner matched the official result.";
}

export function FightScoringCard({ fight }: { fight: Fight }) {
  const { state } = usePredictionScoring();
  const mode = getMatchScoringPanelMode({
    lookupState: state.lookupState,
    canSubmit: state.canSubmit,
    hasPrediction: state.hasPrediction,
    hasResult: Boolean(fight.result),
    hasGrade: Boolean(state.grade),
  });

  if (mode === "hidden") return null;
  if (mode === "loading") {
    return (
      <Card aria-busy="true" className="p-5 sm:p-6" role="status">
        <span className="sr-only">Checking match scoring status…</span>
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="mt-4 h-7 w-60 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
      </Card>
    );
  }
  if (mode === "explainer") {
    return <ScoringExplainerCard title="Earn up to 10 points for this match" />;
  }
  if (mode === "pending") {
    return (
      <Card className="p-5 sm:p-6" role="status">
        <LoaderCircle
          aria-hidden="true"
          className="animate-spin text-fl-accent"
          size={22}
        />
        <p className="eyebrow mt-4">Official result posted</p>
        <h2 className="mt-2 font-display text-2xl font-bold">
          Scoring your prediction
        </h2>
        <p className="mt-2 text-sm leading-6 text-fl-text-muted">
          Your points will appear here as soon as grading finishes.
        </p>
      </Card>
    );
  }

  const grade = state.grade;
  if (!grade) return null;
  const pointsLabel = `${grade.points} point${grade.points === 1 ? "" : "s"}`;

  return (
    <Card aria-live="polite" className="p-5 sm:p-6">
      <Trophy
        aria-hidden="true"
        className={grade.points > 0 ? "text-fl-success" : "text-fl-text-muted"}
        size={22}
      />
      <p className="eyebrow mt-4">Official score</p>
      <h2 className="mt-2 font-display text-2xl font-bold">
        You earned {pointsLabel} for this match
      </h2>
      <p className="mt-2 text-sm leading-6 text-fl-text-muted">
        {gradeSummary(grade)}
      </p>
    </Card>
  );
}
