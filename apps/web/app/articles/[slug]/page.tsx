import type { ArticleBodyBlock } from "@fightlobby/domain";
import { ArrowLeft, ArrowUpRight, Clock3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { articleCategoryLabel, formatArticleDate } from "@/lib/articles/format";
import { getPublishedArticle } from "@/lib/data/articles";
import { absoluteUrl } from "@/lib/seo/site";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

function ArticleBlock({ block }: { block: ArticleBodyBlock }) {
  if (block.type === "heading")
    return (
      <h2
        className="mt-11 scroll-mt-24 font-display text-3xl leading-tight font-semibold tracking-[-0.015em] text-fl-text sm:text-4xl"
        id={block.id}
      >
        {block.text}
      </h2>
    );
  if (block.type === "bullet_list")
    return (
      <ul className="my-6 grid gap-3 pl-5 text-base leading-8 text-fl-text-muted marker:text-fl-accent sm:text-lg">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  if (block.type === "quote")
    return (
      <blockquote className="my-8 border-l-2 border-fl-accent bg-fl-surface-1 px-5 py-4 text-lg leading-8 text-fl-text sm:px-6 sm:text-xl">
        <p>{block.text}</p>
        {block.attribution ? (
          <footer className="mt-3 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
            {block.attribution}
          </footer>
        ) : null}
      </blockquote>
    );
  return (
    <p className="mt-6 text-base leading-8 text-fl-text-muted sm:text-lg sm:leading-9">
      {block.text}
    </p>
  );
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const article = await getPublishedArticle((await params).slug);
  if (!article) return { title: "Article not found", robots: { index: false } };
  return {
    title: article.seo.title,
    description: article.seo.description,
    keywords: article.seo.keywords,
    authors: [{ name: article.author.displayName }],
    alternates: { canonical: article.seo.canonicalPath },
    openGraph: {
      type: "article",
      title: article.seo.title,
      description: article.seo.description,
      url: article.seo.canonicalPath,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author.displayName],
      tags: article.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seo.title,
      description: article.seo.description,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();
  if (article.slug !== slug) permanentRedirect(`/articles/${article.slug}`);

  const wordCount = article.body.reduce((total, block) => {
    const text =
      block.type === "bullet_list" ? block.items.join(" ") : block.text;
    return total + text.trim().split(/\s+/).length;
  }, 0);

  return (
    <main id="main-content">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.dek,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
          mainEntityOfPage: absoluteUrl(article.seo.canonicalPath),
          url: absoluteUrl(article.seo.canonicalPath),
          wordCount,
          articleSection: articleCategoryLabel(article.category),
          keywords: article.tags.join(", "),
          author: {
            "@type": "Organization",
            name: article.author.displayName,
          },
          publisher: {
            "@type": "Organization",
            "@id": `${absoluteUrl("/")}#organization`,
            name: "FightLobby",
          },
        }}
      />
      <article className="shell py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Articles", href: "/articles" },
            { label: article.title },
          ]}
        />

        <header className="mx-auto mt-10 max-w-4xl border-b border-fl-border pb-10 sm:mt-14 sm:pb-14">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
            <span className="text-fl-accent">
              {articleCategoryLabel(article.category)}
            </span>
            <time dateTime={article.publishedAt}>
              {formatArticleDate(article.publishedAt)}
            </time>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 aria-hidden="true" size={12} /> {article.readingMinutes}
              -minute read
            </span>
          </div>
          <h1 className="mt-5 font-display text-[clamp(2.8rem,7vw,5.5rem)] leading-[.95] font-semibold tracking-[-0.035em] text-fl-text text-balance">
            {article.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-fl-text-muted sm:text-xl sm:leading-9">
            {article.dek}
          </p>
          <div className="mt-7 flex items-center gap-3 border-l-2 border-fl-accent pl-4 text-sm">
            <span>
              <span className="block font-bold text-fl-text">
                {article.author.displayName}
              </span>
              <span className="block text-xs text-fl-text-dim">
                Independent MMA analysis
              </span>
            </span>
          </div>
        </header>

        <div className="mx-auto grid max-w-5xl gap-10 pt-4 lg:grid-cols-[minmax(0,46rem)_13rem] lg:gap-16 lg:pt-10">
          <div className="min-w-0">
            {article.body.map((block) => (
              <ArticleBlock block={block} key={block.id} />
            ))}
          </div>

          <aside className="border-t border-fl-border pt-6 lg:sticky lg:top-28 lg:h-fit lg:border-t-0 lg:pt-0">
            <p className="eyebrow">Sources</p>
            <ol className="mt-4 grid gap-4">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    className="focus-ring group block rounded-lg text-xs leading-5 text-fl-text-muted transition hover:text-fl-text"
                    href={source.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <span className="block font-semibold text-fl-text">
                      {source.publisher}
                    </span>
                    <span className="mt-1 inline-flex gap-1">
                      {source.label}
                      <ArrowUpRight
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-fl-text-dim group-hover:text-fl-accent"
                        size={12}
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        <footer className="mx-auto mt-14 max-w-5xl border-t border-fl-border pt-7 sm:mt-20">
          <Link
            className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-text transition hover:text-fl-accent"
            href="/articles"
          >
            <ArrowLeft aria-hidden="true" size={16} /> All articles
          </Link>
        </footer>
      </article>
    </main>
  );
}
