import {
  profileSitemapEntries,
  sitemapDocument,
  xmlResponse,
} from "@/lib/seo/sitemaps";

export async function GET() {
  return xmlResponse(sitemapDocument(await profileSitemapEntries()));
}
