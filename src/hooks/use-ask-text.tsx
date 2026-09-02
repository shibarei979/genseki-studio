/**
 * ============================================================
 * 原石航路 Studio
 * 文字を尋ねる小窓
 *
 * ★ ブラウザの window.prompt は、出ない機械がある。
 *
 *   X や LINE の中で開いた画面（アプリ内の閲覧機能）では、
 *   prompt が黙って握りつぶされ、null が返る。
 *   押し具を押しても何も起きないので、
 *   「押せない」と見える。作った本人の機械では出るので気づけない。
 *
 *   自前の小窓なら、どの機械でも同じように出る。
 *
 * 使い方
 *
 *   const { ask, dialog } = useAskText();
 *   const name = await ask("章の名前", "");   // やめたら null
 *   ...
 *   return (<>{dialog}...</>)
 * ============================================================
 */

"use client";

import { useCallback, useRef, useState } from "react";

interface AskState {
    message: string;
    value: string;
}

export function useAskText() {
    const [state, setState] = useState<AskState | null>(null);
    const resolve = useRef<((value: string | null) => void) | null>(null);

    const ask = useCallback((message: string, initial = "") => {
        setState({ message, value: initial });
        return new Promise<string | null>((done) => {
            resolve.current = done;
        });
    }, []);

    const close = useCallback((value: string | null) => {
        resolve.current?.(value);
        resolve.current = null;
        setState(null);
    }, []);

    const dialog = state ? (
        <div
            onClick={() => close(null)}
            className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
        >
            <div
                onClick={(event) => event.stopPropagation()}
                className="w-[min(420px,100%)] rounded-xl border border-line bg-surface p-4 shadow-lg"
            >
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                    {state.message}
                </p>

                <input
                    autoFocus
                    value={state.value}
                    onChange={(event) =>
                        setState((prev) =>
                            prev ? { ...prev, value: event.target.value } : prev,
                        )
                    }
                    onKeyDown={(event) => {
                        if (event.key === "Enter") close(state.value);
                        if (event.key === "Escape") close(null);
                    }}
                    className="mt-3 w-full rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
                />

                <div className="mt-3 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => close(null)}
                        className="rounded-md border border-line px-3 py-1.5 text-[12px] text-muted hover:text-ink"
                    >
                        やめる
                    </button>
                    <button
                        type="button"
                        onClick={() => close(state.value)}
                        className="rounded-md bg-forest px-4 py-1.5 text-[12px] text-white hover:bg-forest-dark"
                    >
                        決める
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return { ask, dialog };
}
