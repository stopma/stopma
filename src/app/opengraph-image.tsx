import { ImageResponse } from "next/og";

export const alt = "STOP.ma";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#fff",
        color: "#202020",
        padding: 70,
        borderTop: "18px solid #df292f",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: "#666" }}>
        stop.ma
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          fontSize: 180,
          fontWeight: 900,
          letterSpacing: -10,
        }}
      >
        <span style={{ color: "#df292f" }}>STOP</span>
        <span style={{ fontSize: 110, letterSpacing: -5 }}>.ma</span>
      </div>
      <div
        style={{
          display: "flex",
          height: 6,
          width: 150,
          background: "#df292f",
        }}
      />
    </div>,
    size,
  );
}
