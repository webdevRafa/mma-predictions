import type { ArticleCategory } from "@fightlobby/domain";

const categoryLabels: Record<ArticleCategory, string> = {
  event_guide: "Event guide",
  fight_analysis: "Fight analysis",
  division_analysis: "Division analysis",
  prospects: "Prospects",
  news_analysis: "News analysis",
  feature: "Feature",
};

export function articleCategoryLabel(category: ArticleCategory) {
  return categoryLabels[category];
}

export function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}
