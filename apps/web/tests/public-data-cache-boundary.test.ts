import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("public data cache boundary", () => {
  it("deduplicates renders and keeps bounded persistent public caches", async () => {
    const source = await readFile(
      path.resolve(import.meta.dirname, "../lib/data/public.ts"),
      "utf8",
    );

    expect(source).toContain('from "react"');
    expect(source).toContain('from "next/cache"');
    expect(source).toContain("unstable_cache");
    expect(source).toContain("revalidate: 30");
    expect(source).toContain("revalidate: 300");
  });

  it("renders Firestore-backed detail pages dynamically", async () => {
    const routeSources = await Promise.all(
      [
        "../app/events/[eventSlug]/page.tsx",
        "../app/fights/[fightSlug]/page.tsx",
        "../app/fighters/[fighterSlug]/page.tsx",
        "../app/u/[handle]/page.tsx",
      ].map((route) =>
        readFile(path.resolve(import.meta.dirname, route), "utf8"),
      ),
    );

    for (const source of routeSources) {
      expect(source).toContain('export const dynamic = "force-dynamic"');
      expect(source).not.toContain("generateStaticParams");
    }
  });
});
