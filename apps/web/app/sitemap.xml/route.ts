import { absoluteUrl } from "@/lib/seo/site";
import { xmlResponse } from "@/lib/seo/sitemaps";

export function GET() {
  const locations = [
    "/sitemaps/events.xml",
    "/sitemaps/fights-1.xml",
    "/sitemaps/fighters-1.xml",
  ];
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations.map((location) => `\n  <sitemap><loc>${absoluteUrl(location)}</loc></sitemap>`).join("")}\n</sitemapindex>`,
  );
}
