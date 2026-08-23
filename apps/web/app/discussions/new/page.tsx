import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { CreateThreadForm } from "@/features/forum/create-thread-form";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getMemberPhotoURL } from "@/lib/forum/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Start a Discussion",
  robots: { index: false, follow: true },
};

export default async function NewDiscussionPage() {
  const session = await requireOnboardedSession("/discussions/new");
  const photoURL = await getMemberPhotoURL(session.uid);
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Discussions", href: "/discussions" },
          { label: "New discussion" },
        ]}
      />
      <div className="mx-auto mt-10 max-w-3xl">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Start a discussion
        </h1>
        <p className="mt-3 text-sm leading-6 text-fl-text-muted">
          Give the topic a clear subject, then share the context behind your
          take or question.
        </p>
        <div className="mt-8">
          <CreateThreadForm
            handle={session.handle ?? "member"}
            photoURL={photoURL}
          />
        </div>
      </div>
    </main>
  );
}
