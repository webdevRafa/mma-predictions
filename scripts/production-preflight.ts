import { readFile } from "node:fs/promises";
import path from "node:path";

import { evaluateProductionReadiness } from "../apps/web/lib/operations/production-readiness.ts";

function requestedEnvironmentFile() {
  const argumentsList = process.argv.slice(2);
  const equalsArgument = argumentsList.find((argument) =>
    argument.startsWith("--env-file="),
  );
  if (equalsArgument) return equalsArgument.slice("--env-file=".length);
  const flagIndex = argumentsList.indexOf("--env-file");
  return flagIndex >= 0 ? argumentsList[flagIndex + 1] : ".env.local";
}

function parseEnvironmentFile(contents: string) {
  const parsed: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const match =
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    let configured = match[2] ?? "";
    if (
      configured.length >= 2 &&
      ((configured.startsWith('"') && configured.endsWith('"')) ||
        (configured.startsWith("'") && configured.endsWith("'")))
    )
      configured = configured.slice(1, -1);
    if (key) parsed[key] = configured;
  }
  return parsed;
}

async function environmentFrom(file: string | undefined) {
  const fromFile = file
    ? await readFile(path.resolve(file), "utf8")
        .then(parseEnvironmentFile)
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT" &&
            file === ".env.local"
          )
            return {};
          throw error;
        })
    : {};
  return { ...fromFile, ...process.env };
}

async function main() {
  const environment = await environmentFrom(requestedEnvironmentFile());
  const report = evaluateProductionReadiness(environment);
  console.log(
    `FightLobby production preflight: ${report.ready ? "PASS" : "FAIL"}`,
  );
  for (const blocker of report.blockers)
    console.log(`BLOCKER [${blocker.code}] ${blocker.message}`);
  for (const warning of report.warnings)
    console.log(`WARNING [${warning.code}] ${warning.message}`);
  console.log(
    `Summary: ${report.blockers.length} blocker(s), ${report.warnings.length} warning(s). No environment values were printed.`,
  );
  if (!report.ready) process.exitCode = 1;
}

void main();
