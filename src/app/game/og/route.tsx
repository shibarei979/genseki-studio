import { ImageResponse } from "next/og";

/**
 * ============================================================
 * 原石航路
 * /game/og — X に貼られたときの絵
 *
 * ★ 文字だけでは流れない。
 *
 *   広まっている診断は、結果が絵として貼られている。
 *   読まなくても伝わるものが要る。
 *
 * ★ 100 枚は作れないので、型に二語を焼き込む。
 *   舞台と芯を受け取って、その場で描く。
 *
 * ★ 絵の中に、原石航路の名前を必ず入れる。
 *   貼られた絵そのものが、案内になる。
 * ============================================================
 */

export const runtime = "edge";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const place = (searchParams.get("p") ?? "").slice(0, 6);
    const core = (searchParams.get("c") ?? "").slice(0, 6);
    const title = (searchParams.get("t") ?? "").slice(0, 40);

    const hasResult = Boolean(place && core);

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                        "linear-gradient(180deg, #1d3348 0%, #17293a 50%, #0d1926 100%)",
                    color: "#f3ece0",
                    fontFamily: "sans-serif",
                    position: "relative",
                }}
            >
                {/* 上下の細い金線 */}
                <div
                    style={{
                        position: "absolute",
                        top: 40,
                        left: 60,
                        right: 60,
                        height: 1,
                        background: "rgba(200, 148, 74, .45)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: 40,
                        left: 60,
                        right: 60,
                        height: 1,
                        background: "rgba(200, 148, 74, .45)",
                    }}
                />

                {hasResult ? (
                    <>
                        <div
                            style={{
                                fontSize: 24,
                                letterSpacing: 10,
                                color: "#8ea0b0",
                                marginBottom: 28,
                            }}
                        >
                            私が書けるのは
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 34,
                                marginBottom: 10,
                            }}
                        >
                            <span style={{ fontSize: 104, fontWeight: 700, letterSpacing: 8 }}>
                                {place}
                            </span>
                            <span style={{ fontSize: 44, color: "#c8944a" }}>×</span>
                            <span style={{ fontSize: 104, fontWeight: 700, letterSpacing: 8 }}>
                                {core}
                            </span>
                        </div>

                        {/* 二語の下の罫と菱形 */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                marginTop: 20,
                                marginBottom: 26,
                            }}
                        >
                            <div style={{ width: 90, height: 1, background: "#5a6b7a" }} />
                            <div
                                style={{
                                    width: 9,
                                    height: 9,
                                    background: "#c8944a",
                                    transform: "rotate(45deg)",
                                }}
                            />
                            <div style={{ width: 90, height: 1, background: "#5a6b7a" }} />
                        </div>

                        {title && (
                            <div style={{ fontSize: 30, color: "#dcc9a6", letterSpacing: 2 }}>
                                『{title}』
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div
                            style={{
                                fontSize: 26,
                                letterSpacing: 10,
                                color: "#8ea0b0",
                                marginBottom: 30,
                            }}
                        >
                            10の選択・1分・登録なし
                        </div>
                        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: 8 }}>
                            無名作家から、
                        </div>
                        <div
                            style={{
                                fontSize: 72,
                                fontWeight: 700,
                                letterSpacing: 8,
                                marginTop: 14,
                            }}
                        >
                            はじまる10の選択。
                        </div>
                        <div
                            style={{
                                fontSize: 28,
                                color: "#a9bac8",
                                marginTop: 34,
                                letterSpacing: 3,
                            }}
                        >
                            あなたが本当に書ける一作は？　全100通り
                        </div>
                    </>
                )}

                <div
                    style={{
                        position: "absolute",
                        bottom: 66,
                        fontSize: 22,
                        letterSpacing: 12,
                        color: "#c8944a",
                    }}
                >
                    原石航路
                </div>
            </div>
        ),
        { width: 1200, height: 630 },
    );
}
