import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory()
          ? sourceFiles(target)
          : Promise.resolve(/\.[cm]?[jt]sx?$/.test(entry.name) ? [target] : []);
      }),
    )
  ).flat();
}

describe("provider architecture boundary", () => {
  it("keeps provider packages and vendor DTOs out of the web application", async () => {
    const root = path.resolve(import.meta.dirname, "..");
    const files = await sourceFiles(path.join(root, "app"));
    const components = await sourceFiles(path.join(root, "components"));
    const features = await sourceFiles(path.join(root, "features"));
    const source = await Promise.all(
      [...files, ...components, ...features].map((file) =>
        readFile(file, "utf8"),
      ),
    );
    expect(source.join("\n")).not.toContain("@fightlobby/providers");
    expect(source.join("\n")).not.toContain("SportsDataIo");
  });
});
