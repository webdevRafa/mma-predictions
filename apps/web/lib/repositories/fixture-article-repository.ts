import { parseArticleCollection } from "@fightlobby/domain";

import articles from "../../../../imports/articles/fightlobby-editorial-launch.json";
import type { ArticleRepository } from "./article-repository";

const publishedArticles = parseArticleCollection(articles)
  .filter((article) => article.status === "published")
  .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

export class FixtureArticleRepository implements ArticleRepository {
  listPublished() {
    return Promise.resolve(structuredClone(publishedArticles));
  }

  getPublishedBySlug(slug: string) {
    const article = publishedArticles.find(
      (candidate) =>
        candidate.slug === slug || candidate.slugHistory.includes(slug),
    );
    return Promise.resolve(article ? structuredClone(article) : null);
  }
}
