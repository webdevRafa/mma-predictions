import { ImageResponse } from "next/og";

export const alt = "FightLobby — UFC predictions and live fight chat";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
        padding: "72px",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: 560,
          background: "rgba(224,12,15,.15)",
          top: -280,
          right: -80,
          display: "flex",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        <span
          style={{
            width: 7,
            height: 34,
            borderRadius: 8,
            background: "#E00C0F",
            display: "flex",
          }}
        />
        FIGHT<span style={{ color: "#E00C0F", marginLeft: -14 }}>LOBBY</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            color: "#9AA5B1",
            fontSize: 18,
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          UFC predictions · Live fight chat · Community
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 88,
            lineHeight: 0.9,
            fontWeight: 900,
            letterSpacing: -4,
            marginTop: 24,
          }}
        >
          <span>JOIN THE FIGHT NIGHT</span>
          <span style={{ color: "#E00C0F" }}>CONVERSATION.</span>
        </div>
      </div>
    </div>,
    size,
  );
}
