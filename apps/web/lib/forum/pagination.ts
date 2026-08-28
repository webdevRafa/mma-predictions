import { FORUM_REPLY_PAGE_SIZE } from "./types";

export function forumReplyPageNumber(replyCountBeforeInsert: number) {
  return (
    Math.floor(Math.max(0, replyCountBeforeInsert) / FORUM_REPLY_PAGE_SIZE) + 1
  );
}

export function forumPageCount(replyCount: number) {
  return Math.max(
    1,
    Math.ceil(Math.max(0, replyCount) / FORUM_REPLY_PAGE_SIZE),
  );
}

export function clampForumPage(requestedPage: number, replyCount: number) {
  const pages = forumPageCount(replyCount);
  if (!Number.isInteger(requestedPage) || requestedPage < 1) return 1;
  return Math.min(requestedPage, pages);
}

export function forumPaginationItems(currentPage: number, pageCount: number) {
  const pages = new Set([
    1,
    pageCount,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  return [...pages]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);
}
