import { ImageResponse } from "next/og";

import { getPublicEvent } from "@/lib/data/public";

export const alt = "FightLobby UFC event card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function EventOpenGraphImage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const card = await getPublicEvent(eventSlug);
  const eventName = card?.event.name ?? "FightLobby UFC Event";
  const mainFight = card?.fights.find(
    (fight) => fight.id === card.event.mainEventFightId,
  );
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
        border: "1px solid #2A333E",
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
            border: "1px solid rgba(255,90,54,.45)",
            borderRadius: 999,
            padding: "10px 18px",
            color: "#FF8B73",
            fontSize: 16,
            letterSpacing: 2,
          }}
        >
          UFC EVENT
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1050 }}>
        <div style={{ color: "#9AA5B1", fontSize: 18, letterSpacing: 4 }}>
          FIGHT CARD · PREDICTIONS · EVENT LOBBY
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 74,
            lineHeight: 0.92,
            fontWeight: 900,
            letterSpacing: -2,
          }}
        >
          {eventName}
        </div>
        {mainFight ? (
          <div
            style={{
              display: "flex",
              marginTop: 28,
              color: "#FF5A36",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            {mainFight.fighterA.name.full}{" "}
            <span style={{ color: "#697582", margin: "0 16px" }}>VS</span>{" "}
            {mainFight.fighterB.name.full}
          </div>
        ) : null}
      </div>
    </div>,
    size,
  );
}
