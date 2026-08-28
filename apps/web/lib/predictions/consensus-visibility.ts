interface ConsensusFightState {
  status: unknown;
  result?: unknown;
}

export function hasPostedOfficialResult(fight: ConsensusFightState) {
  if (fight.status !== "completed") return false;
  if (!fight.result || typeof fight.result !== "object") return false;
  return (fight.result as Record<string, unknown>).official === true;
}

export function shouldRevealConsensus({
  fight,
  hasOwnPrediction,
}: {
  fight: ConsensusFightState;
  hasOwnPrediction: boolean;
}) {
  return hasOwnPrediction || hasPostedOfficialResult(fight);
}
