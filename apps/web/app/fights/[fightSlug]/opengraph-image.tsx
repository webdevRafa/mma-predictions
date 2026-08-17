import { ImageResponse } from "next/og";

import { getPublicFight } from "@/lib/data/public";

export const alt = "FightLobby matchup prediction page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function FightOpenGraphImage({
  params,
}: {
  params: Promise<{ fightSlug: string }>;
}) {
  const { fightSlug } = await params;
  const detail = await getPublicFight(fightSlug);
  const fight = detail?.fight;
  const fighterA = fight?.fighterA.name.full ?? "Fighter A";
  const fighterB = fight?.fighterB.name.full ?? "Fighter B";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#080A0D",
        color: "#F5F7FA",
        padding: "64px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>
          FIGHT<span style={{ color: "#FF5A36" }}>LOBBY</span>
        </div>
        <div
          style={{
            display: "flex",
            color: "#9AA5B1",
            fontSize: 16,
            letterSpacing: 3,
          }}
        >
          {fight?.weightClass.toUpperCase() ?? "UFC MATCHUP"}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            fontSize: 72,
            lineHeight: 0.9,
            fontWeight: 900,
          }}
        >
          {fighterA}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 82,
            height: 82,
            borderRadius: 82,
            background: "#FF5A36",
            color: "#080A0D",
            fontSize: 26,
            fontWeight: 900,
          }}
        >
          VS
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            justifyContent: "flex-end",
            textAlign: "right",
            fontSize: 72,
            lineHeight: 0.9,
            fontWeight: 900,
          }}
        >
          {fighterB}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          color: "#FF8B73",
          fontSize: 20,
          letterSpacing: 4,
        }}
      >
        PREDICTIONS · STATS · LIVE CHAT
      </div>
    </div>,
    size,
  );
}
