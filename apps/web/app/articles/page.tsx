import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { ArticlesDirectory } from "@/features/articles/articles-directory";
import { listPublishedArticles } from "@/lib/data/articles";

export const metadata: Metadata = {
  title: "UFC Articles and MMA Analysis",
  description:
    "Read FightLobby UFC previews, matchup analysis, division context, prospect scouting, and independent MMA features.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "FightLobby UFC Articles and MMA Analysis",
    description:
      "Fight previews, prospect scouting, division context, and independent MMA analysis.",
    type: "website",
    url: "/articles",
  },
};

export default async function ArticlesPage() {
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Articles" }]}
      />
      <ArticlesDirectory articles={await listPublishedArticles()} />
    </main>
  );
}
