"use client";

import { normalizeSearchText, type Article } from "@fightlobby/domain";
import { ArrowRight, Clock3, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { articleCategoryLabel, formatArticleDate } from "@/lib/articles/format";

function matches(article: Article, query: string) {
  if (!query.trim()) return true;
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  const haystack = normalizeSearchText(
    [article.title, article.dek, article.excerpt, ...article.tags].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

function ArticleMeta({ article }: { article: Article }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[.06em] text-fl-text-dim uppercase">
      <span className="text-fl-accent">
        {articleCategoryLabel(article.category)}
      </span>
      <time dateTime={article.publishedAt}>
        {formatArticleDate(article.publishedAt)}
      </time>
      <span className="inline-flex items-center gap-1">
        <Clock3 aria-hidden="true" size={12} /> {article.readingMinutes} min
        read
      </span>
    </span>
  );
}

export function ArticlesDirectory({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => articles.filter((article) => matches(article, query)),
    [articles, query],
  );
  const lead = filtered.find((article) => article.featured) ?? filtered[0];
  const remaining = filtered.filter((article) => article.id !== lead?.id);

  return (
    <>
      <header className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-5xl leading-none font-semibold tracking-[-0.025em] sm:text-6xl">
            Articles
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-fl-text-muted sm:text-base">
            Fight previews, division context, prospect scouting, and the stories
            worth following between cards.
          </p>
        </div>
        {articles.length ? (
          <div className="relative w-full sm:max-w-sm">
            <label className="sr-only" htmlFor="article-search">
              Search articles
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fl-text-dim"
              size={17}
            />
            <input
              autoComplete="off"
              className="focus-ring h-12 w-full rounded-xl border border-fl-border bg-fl-surface-1 pr-11 pl-11 text-sm text-fl-text outline-none placeholder:text-fl-text-dim hover:border-fl-border-strong focus:border-fl-accent/55"
              id="article-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles or fighters"
              spellCheck={false}
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Clear article search"
                className="focus-ring absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-fl-text-dim transition hover:bg-fl-surface-2 hover:text-fl-text"
                onClick={() => setQuery("")}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <p className="sr-only" role="status">
        {filtered.length} {filtered.length === 1 ? "article" : "articles"}
      </p>

      {lead ? (
        <section aria-label="FightLobby articles" className="mt-8 sm:mt-10">
          <Link
            className="focus-ring group relative block overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 p-6 transition hover:border-fl-accent/35 hover:bg-fl-surface-2 sm:p-8 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)] lg:gap-12 lg:p-10"
            href={`/articles/${lead.slug}`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-fl-accent"
            />
            <span className="block min-w-0">
              <ArticleMeta article={lead} />
              <span className="mt-5 block font-display text-4xl leading-[.98] font-semibold tracking-[-0.025em] text-fl-text transition group-hover:text-fl-accent sm:text-5xl">
                {lead.title}
              </span>
            </span>
            <span className="mt-5 flex min-w-0 flex-col justify-between lg:mt-0">
              <span className="text-sm leading-6 text-fl-text-muted sm:text-base">
                {lead.dek}
              </span>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-fl-text">
                Read article
                <ArrowRight
                  aria-hidden="true"
                  className="transition group-hover:translate-x-1 group-hover:text-fl-accent"
                  size={16}
                />
              </span>
            </span>
          </Link>

          {remaining.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {remaining.map((article) => (
                <Link
                  className="focus-ring group flex min-h-64 flex-col rounded-2xl border border-fl-border bg-fl-surface-1 p-5 transition hover:border-fl-accent/35 hover:bg-fl-surface-2 sm:p-6"
                  href={`/articles/${article.slug}`}
                  key={article.id}
                >
                  <ArticleMeta article={article} />
                  <span className="mt-5 block font-display text-3xl leading-[1.02] font-semibold tracking-[-0.015em] text-fl-text transition group-hover:text-fl-accent">
                    {article.title}
                  </span>
                  <span className="mt-3 line-clamp-3 text-sm leading-6 text-fl-text-muted">
                    {article.excerpt}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-fl-text">
                    Read article
                    <ArrowRight
                      aria-hidden="true"
                      className="transition group-hover:translate-x-1 group-hover:text-fl-accent"
                      size={15}
                    />
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : articles.length ? (
        <div className="mt-8 rounded-2xl border border-fl-border bg-fl-surface-1 p-8 text-center sm:mt-10">
          <h2 className="font-display text-3xl font-semibold">
            No matching articles
          </h2>
          <p className="mt-2 text-sm text-fl-text-muted">
            Try another fighter, event, or topic.
          </p>
          <button
            className="focus-ring mt-5 cursor-pointer rounded-lg border border-fl-border bg-fl-surface-2 px-4 py-2 text-sm font-bold transition hover:border-fl-accent/45 hover:text-fl-accent"
            onClick={() => setQuery("")}
            type="button"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-fl-border bg-fl-surface-1 p-8 sm:mt-10">
          <h2 className="font-display text-3xl font-semibold">
            Editorial coverage is coming
          </h2>
          <p className="mt-2 text-sm text-fl-text-muted">
            Published FightLobby analysis will appear here after editorial
            review.
          </p>
        </div>
      )}
    </>
  );
}
