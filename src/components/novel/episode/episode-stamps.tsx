"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeStamps — 話の終わりで押すスタンプ
 *
 *   押されたスタンプ（多い順・数つき）
 *   ［スタンプを押す］ → 持っているスタンプの一覧から選ぶ
 *
 * ★ 押せるのは、アイテムツリーで交換したスタンプだけ。
 *   持っていない人には、どこで手に入るかを案内する。
 *
 * ★ 押し直すと外れる。自分が押したものは色つきの枠で分かる。
 *
 * ★ 押した瞬間に数を動かす（待たせない）。
 *   失敗したら、読み直して元に戻す。
 * ============================================================
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Pressed {
    id: string;
    name: string;
    url: string | null;
    count: number;
    mine: boolean;
}

interface Owned {
    id: string;
    name: string;
    url: string | null;
}

type StampData = { stamps?: Pressed[]; owned?: Owned[]; loggedIn?: boolean };

/*
 * ★ 同じ話を同時に読みに行くのは 1 回だけにする。
 *   話ページは携帯用とパソコン用の両方を描いて CSS で片方を隠すので、
 *   このままだと開くたびに 2 回ずつ読みに行ってしまう。
 */
const loading = new Map<string, Promise<StampData | null>>();

function loadStamps(episodeId: string): Promise<StampData | null> {
    const now = loading.get(episodeId);
    if (now) return now;
    const next = fetch(`/api/stamps?episode=${encodeURIComponent(episodeId)}`)
        .then((response) => (response.ok ? (response.json() as Promise<StampData>) : null))
        .finally(() => loading.delete(episodeId));
    loading.set(episodeId, next);
    return next;
}

export default function EpisodeStamps({ episodeId }: { episodeId: string }) {
    const [stamps, setStamps] = useState<Pressed[]>([]);
    const [owned, setOwned] = useState<Owned[]>([]);
    const [loggedIn, setLoggedIn] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isTrayOpen, setIsTrayOpen] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [message, setMessage] = useState("");

    const reload = useCallback(async () => {
        try {
            const data = await loadStamps(episodeId);
            if (!data) return;
            setStamps(data.stamps ?? []);
            setOwned(data.owned ?? []);
            setLoggedIn(Boolean(data.loggedIn));
        } catch {
            /* 読めなくても、本文は読める */
        } finally {
            setIsLoaded(true);
        }
    }, [episodeId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const ownedIds = new Set(owned.map((one) => one.id));

    async function press(item: Owned) {
        if (busyId) return;
        setBusyId(item.id);
        setMessage("");

        /* 先に見た目を動かす */
        setStamps((list) => {
            const found = list.find((one) => one.id === item.id);
            if (found) {
                return list
                    .map((one) =>
                        one.id === item.id
                            ? { ...one, mine: !one.mine, count: one.count + (one.mine ? -1 : 1) }
                            : one,
                    )
                    .filter((one) => one.count > 0);
            }
            return [...list, { ...item, count: 1, mine: true }];
        });

        try {
            const response = await fetch("/api/stamps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ episodeId, itemId: item.id }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok || data.error) {
                setMessage(data.error ?? "うまくいきませんでした。");
                await reload();
            }
        } catch {
            setMessage("繋がりませんでした。");
            await reload();
        } finally {
            setBusyId(null);
        }
    }

    /* 読み込み前と、誰も押していない・押せない人には場所を取りすぎない */
    if (!isLoaded) return null;
    if (!loggedIn && stamps.length === 0) return null;

    return (
        <section className="eps" aria-label="スタンプ">
            {stamps.length > 0 && (
                <ul className="eps-list">
                    {stamps.map((one) => {
                        const canPress = ownedIds.has(one.id);
                        return (
                            <li key={one.id}>
                                <button
                                    type="button"
                                    className={`eps-chip${one.mine ? " is-mine" : ""}`}
                                    onClick={() => canPress && void press(one)}
                                    disabled={!canPress || busyId === one.id}
                                    title={
                                        canPress
                                            ? one.mine
                                                ? `「${one.name}」を外す`
                                                : `「${one.name}」を押す`
                                            : one.name
                                    }
                                >
                                    {one.url && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={one.url} alt={one.name} />
                                    )}
                                    <span className="eps-count">{one.count}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {loggedIn ? (
                owned.length > 0 ? (
                    <button
                        type="button"
                        className="eps-open"
                        onClick={() => setIsTrayOpen((now) => !now)}
                        aria-expanded={isTrayOpen}
                    >
                        {isTrayOpen ? "とじる" : "スタンプを押す"}
                    </button>
                ) : (
                    <p className="eps-note">
                        スタンプは
                        <Link href="/mypage#items">アイテムツリー</Link>
                        で交換すると、ここで押せます。
                    </p>
                )
            ) : (
                stamps.length > 0 && <p className="eps-note">ログインすると、スタンプを押せます。</p>
            )}

            {isTrayOpen && owned.length > 0 && (
                <ul className="eps-tray">
                    {owned.map((one) => {
                        const isMine = stamps.some((s) => s.id === one.id && s.mine);
                        return (
                            <li key={one.id}>
                                <button
                                    type="button"
                                    className={`eps-pick${isMine ? " is-mine" : ""}`}
                                    onClick={() => void press(one)}
                                    disabled={busyId === one.id}
                                    title={isMine ? `「${one.name}」を外す` : `「${one.name}」を押す`}
                                >
                                    {one.url && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={one.url} alt={one.name} />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {message && <p className="eps-msg">{message}</p>}
        </section>
    );
}
