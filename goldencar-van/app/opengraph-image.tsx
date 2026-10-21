import { ImageResponse } from "next/og";
import { vehicles } from "@/content/vehicles";

// 카카오톡·페이스북 등에 링크를 공유할 때 보이는 미리보기 이미지
// (기본 글꼴에 한글이 없어 영문·숫자로만 구성)
export const alt = "Golden Car Van Rental";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const enName: Record<string, string> = { staria: "STARIA HYBRID", solati: "SOLATI" };

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #0d0d0f 0%, #1c1a14 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 8, color: "#dcbd6e" }}>GOLDEN CAR · VAN RENTAL</div>
        <div style={{ display: "flex", gap: 40, marginTop: 60 }}>
          {vehicles.map((v) => (
            <div
              key={v.id}
              style={{
                display: "flex",
                flexDirection: "column",
                border: "2px solid rgba(220,189,110,0.5)",
                borderRadius: 24,
                padding: "32px 44px",
              }}
            >
              <div style={{ fontSize: 30, color: "rgba(255,255,255,0.75)" }}>{enName[v.id] ?? v.id.toUpperCase()}</div>
              <div style={{ fontSize: 64, fontWeight: 800, color: "#dcbd6e", marginTop: 8 }}>
                {`KRW ${v.dailyPrice.toLocaleString("en-US")}`}
              </div>
              <div style={{ fontSize: 26, color: "rgba(255,255,255,0.55)" }}>per day</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
