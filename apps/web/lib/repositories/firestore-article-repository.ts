import "server-only";

import { articleSchema, type Article } from "@fightlobby/domain";
import type {
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { serializeFirestoreValue } from "./firestore-serialization";
import type { ArticleRepository } from "./article-repository";

function parseArticleDocument(snapshot: QueryDocumentSnapshot) {
  const parsed = articleSchema.safeParse(
    serializeFirestoreValue(snapshot.data()),
  );
  if (!parsed.success)
    throw new Error(
      `Invalid ${snapshot.ref.path}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ")}`,
    );
  return parsed.data;
}

function isIndexBuilding(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 9
  );
}

function newestFirst(articles: Article[]) {
  return articles.sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime(),
  );
}

export class FirestoreArticleRepository implements ArticleRepository {
  constructor(private readonly firestore: Firestore) {}

  async listPublished() {
    try {
      const snapshot = await this.firestore
        .collection("articles")
        .where("status", "==", "published")
        .orderBy("publishedAt", "desc")
        .limit(60)
        .get();
      return snapshot.docs.map(parseArticleDocument);
    } catch (error) {
      if (!isIndexBuilding(error)) throw error;
      const snapshot = await this.firestore
        .collection("articles")
        .where("status", "==", "published")
        .limit(60)
        .get();
      return newestFirst(snapshot.docs.map(parseArticleDocument));
    }
  }

  async getPublishedBySlug(slug: string) {
    const direct = await this.firestore
      .collection("articles")
      .where("slug", "==", slug)
      .limit(1)
      .get();
    const snapshot =
      direct.docs[0] ??
      (
        await this.firestore
          .collection("articles")
          .where("slugHistory", "array-contains", slug)
          .limit(1)
          .get()
      ).docs[0];
    if (!snapshot) return null;
    const article = parseArticleDocument(snapshot);
    return article.status === "published" ? article : null;
  }
}
