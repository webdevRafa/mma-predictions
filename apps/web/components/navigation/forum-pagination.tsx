import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { forumPaginationItems } from "@/lib/forum/pagination";

function href(pathname: string, page: number) {
  return page === 1 ? pathname : `${pathname}?page=${page}`;
}

export function ForumPagination({
  currentPage,
  pageCount,
  pathname,
}: {
  currentPage: number;
  pageCount: number;
  pathname: string;
}) {
  if (pageCount <= 1) return null;
  const items = forumPaginationItems(currentPage, pageCount);
  return (
    <nav
      aria-label="Discussion replies"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        <Link
          aria-label="Previous reply page"
          className="focus-ring grid size-10 place-items-center rounded-lg border border-fl-border bg-fl-surface-1 transition hover:border-fl-accent/45 hover:text-fl-accent"
          href={href(pathname, currentPage - 1)}
        >
          <ChevronLeft aria-hidden="true" size={17} />
        </Link>
      ) : null}
      {items.map((page, index) => {
        const previous = items[index - 1];
        return (
          <span className="contents" key={page}>
            {previous !== undefined && page - previous > 1 ? (
              <span aria-hidden="true" className="px-1 text-fl-text-dim">
                …
              </span>
            ) : null}
            <Link
              aria-current={page === currentPage ? "page" : undefined}
              className={`focus-ring grid size-10 place-items-center rounded-lg border text-sm font-bold transition ${
                page === currentPage
                  ? "border-fl-accent/55 bg-fl-accent/12 text-fl-text"
                  : "border-fl-border bg-fl-surface-1 hover:border-fl-accent/45 hover:text-fl-accent"
              }`}
              href={href(pathname, page)}
            >
              {page}
            </Link>
          </span>
        );
      })}
      {currentPage < pageCount ? (
        <Link
          aria-label="Next reply page"
          className="focus-ring grid size-10 place-items-center rounded-lg border border-fl-border bg-fl-surface-1 transition hover:border-fl-accent/45 hover:text-fl-accent"
          href={href(pathname, currentPage + 1)}
        >
          <ChevronRight aria-hidden="true" size={17} />
        </Link>
      ) : null}
    </nav>
  );
}
