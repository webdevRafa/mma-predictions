import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { getArticleRepository } from "@/lib/repositories/articles";

const listPublishedArticlesCached = unstable_cache(
  () => getArticleRepository().listPublished(),
  ["published-articles-v1"],
  { revalidate: 300, tags: ["articles", "public-data"] },
);

const getPublishedArticleCached = unstable_cache(
  (slug: string) => getArticleRepository().getPublishedBySlug(slug),
  ["published-article-v1"],
  { revalidate: 300, tags: ["articles", "public-data"] },
);

export const listPublishedArticles = cache(listPublishedArticlesCached);
export const getPublishedArticle = cache(getPublishedArticleCached);
