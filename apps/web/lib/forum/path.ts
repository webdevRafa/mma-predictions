export function forumThreadPath(thread: { id: string; slug: string }) {
  return `/discussions/${encodeURIComponent(thread.id)}/${encodeURIComponent(thread.slug)}`;
}
