const publisherPattern = /^pub-\d{16}$/;

export function GET() {
  const publisherId = process.env.ADSENSE_PUBLISHER_ID?.trim() ?? "";
  const body = publisherPattern.test(publisherId)
    ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
    : "# FightLobby advertising is disabled; add the verified AdSense publisher ID before approval.\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
