import { ImageResponse } from "next/og";

export const alt = "FightLobby — Every fight has a lobby";
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
          background: "rgba(241,64,29,.15)",
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
            background: "#F1401D",
            display: "flex",
          }}
        />
        FIGHT<span style={{ color: "#F1401D", marginLeft: -14 }}>LOBBY</span>
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
          Predictions · Reactions · Receipts
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 100,
            lineHeight: 0.9,
            fontWeight: 900,
            letterSpacing: -4,
            marginTop: 24,
          }}
        >
          <span>EVERY FIGHT</span>
          <span style={{ color: "#F1401D" }}>HAS A LOBBY.</span>
        </div>
      </div>
    </div>,
    size,
  );
}
