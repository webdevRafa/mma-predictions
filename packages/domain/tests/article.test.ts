import { describe, expect, it } from "vitest";

import { parseArticle } from "../src/index.ts";

const article = {
  id: "art_test_story",
  slug: "test-story",
  slugHistory: [],
  title: "A properly structured FightLobby test story",
  dek: "A concise standfirst that gives readers enough context to continue.",
  excerpt: "A concise archive excerpt that explains why this story matters.",
  category: "fight_analysis",
  tags: ["UFC", "analysis"],
  status: "published",
  publishedAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
  readingMinutes: 4,
  author: {
    id: "fightlobby_editorial",
    handle: "fight_lobby",
    displayName: "FightLobby Editorial",
    role: "editorial",
  },
  body: [
    { id: "p1", type: "paragraph", text: "First paragraph." },
    { id: "h1", type: "heading", text: "The matchup" },
    { id: "p2", type: "paragraph", text: "Second paragraph." },
    { id: "p3", type: "paragraph", text: "Third paragraph." },
    { id: "p4", type: "paragraph", text: "Fourth paragraph." },
  ],
  sources: [
    {
      label: "Official UFC event page",
      url: "https://www.ufc.com/event/example",
      publisher: "UFC",
      accessedAt: "2026-08-25T12:00:00.000Z",
    },
  ],
  relatedEventIds: [],
  relatedFightIds: [],
  featured: false,
  monetizationEligible: true,
  seo: {
    title: "A properly structured FightLobby test story",
    description:
      "A sufficiently descriptive search summary for the structured FightLobby article fixture used by the domain test suite.",
    canonicalPath: "/articles/test-story",
    keywords: ["UFC analysis", "FightLobby"],
  },
};

describe("article schema", () => {
  it("accepts a fully structured published article", () => {
    expect(parseArticle(article)).toEqual(article);
  });

  it("keeps canonical paths tied to stable slugs", () => {
    expect(() =>
      parseArticle({
        ...article,
        seo: { ...article.seo, canonicalPath: "/articles/different-story" },
      }),
    ).toThrow(/Canonical path/);
  });

  it("rejects duplicate body block identifiers", () => {
    expect(() =>
      parseArticle({
        ...article,
        body: [article.body[0], article.body[0], ...article.body.slice(2)],
      }),
    ).toThrow(/block IDs/);
  });
});
