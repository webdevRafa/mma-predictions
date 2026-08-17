const requestedOrigin = process.argv[2];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function fetchChecked(origin: URL, pathname: string) {
  const response = await fetch(new URL(pathname, origin), {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  assert(response.ok, `${pathname} returned HTTP ${response.status}`);
  assert(
    new URL(response.url).origin === origin.origin,
    `${pathname} redirected away from the canonical origin`,
  );
  return response;
}

async function main() {
  assert(
    requestedOrigin,
    "Usage: pnpm launch:verify -- https://fightlobby.com",
  );
  const origin = new URL(requestedOrigin);
  assert(
    origin.protocol === "https:",
    "Production verification requires HTTPS",
  );
  assert(
    origin.pathname === "/",
    "Pass a bare canonical origin without a path",
  );
  assert(
    !origin.hostname.endsWith(".vercel.app"),
    "Production verification requires the custom domain",
  );

  const requiredPages = [
    "/",
    "/events",
    "/about",
    "/privacy",
    "/terms",
    "/cookie-policy",
    "/community-guidelines",
    "/data-corrections",
    "/dmca",
    "/robots.txt",
    "/sitemap.xml",
    "/ads.txt",
  ];
  const responses = await Promise.all(
    requiredPages.map(
      async (pathname) =>
        [pathname, await fetchChecked(origin, pathname)] as const,
    ),
  );
  const home = responses.find(([pathname]) => pathname === "/")?.[1];
  assert(home, "Homepage response was not collected");
  const homeHtml = await home.text();
  assert(
    homeHtml.includes(`<link rel="canonical" href="${origin.origin}"`),
    "Homepage canonical URL does not match the requested production origin",
  );
  assert(!homeHtml.includes("ca-pub-"), "AdSense loaded during ads-off launch");

  const requiredHeaders: Record<string, string> = {
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
  };
  for (const [header, expected] of Object.entries(requiredHeaders))
    assert(
      home.headers.get(header)?.includes(expected),
      `Homepage is missing required ${header} protection`,
    );

  const health = await fetchChecked(origin, "/api/health");
  const healthBody: unknown = await health.json();
  assert(
    healthBody &&
      typeof healthBody === "object" &&
      "status" in healthBody &&
      healthBody.status === "ok",
    "Production health endpoint did not report ok",
  );

  const adsResponse = responses.find(
    ([pathname]) => pathname === "/ads.txt",
  )?.[1];
  assert(adsResponse, "ads.txt response was not collected");
  const adsText = await adsResponse.text();
  assert(!adsText.includes("DIRECT"), "ads.txt is selling inventory at launch");

  console.log(
    `FightLobby production verification: PASS (${requiredPages.length + 1} routes, canonical HTTPS, security headers, health, and ads-off state).`,
  );
}

void main();
