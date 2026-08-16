import { evaluateProductionReadiness } from "@/lib/operations/production-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const environment = process.env.VERCEL_ENV ?? "local";
  const production = environment === "production";
  const readiness = production
    ? evaluateProductionReadiness(process.env)
    : { ready: true, blockers: [], warnings: [] };
  const status = readiness.ready ? 200 : 503;

  return Response.json(
    {
      service: "fightlobby-web",
      status: readiness.ready ? "ok" : "not_ready",
      environment,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
      checks: {
        runtimeConfiguration: readiness.ready ? "pass" : "fail",
      },
      blockerCodes: readiness.blockers.map(({ code }) => code),
      warningCodes: readiness.warnings.map(({ code }) => code),
      checkedAt: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
