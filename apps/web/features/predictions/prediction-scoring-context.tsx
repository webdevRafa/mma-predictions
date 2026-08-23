"use client";

import type { PredictionGrade } from "@fightlobby/domain";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type PredictionScoringLookupState = "loading" | "ready" | "error";

export interface PredictionScoringState {
  lookupState: PredictionScoringLookupState;
  canSubmit: boolean;
  hasPrediction: boolean;
  grade?: PredictionGrade;
}

interface PredictionScoringContextValue {
  state: PredictionScoringState;
  setState: Dispatch<SetStateAction<PredictionScoringState>>;
}

const PredictionScoringContext =
  createContext<PredictionScoringContextValue | null>(null);

export function PredictionScoringProvider({
  children,
  initialCanSubmit,
}: {
  children: ReactNode;
  initialCanSubmit: boolean;
}) {
  const [state, setState] = useState<PredictionScoringState>({
    lookupState: "loading",
    canSubmit: initialCanSubmit,
    hasPrediction: false,
  });
  const value = useMemo(() => ({ state, setState }), [state]);

  return (
    <PredictionScoringContext.Provider value={value}>
      {children}
    </PredictionScoringContext.Provider>
  );
}

export function usePredictionScoring() {
  const value = useContext(PredictionScoringContext);
  if (!value) {
    throw new Error(
      "Prediction scoring state must be used inside PredictionScoringProvider",
    );
  }
  return value;
}
