import "server-only";

import { listPublishedArticles } from "@/lib/data/articles";
import { listPublicCards } from "@/lib/data/public";
import { listPublicProfiles } from "@/lib/data/profiles";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { forumThreadPath } from "@/lib/forum/path";
import { listForumThreadsCore } from "@/lib/forum/server";
import {
  isEventIndexable,
  isFightIndexable,
  isFighterIndexable,
  isArticleIndexable,
  isProfileIndexable,
} from "@/lib/seo/indexability";
import { absoluteUrl } from "@/lib/seo/site";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export function sitemapDocument(entries: { url: string; updatedAt: string }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((entry) => `\n  <url><loc>${escapeXml(entry.url)}</loc><lastmod>${escapeXml(entry.updatedAt)}</lastmod></url>`).join("")}\n</urlset>`;
}

export async function eventSitemapEntries() {
  const cards = await listPublicCards();
  return cards
    .filter((card) => isEventIndexable(card.event, card.fights))
    .map(({ event }) => ({
      url: absoluteUrl(`/events/${event.slug}`),
      updatedAt: event.updatedAt,
    }));
}

export async function fightSitemapEntries() {
  return (await listPublicCards()).flatMap((card) =>
    card.fights
      .filter((fight) =>
        isFightIndexable(
          fight,
          card.fighters.filter(
            (fighter) =>
              fighter.id === fight.fighterAId ||
              fighter.id === fight.fighterBId,
          ),
        ),
      )
      .map((fight) => ({
        url: absoluteUrl(`/fights/${fight.slug}`),
        updatedAt: fight.updatedAt,
      })),
  );
}

export async function fighterSitemapEntries() {
  const fighters = new Map(
    (await listPublicCards())
      .flatMap((card) => card.fighters)
      .map((fighter) => [fighter.id, fighter]),
  );
  return [...fighters.values()].filter(isFighterIndexable).map((fighter) => ({
    url: absoluteUrl(`/fighters/${fighter.slug}`),
    updatedAt: fighter.updatedAt,
  }));
}

export async function profileSitemapEntries() {
  return (await listPublicProfiles())
    .filter(isProfileIndexable)
    .map((profile) => ({
      url: absoluteUrl(`/u/${profile.handleNormalized}`),
      updatedAt: profile.updatedAt,
    }));
}

export async function discussionSitemapEntries() {
  return (await listForumThreadsCore(getFirebaseAdmin().firestore)).map(
    (thread) => ({
      url: absoluteUrl(forumThreadPath(thread)),
      updatedAt: new Date(thread.lastActivityAt).toISOString(),
    }),
  );
}

export async function articleSitemapEntries() {
  return (await listPublishedArticles())
    .filter(isArticleIndexable)
    .map((article) => ({
      url: absoluteUrl(`/articles/${article.slug}`),
      updatedAt: article.updatedAt,
    }));
}
