import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { ForumDirectory } from "@/features/forum/forum-directory";
import { listForumDirectory } from "@/lib/forum/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MMA Discussions",
  description:
    "Join community discussions about UFC cards, matchups, results, and fight-night predictions.",
  alternates: { canonical: "/discussions" },
  openGraph: {
    title: "FightLobby Discussions",
    description:
      "Talk UFC cards, matchups, results, and predictions with the FightLobby community.",
    url: "/discussions",
  },
};

export default async function DiscussionsPage() {
  const threads = await listForumDirectory();
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Discussions" }]}
      />
      <ForumDirectory now={Date.now()} threads={threads} />
    </main>
  );
}
