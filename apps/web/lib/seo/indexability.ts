import type {
  Article,
  Event,
  Fight,
  Fighter,
  PublicProfile,
} from "@fightlobby/domain";

export function isArticleIndexable(article: Article) {
  const wordCount = article.body.reduce((total, block) => {
    const text =
      block.type === "bullet_list" ? block.items.join(" ") : block.text;
    return total + text.trim().split(/\s+/).length;
  }, 0);
  return (
    article.status === "published" &&
    article.monetizationEligible &&
    article.sources.length > 0 &&
    wordCount >= 350
  );
}

export function isEventIndexable(event: Event, fights: Fight[]) {
  return (
    event.status !== "draft" &&
    event.dataQuality !== "blocked" &&
    event.monetizationEligible &&
    event.editorial?.status === "published" &&
    Boolean(event.editorial.summary && event.editorial.summary.length >= 60) &&
    fights.length > 0 &&
    fights.every(
      (fight) =>
        fight.eventId === event.id &&
        fight.fighterAId !== fight.fighterBId &&
        Boolean(fight.weightClass),
    )
  );
}

export function isFightIndexable(fight: Fight, fighters: Fighter[]) {
  return (
    fight.dataQuality !== "blocked" &&
    fight.monetizationEligible &&
    fight.editorial.status === "published" &&
    fighters.length === 2 &&
    fighters.every((fighter) =>
      Boolean(
        fighter.careerStats && Object.keys(fighter.careerStats).length >= 3,
      ),
    )
  );
}

export function isProfileIndexable(profile: PublicProfile) {
  return (
    profile.profileVisibility === "public" && profile.stats.gradedPicks >= 5
  );
}

export function isFighterIndexable(fighter: Fighter) {
  return (
    fighter.dataQuality !== "blocked" &&
    fighter.record.wins + fighter.record.losses + fighter.record.draws > 0 &&
    Boolean(fighter.currentWeightClass)
  );
}
