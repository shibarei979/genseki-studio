import { ImageResponse } from "next/og";

/**
 * ============================================================
 * 原石航路
 * /game/og — X に貼られたときの絵
 *
 * ★ 日本語の字を、自分で読み込む。
 *
 *   next/og は、指定しなければ日本語の字を持たない。
 *   字が抜けるか、別の字で代わりに描かれて幅が合わなくなる。
 *   はみ出していたのは、これ。
 *
 * ★ 使う字だけを取ってくる。
 *
 *   日本語の字は全部で数メガある。そのまま読むと動かない。
 *   Google の窓口に「この字だけ」と伝えると、
 *   その字だけの小さな束を返してくれる。
 *
 * ★ 取れなかったときも、絵は出す。
 *   字が抜けても、真っ白よりはよい。
 * ============================================================
 */

export const runtime = "edge";

/**
 * 使う字だけの束を取ってくる。
 *
 * ★ 古い名乗りで頼む。
 *   新しい名乗りだと woff2 で返ってきて、
 *   絵を描く仕掛けが読めない。
 */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
    try {
        const url =
            "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700&text=" +
            encodeURIComponent(text);

        const css = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.30 (KHTML, like Gecko) Version/5.1 Safari/534.30",
            },
        }).then((r) => r.text());

        const found = css.match(/src:\s*url\(([^)]+)\)/);
        if (!found) return null;

        return await fetch(found[1]).then((r) => r.arrayBuffer());
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const place = (searchParams.get("p") ?? "").slice(0, 6);
    const core = (searchParams.get("c") ?? "").slice(0, 6);
    const title = (searchParams.get("t") ?? "").slice(0, 28);

    const hasResult = Boolean(place && core);

    /* 絵の中に出す言葉を、先に全部そろえる */
    const words = hasResult
        ? ["私が書けるのは", place, core, title ? `『${title}』` : "", "原石航路"]
        : [
              "10の選択・1分・登録なし",
              "無名作家から、",
              "はじまる10の選択。",
              "あなたが本当に書ける一作は？",
              "全100通り",
              "原石航路",
          ];

    const font = await loadFont(words.join("") + "×『』・？、。");

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
                        "linear-gradient(180deg, #203a52 0%, #17293a 44%, #0d1926 100%)",
                    color: "#f3ece0",
                    position: "relative",
                    padding: "0 90px",
                }}
            >
                {/* 上下の細い金線 */}
                <div
                    style={{
                        position: "absolute",
                        top: 44,
                        left: 70,
                        right: 70,
                        height: 1,
                        background: "rgba(200, 148, 74, .45)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: 44,
                        left: 70,
                        right: 70,
                        height: 1,
                        background: "rgba(200, 148, 74, .45)",
                    }}
                />

                {hasResult ? (
                    <>
                        <div
                            style={{
                                fontSize: 22,
                                letterSpacing: 8,
                                color: "#8ea0b0",
                                marginBottom: 30,
                            }}
                        >
                            私が書けるのは
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 30,
                            }}
                        >
                            <span style={{ fontSize: 92, letterSpacing: 6 }}>{place}</span>
                            <span style={{ fontSize: 40, color: "#c8944a" }}>×</span>
                            <span style={{ fontSize: 92, letterSpacing: 6 }}>{core}</span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                marginTop: 26,
                                marginBottom: 24,
                            }}
                        >
                            <div style={{ width: 80, height: 1, background: "#5a6b7a" }} />
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    background: "#c8944a",
                                    transform: "rotate(45deg)",
                                }}
                            />
                            <div style={{ width: 80, height: 1, background: "#5a6b7a" }} />
                        </div>

                        {title && (
                            <div
                                style={{
                                    display: "flex",
                                    fontSize: 26,
                                    color: "#dcc9a6",
                                    letterSpacing: 2,
                                    textAlign: "center",
                                    maxWidth: 900,
                                }}
                            >
                                『{title}』
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div
                            style={{
                                fontSize: 22,
                                letterSpacing: 8,
                                color: "#8ea0b0",
                                marginBottom: 34,
                            }}
                        >
                            10の選択・1分・登録なし
                        </div>

                        <div style={{ display: "flex", fontSize: 62, letterSpacing: 6 }}>
                            無名作家から、
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 62,
                                letterSpacing: 6,
                                marginTop: 16,
                            }}
                        >
                            はじまる10の選択。
                        </div>

                        <div
                            style={{
                                display: "flex",
                                fontSize: 24,
                                color: "#a9bac8",
                                marginTop: 36,
                                letterSpacing: 3,
                            }}
                        >
                            あなたが本当に書ける一作は？
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 20,
                                color: "#7d8f9e",
                                marginTop: 12,
                                letterSpacing: 6,
                            }}
                        >
                            全100通り
                        </div>
                    </>
                )}

                <div
                    style={{
                        position: "absolute",
                        bottom: 70,
                        display: "flex",
                        fontSize: 20,
                        letterSpacing: 12,
                        color: "#c8944a",
                    }}
                >
                    原石航路
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            fonts: font
                ? [{ name: "NotoSerifJP", data: font, weight: 700, style: "normal" }]
                : undefined,
        },
    );
}
