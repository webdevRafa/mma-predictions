import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="shell grid min-h-[65vh] place-items-center py-16 text-center"
      id="main-content"
    >
      <div>
        <span className="mx-auto grid size-16 place-items-center rounded-full border border-fl-border bg-fl-surface-1 text-fl-accent">
          <SearchX aria-hidden="true" size={27} />
        </span>
        <p className="eyebrow mt-6">404 · No matchup found</p>
        <h1 className="mt-3 font-display text-5xl font-extrabold sm:text-7xl">
          THIS ROOM DOESN’T EXIST.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-fl-text-muted">
          The event, fight, or fighter may have moved. Canonical legacy links
          redirect automatically when a verified replacement exists.
        </p>
        <Link
          className="focus-ring mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg"
          href="/events"
        >
          <ArrowLeft aria-hidden="true" size={16} /> Browse UFC events
        </Link>
      </div>
    </main>
  );
}
