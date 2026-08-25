import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

import type { ArticleRepository } from "./article-repository";
import { FirestoreArticleRepository } from "./firestore-article-repository";
import { FixtureArticleRepository } from "./fixture-article-repository";

let repository: ArticleRepository | undefined;

export function getArticleRepository(): ArticleRepository {
  if (repository) return repository;
  repository =
    process.env.FIGHTLOBBY_DATA_SOURCE === "firestore"
      ? new FirestoreArticleRepository(getFirebaseAdmin().firestore)
      : new FixtureArticleRepository();
  return repository;
}
