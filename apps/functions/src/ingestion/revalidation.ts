export async function revalidatePublicPages(paths: string[]) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const secret = process.env.REVALIDATION_SECRET;
  if (!siteUrl || !secret || paths.length === 0) return { skipped: true };
  const response = await fetch(`${siteUrl}/api/internal/revalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-revalidation-secret": secret,
    },
    body: JSON.stringify({ paths: [...new Set(paths)] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Revalidation endpoint returned HTTP ${response.status}`);
  return { skipped: false };
}
