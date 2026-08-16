import type { Fight, Fighter } from "@fightlobby/domain";

export function isFightIndexable(fight: Fight, fighters: Fighter[]) {
  return (
    fight.dataQuality !== "blocked" &&
    fight.editorial.status === "published" &&
    fighters.length === 2 &&
    fighters.every((fighter) =>
      Boolean(
        fighter.careerStats && Object.keys(fighter.careerStats).length >= 3,
      ),
    )
  );
}

export function isFighterIndexable(fighter: Fighter) {
  return (
    fighter.dataQuality !== "blocked" &&
    fighter.record.wins + fighter.record.losses + fighter.record.draws > 0 &&
    Boolean(fighter.currentWeightClass)
  );
}
