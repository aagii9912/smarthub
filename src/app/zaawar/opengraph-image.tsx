import { ImageResponse } from "next/og";

/**
 * /zaawar хуудасны хуваалцах карт (og:image).
 * next/og-ийн үндсэн фонт зөвхөн латин үсэг дэмждэг тул
 * текстийг латин + тоогоор хязгаарлаж, mind map-ийн дүрсээр илэрхийлэв.
 */
export const alt = "Syncly хэрэглэх заавар — алхам алхмаар интерактив гарын авлага";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BUBBLES = [
    { n: 1, x: 150, y: 110, c: "#818cf8" },
    { n: 2, x: 90, y: 300, c: "#a78bfa" },
    { n: 3, x: 170, y: 480, c: "#22d3ee" },
    { n: 4, x: 420, y: 530, c: "#e879f9" },
    { n: 5, x: 760, y: 525, c: "#60a5fa" },
    { n: 6, x: 1020, y: 440, c: "#34d399" },
    { n: 7, x: 1060, y: 200, c: "#fbbf24" },
    { n: 8, x: 880, y: 90, c: "#38bdf8" },
    { n: 9, x: 520, y: 70, c: "#facc15" },
];

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    background:
                        "linear-gradient(135deg, #06060f 0%, #14122e 55%, #1e1b4b 100%)",
                }}
            >
                {BUBBLES.map((b) => (
                    <div
                        key={b.n}
                        style={{
                            position: "absolute",
                            left: b.x - 44,
                            top: b.y - 44,
                            width: 88,
                            height: 88,
                            borderRadius: 9999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 34,
                            fontWeight: 700,
                            color: "#ffffff",
                            background: `${b.c}33`,
                            border: `2px solid ${b.c}99`,
                        }}
                    >
                        {b.n}
                    </div>
                ))}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 18,
                    }}
                >
                    <div
                        style={{
                            fontSize: 96,
                            fontWeight: 800,
                            color: "#ffffff",
                            letterSpacing: -3,
                        }}
                    >
                        Syncly
                    </div>
                    <div
                        style={{
                            display: "flex",
                            padding: "10px 28px",
                            borderRadius: 9999,
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            fontSize: 32,
                            color: "rgba(255,255,255,0.85)",
                        }}
                    >
                        syncly.mn/zaawar
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
