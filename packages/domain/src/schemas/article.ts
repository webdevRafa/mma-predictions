import { z } from "zod";

import { isoDateTimeSchema } from "./domain.ts";

export const articleStatusSchema = z.enum([
  "draft",
  "review",
  "published",
  "archived",
]);

export const articleCategorySchema = z.enum([
  "event_guide",
  "fight_analysis",
  "division_analysis",
  "prospects",
  "news_analysis",
  "feature",
]);

export const articleAuthorSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    handle: z.string().trim().min(1).max(32),
    displayName: z.string().trim().min(1).max(80),
    role: z.enum(["editorial", "contributor"]),
  })
  .strict();

export const articleSourceSchema = z
  .object({
    label: z.string().trim().min(1).max(180),
    url: z.url({ protocol: /^https?$/ }),
    publisher: z.string().trim().min(1).max(80),
    publishedAt: isoDateTimeSchema.optional(),
    accessedAt: isoDateTimeSchema,
  })
  .strict();

const articleBlockIdSchema = z.string().trim().min(1).max(80);

export const articleBodyBlockSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: articleBlockIdSchema,
      type: z.literal("paragraph"),
      text: z.string().trim().min(1).max(4_000),
    })
    .strict(),
  z
    .object({
      id: articleBlockIdSchema,
      type: z.literal("heading"),
      text: z.string().trim().min(1).max(160),
    })
    .strict(),
  z
    .object({
      id: articleBlockIdSchema,
      type: z.literal("bullet_list"),
      items: z.array(z.string().trim().min(1).max(800)).min(1).max(12),
    })
    .strict(),
  z
    .object({
      id: articleBlockIdSchema,
      type: z.literal("quote"),
      text: z.string().trim().min(1).max(1_000),
      attribution: z.string().trim().min(1).max(120).optional(),
    })
    .strict(),
]);

export const articleSeoSchema = z
  .object({
    title: z.string().trim().min(10).max(70),
    description: z.string().trim().min(50).max(165),
    canonicalPath: z
      .string()
      .trim()
      .regex(/^\/articles\/[a-z0-9-]+$/),
    keywords: z.array(z.string().trim().min(2).max(80)).min(2).max(12),
  })
  .strict();

export const articleSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^art_[a-z0-9_]+$/),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    slugHistory: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      )
      .max(20),
    title: z.string().trim().min(12).max(140),
    dek: z.string().trim().min(40).max(260),
    excerpt: z.string().trim().min(40).max(220),
    category: articleCategorySchema,
    tags: z.array(z.string().trim().min(2).max(60)).min(2).max(12),
    status: articleStatusSchema,
    publishedAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    readingMinutes: z.number().int().min(2).max(30),
    author: articleAuthorSchema,
    body: z.array(articleBodyBlockSchema).min(5).max(80),
    sources: z.array(articleSourceSchema).min(1).max(20),
    relatedEventIds: z.array(z.string().trim().min(1)).max(12),
    relatedFightIds: z.array(z.string().trim().min(1)).max(20),
    featured: z.boolean(),
    monetizationEligible: z.boolean(),
    seo: articleSeoSchema,
  })
  .strict()
  .superRefine((article, context) => {
    if (article.seo.canonicalPath !== `/articles/${article.slug}`)
      context.addIssue({
        code: "custom",
        path: ["seo", "canonicalPath"],
        message: "Canonical path must match the current article slug",
      });
    if (new Date(article.updatedAt) < new Date(article.publishedAt))
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "updatedAt cannot be earlier than publishedAt",
      });
    const blockIds = article.body.map((block) => block.id);
    if (new Set(blockIds).size !== blockIds.length)
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: "Article body block IDs must be unique",
      });
  });

export const articleCollectionSchema = z.array(articleSchema).min(1).max(500);

export function parseArticle(value: unknown) {
  return articleSchema.parse(value);
}

export function parseArticleCollection(value: unknown) {
  return articleCollectionSchema.parse(value);
}
