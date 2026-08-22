import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("public data cache boundary", () => {
  it("keeps Firebase Admin reads outside Next persistent cache scopes", async () => {
    const source = await readFile(
      path.resolve(import.meta.dirname, "../lib/data/public.ts"),
      "utf8",
    );

    expect(source).toContain('from "react"');
    expect(source).not.toContain("unstable_cache");
    expect(source).not.toContain('from "next/cache"');
  });
});
