import type { Metadata } from "next";
import { MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { ForumPagination } from "@/components/navigation/forum-pagination";
import { JsonLd } from "@/components/seo/json-ld";
import { MemberAvatar } from "@/features/forum/member-avatar";
import { ForumReplyComposer } from "@/features/forum/forum-reply-composer";
import { MobileForumReplyAccess } from "@/features/forum/mobile-forum-reply-access";
import { ReportForumPost } from "@/features/forum/report-forum-post";
import { getOptionalSession } from "@/lib/auth/session";
import { formatForumTime } from "@/lib/forum/format";
import { getForumThread, getForumThreadPage } from "@/lib/forum/data";
import { forumPageCount, forumReplyPageNumber } from "@/lib/forum/pagination";
import { forumThreadPath } from "@/lib/forum/path";
import { FORUM_REPLY_PAGE_SIZE } from "@/lib/forum/types";
import { absoluteUrl } from "@/lib/seo/site";

type Props = {
  params: Promise<{ threadId: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export const dynamic = "force-dynamic";

function requestedPage(value: string | undefined) {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function roleLabel(role: "trusted" | "moderator" | "admin" | undefined) {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  if (role === "trusted") return "Trusted member";
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { threadId } = await params;
  const thread = await getForumThread(threadId);
  if (!thread)
    return {
      title: "Discussion not found",
      robots: { index: false, follow: false },
    };
  const description = thread.body.replace(/\s+/g, " ").slice(0, 180);
  const pathname = forumThreadPath(thread);
  return {
    title: thread.title,
    description,
    alternates: { canonical: pathname },
    openGraph: {
      title: thread.title,
      description,
      url: pathname,
      type: "article",
    },
    twitter: { card: "summary_large_image", title: thread.title, description },
  };
}

export default async function DiscussionThreadPage({
  params,
  searchParams,
}: Props) {
  const [{ threadId, slug }, query, session] = await Promise.all([
    params,
    searchParams,
    getOptionalSession(),
  ]);
  const requested = requestedPage(query.page);
  const result = await getForumThreadPage(threadId, requested);
  if (!result) notFound();
  const pathname = forumThreadPath(result.thread);
  if (slug !== result.thread.slug) {
    const suffix = requested > 1 ? `?page=${requested}` : "";
    permanentRedirect(`${pathname}${suffix}`);
  }
  const pages = forumPageCount(result.thread.replyCount);
  const authorRole = roleLabel(result.thread.author.roleBadge);
  const canReply = Boolean(
    session?.onboardingComplete && session.accountStatus === "active",
  );
  const destinationPage = forumReplyPageNumber(result.thread.replyCount);

  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          headline: result.thread.title,
          text: result.thread.body,
          datePublished: new Date(result.thread.createdAt).toISOString(),
          dateModified: new Date(result.thread.updatedAt).toISOString(),
          url: absoluteUrl(pathname),
          author: {
            "@type": "Person",
            name: `@${result.thread.author.handle}`,
            url: absoluteUrl(`/u/${result.thread.author.handle.toLowerCase()}`),
          },
          commentCount: result.thread.replyCount,
        }}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Discussions", href: "/discussions" },
          { label: result.thread.title },
        ]}
      />

      <article className="mt-8 overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 sm:mt-10">
        <header className="border-b border-fl-border p-5 sm:p-7">
          <h1 className="max-w-4xl font-display text-4xl leading-[1.04] font-semibold tracking-[-0.02em] sm:text-5xl lg:text-6xl">
            {result.thread.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <MemberAvatar
              handle={result.thread.author.handle}
              photoURL={result.thread.authorPhotoURL}
            />
            <div className="min-w-0 text-xs text-fl-text-muted">
              <Link
                className="focus-ring block w-fit rounded-sm text-sm font-bold text-fl-text transition hover:text-fl-accent"
                href={`/u/${result.thread.author.handle.toLowerCase()}`}
              >
                @{result.thread.author.handle}
              </Link>
              <span className="mt-0.5 flex flex-wrap items-center gap-2">
                <time
                  dateTime={new Date(result.thread.createdAt).toISOString()}
                >
                  {formatForumTime(result.thread.createdAt)}
                </time>
                {authorRole ? (
                  <span className="inline-flex items-center gap-1 text-fl-text-dim">
                    <ShieldCheck aria-hidden="true" size={12} /> {authorRole}
                  </span>
                ) : null}
              </span>
            </div>
            {session && session.uid !== result.thread.uid ? (
              <span className="ml-auto">
                <ReportForumPost
                  postId={result.thread.id}
                  postType="thread"
                  threadId={result.thread.id}
                />
              </span>
            ) : null}
          </div>
        </header>
        <div className="whitespace-pre-wrap p-5 text-[15px] leading-7 text-fl-text-muted sm:p-7 sm:text-base sm:leading-8">
          {result.thread.body}
        </div>
        <MobileForumReplyAccess
          canReply={canReply}
          destinationPage={destinationPage}
          returnTo={pathname}
          threadId={result.thread.id}
        />
      </article>

      <section aria-labelledby="replies-heading" className="mt-8 sm:mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Community replies</p>
            <h2
              className="mt-2 font-display text-3xl font-semibold"
              id="replies-heading"
            >
              {result.thread.replyCount.toLocaleString()}{" "}
              {result.thread.replyCount === 1 ? "reply" : "replies"}
            </h2>
          </div>
          {pages > 1 ? (
            <p className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
              Page {result.page} of {pages}
            </p>
          ) : null}
        </div>

        {result.replies.length ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1">
            {result.replies.map((reply, index) => {
              const number =
                (result.page - 1) * FORUM_REPLY_PAGE_SIZE + index + 1;
              const role = roleLabel(reply.author.roleBadge);
              return (
                <article
                  className="scroll-mt-24 border-b border-fl-border p-5 last:border-b-0 sm:p-6"
                  id={
                    index === result.replies.length - 1
                      ? "latest-reply"
                      : undefined
                  }
                  key={reply.id}
                >
                  <div className="flex items-start gap-3">
                    <MemberAvatar
                      handle={reply.author.handle}
                      photoURL={reply.authorPhotoURL}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link
                            className="focus-ring rounded-sm text-sm font-bold text-fl-text transition hover:text-fl-accent"
                            href={`/u/${reply.author.handle.toLowerCase()}`}
                          >
                            @{reply.author.handle}
                          </Link>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-fl-text-dim">
                            <time
                              dateTime={new Date(reply.createdAt).toISOString()}
                            >
                              {formatForumTime(reply.createdAt)}
                            </time>
                            {role ? (
                              <span className="inline-flex items-center gap-1">
                                <ShieldCheck aria-hidden="true" size={12} />{" "}
                                {role}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-fl-text-dim">
                            #{number}
                          </span>
                          {session && session.uid !== reply.uid ? (
                            <ReportForumPost
                              postId={reply.id}
                              postType="reply"
                              threadId={result.thread.id}
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-fl-text-muted sm:text-[15px]">
                        {reply.body}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-fl-border bg-fl-surface-1 p-7 text-center">
            <MessageSquareText
              aria-hidden="true"
              className="mx-auto text-fl-text-dim"
              size={22}
            />
            <p className="mt-3 text-sm text-fl-text-muted">
              No replies yet. Add the first response.
            </p>
          </div>
        )}

        <div className="mt-6">
          <ForumPagination
            currentPage={result.page}
            pageCount={pages}
            pathname={pathname}
          />
        </div>
      </section>

      <div className="mt-8 hidden md:block md:mt-10">
        <ForumReplyComposer
          canReply={canReply}
          destinationPage={destinationPage}
          returnTo={pathname}
          textareaId="desktop-forum-reply"
          threadId={result.thread.id}
        />
      </div>
    </main>
  );
}
