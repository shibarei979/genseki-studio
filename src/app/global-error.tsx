"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * global-error — 土台ごと組み立てに失敗したとき
 *
 * error.tsx は、その中の画面が失敗したときに出る。
 * ただし土台（layout）そのものが失敗すると、
 * error.tsx を包む器も無いので出せない。
 *
 * こちらは器ごと自分で用意する。
 * だから <html> と <body> から書く。
 *
 * 土台が壊れているので、共通の色や字体は使えない。
 * 見た目はここに直接書く。
 *
 * めったに出ないが、出たときに何も出ないのが一番困る。
 * ============================================================
 */

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="ja">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f4f5f3",
                    color: "#2b2b2b",
                    fontFamily:
                        "'Hiragino Sans', 'Noto Sans JP', system-ui, sans-serif",
                    padding: "0 24px",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, margin: 0 }}>
                        うまく表示できませんでした。
                    </p>
                    <p
                        style={{
                            fontSize: 12,
                            lineHeight: 1.8,
                            color: "#6b6b6b",
                            margin: "8px auto 0",
                            maxWidth: 360,
                        }}
                    >
                        しばらく待ってから、もう一度お試しください。
                    </p>

                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            marginTop: 24,
                            padding: "9px 22px",
                            fontSize: 14,
                            color: "#fff",
                            background: "#1f4e6b",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                        }}
                    >
                        もう一度読み込む
                    </button>

                    {error.digest && (
                        <p
                            style={{
                                marginTop: 24,
                                fontSize: 11,
                                color: "#9a9a9a",
                            }}
                        >
                            お問い合わせの際は、この番号をお伝えください
                            <br />
                            <span style={{ fontFamily: "monospace" }}>
                                {error.digest}
                            </span>
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
