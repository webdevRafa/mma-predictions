import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseArticleCollection } from "@fightlobby/domain";
import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import {
  Timestamp,
  getFirestore,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";

const expectedProjectId = "mma-cortex";
const protectedCollections = ["events", "fights", "predictions"] as const;

async function countCollection(firestore: Firestore, collection: string) {
  const snapshot = await firestore.collection(collection).count().get();
  return snapshot.data().count;
}

async function protectedCounts(firestore: Firestore) {
  const counts = await Promise.all(
    protectedCollections.map((collection) =>
      countCollection(firestore, collection),
    ),
  );
  return Object.fromEntries(
    protectedCollections.map((collection, index) => [
      collection,
      counts[index]!,
    ]),
  ) as Record<(typeof protectedCollections)[number], number>;
}

function existingText(snapshot: DocumentSnapshot, field: string) {
  const data: unknown = snapshot.data();
  if (!data || typeof data !== "object") return "";
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

async function main() {
  const articleFilename = process.argv[2];
  if (!articleFilename)
    throw new Error(
      "Usage: pnpm import:production:articles -- <articles.json>",
    );

  const articleValue = await readFile(path.resolve(articleFilename), "utf8");
  const rawArticles: unknown = JSON.parse(articleValue);
  const articles = parseArticleCollection(rawArticles);
  if (new Set(articles.map((article) => article.id)).size !== articles.length)
    throw new Error("Article IDs must be unique within the import file.");
  if (new Set(articles.map((article) => article.slug)).size !== articles.length)
    throw new Error("Article slugs must be unique within the import file.");
  if (process.env.FIGHTLOBBY_PRODUCTION_PROJECT_ID !== expectedProjectId)
    throw new Error(
      `Set FIGHTLOBBY_PRODUCTION_PROJECT_ID=${expectedProjectId} before inspecting or changing production`,
    );

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: expectedProjectId,
  });

  try {
    const firestore = getFirestore(app);
    const articleReferences = articles.map((article) =>
      firestore.collection("articles").doc(article.id),
    );
    const [articleSnapshots, slugSnapshots, articleCountBefore, countsBefore] =
      await Promise.all([
        Promise.all(articleReferences.map((reference) => reference.get())),
        Promise.all(
          articles.map((article) =>
            firestore
              .collection("articles")
              .where("slug", "==", article.slug)
              .limit(1)
              .get(),
          ),
        ),
        countCollection(firestore, "articles"),
        protectedCounts(firestore),
      ]);

    articleSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;
      const incoming = articles[index]!;
      const existingSlug = existingText(snapshot, "slug");
      if (existingSlug && existingSlug !== incoming.slug)
        throw new Error(
          `Article ID ${incoming.id} already owns slug ${existingSlug}; refusing to replace its identity.`,
        );
    });
    slugSnapshots.forEach((snapshot, index) => {
      const incoming = articles[index]!;
      const owner = snapshot.docs[0];
      if (owner && owner.id !== incoming.id)
        throw new Error(
          `Article slug ${incoming.slug} already belongs to ${owner.id}; refusing to overwrite it.`,
        );
    });

    const createCount = articleSnapshots.filter(
      (snapshot) => !snapshot.exists,
    ).length;
    const updateCount = articles.length - createCount;
    const confirmation = `UPSERT ARTICLES ${articles.length}`;
    console.log(
      JSON.stringify(
        {
          projectId: expectedProjectId,
          operation: "merge_only_no_deletes",
          source: path.basename(articleFilename),
          articles: articles.length,
          create: createCount,
          update: updateCount,
          slugs: articles.map((article) => article.slug),
          preservedBeforeWrite: countsBefore,
        },
        null,
        2,
      ),
    );

    if (process.env.FIGHTLOBBY_PRODUCTION_IMPORT_CONFIRM !== confirmation) {
      console.log("Dry run only. No production data changed.");
      console.log(
        `To execute, set FIGHTLOBBY_PRODUCTION_IMPORT_CONFIRM=${JSON.stringify(confirmation)}`,
      );
      return;
    }

    const importedAt = Timestamp.now();
    const auditReference = firestore.collection("auditLogs").doc();
    const importReference = firestore.collection("manualImports").doc();
    const batch = firestore.batch();
    articles.forEach((article, index) =>
      batch.set(articleReferences[index]!, article, { merge: true }),
    );
    batch.create(importReference, {
      id: importReference.id,
      actorUid: "production-article-import-script",
      reason: "Publish the reviewed FightLobby editorial launch collection",
      sourceFile: path.basename(articleFilename),
      articleIds: articles.map((article) => article.id),
      status: "complete",
      createdAt: importedAt,
    });
    batch.create(auditReference, {
      id: auditReference.id,
      actorUid: "production-article-import-script",
      action: "upsert_articles",
      targetType: "article_collection",
      targetId: "fightlobby-editorial-launch",
      reason:
        "Create or update reviewed editorial records without deleting production data",
      before: { articleCount: articleCountBefore, ...countsBefore },
      after: {
        articleIds: articles.map((article) => article.id),
        createCount,
        updateCount,
      },
      metadata: { importId: importReference.id },
      createdAt: importedAt,
    });
    await batch.commit();

    const [verifiedArticles, articleCountAfter, countsAfter] =
      await Promise.all([
        Promise.all(articleReferences.map((reference) => reference.get())),
        countCollection(firestore, "articles"),
        protectedCounts(firestore),
      ]);
    verifiedArticles.forEach((snapshot, index) => {
      const incoming = articles[index]!;
      if (
        !snapshot.exists ||
        existingText(snapshot, "slug") !== incoming.slug ||
        existingText(snapshot, "status") !== incoming.status
      )
        throw new Error(
          `Post-import verification failed for article ${incoming.id}.`,
        );
    });
    if (articleCountAfter !== articleCountBefore + createCount)
      throw new Error(
        "The article collection count changed by an unexpected amount after import.",
      );
    if (JSON.stringify(countsAfter) !== JSON.stringify(countsBefore))
      throw new Error(
        "A protected collection count changed during article import. Inspect production before continuing.",
      );

    console.log(
      JSON.stringify(
        {
          status: "complete",
          importedArticles: articles.length,
          created: createCount,
          updated: updateCount,
          articlesBefore: articleCountBefore,
          articlesAfter: articleCountAfter,
          protectedCollectionsPreserved: countsAfter,
        },
        null,
        2,
      ),
    );
  } finally {
    await deleteApp(app);
  }
}

void main();
