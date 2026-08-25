import type { Article } from "@fightlobby/domain";

export interface ArticleRepository {
  listPublished(): Promise<Article[]>;
  getPublishedBySlug(slug: string): Promise<Article | null>;
}
