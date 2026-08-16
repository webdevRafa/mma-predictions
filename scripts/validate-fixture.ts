import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  leaderboardFixtureSchema,
  publicProfileSchema,
  validateAndNormalizeFixture,
} from "@fightlobby/domain";

async function collectJsonFiles(inputPath: string): Promise<string[]> {
  const resolved = path.resolve(inputPath);
  const info = await stat(resolved);
  if (info.isFile()) return resolved.endsWith(".json") ? [resolved] : [];
  const entries = await readdir(resolved, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => collectJsonFiles(path.join(resolved, entry.name))),
  );
  return nested.flat().sort();
}

async function main(): Promise<void> {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) inputs.push("fixtures");

  let failures = 0;
  for (const input of inputs) {
    for (const filename of await collectJsonFiles(input)) {
      try {
        const json: unknown = JSON.parse(await readFile(filename, "utf8"));
        if (filename.includes(`${path.sep}leaderboards${path.sep}`)) {
          const fixture = leaderboardFixtureSchema.parse(json);
          console.log(
            `✓ ${path.relative(process.cwd(), filename)} — ${fixture.members.length} leaderboard members`,
          );
          continue;
        }
        if (filename.includes(`${path.sep}profiles${path.sep}`)) {
          const profile = publicProfileSchema.parse(json);
          console.log(
            `✓ ${path.relative(process.cwd(), filename)} — @${profile.handle} public profile`,
          );
          continue;
        }
        const result = validateAndNormalizeFixture(json);
        if (result.success) {
          console.log(
            `✓ ${path.relative(process.cwd(), filename)} — ${result.data.event.name} (${result.data.fights.length} fights)`,
          );
        } else {
          failures += 1;
          console.error(`✗ ${path.relative(process.cwd(), filename)}`);
          result.issues.forEach((issue) =>
            console.error(`  ${issue.path}: ${issue.message}`),
          );
        }
      } catch (error) {
        failures += 1;
        console.error(
          `✗ ${path.relative(process.cwd(), filename)}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  if (failures > 0) process.exitCode = 1;
}

void main();
