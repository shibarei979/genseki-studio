"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * DressUpButton — アイコン衣装と称号を選ぶ
 *
 *   マイページの「プロフィールを編集」「公開ページを見る」の横に置く。
 *   押すと小窓が開き、持っている衣装を 1 つ、称号を 3 つまで選べる。
 *
 * ★ 持っていないものは出さない（アイテムツリーへの案内だけ出す）。
 * ★ 選んだらすぐ保存する。閉じたら頁を読み直して、アイコンに反映する。
 * ============================================================
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import CostumeOverlay from "@/components/common/costume-overlay";

interface Item {
    id: string;
    kind: string;
    name: string;
    asset_url: string | null;
    is_active: boolean;
}

const MAX_TITLES = 3;

export default function DressUpButton({
    iconUrl,
    initial,
    className,
    style,
}: {
    iconUrl: string | null;
    /** 名前の頭文字（アイコンが無いとき） */
    initial: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [costumeId, setCostumeId] = useState<string | null>(null);
    const [titleIds, setTitleIds] = useState<string[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [changed, setChanged] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let alive = true;
        void (async () => {
            try {
                const [itemsRes, equipRes] = await Promise.all([
                    fetch("/api/points/items"),
                    fetch("/api/points/equip"),
                ]);
                const data = (await itemsRes.json()) as { items?: Item[]; owned?: string[] };
                const worn = (await equipRes.json()) as { costumeId?: string | null; titles?: { id: string }[] };
                if (!alive) return;
                const owned = new Set(data.owned ?? []);
                setItems(
                    (data.items ?? []).filter(
                        (one) => owned.has(one.id) && one.is_active && (one.kind === "costume" || one.kind === "badge"),
                    ),
                );
                setCostumeId(worn.costumeId ?? null);
                setTitleIds((worn.titles ?? []).map((one) => one.id));
            } catch {
                if (alive) setMessage("読み込めませんでした。");
            } finally {
                if (alive) setIsLoaded(true);
            }
        })();
        return () => {
            alive = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, changed]);

    function close() {
        setIsOpen(false);
        setMessage("");
        if (changed) {
            setChanged(false);
            router.refresh();
        }
    }

    async function save(body: Record<string, unknown>): Promise<boolean> {
        setBusy(true);
        setMessage("");
        try {
            const response = await fetch("/api/points/equip", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok || data.error) {
                setMessage(data.error ?? "うまくいきませんでした。");
                return false;
            }
            setChanged(true);
            /* マイページの称号の段にも、すぐ出す */
            window.dispatchEvent(new Event("gk-titles-changed"));
            return true;
        } catch {
            setMessage("繋がりませんでした。");
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function pickCostume(id: string | null) {
        if (busy || id === costumeId) return;
        if (await save({ costumeId: id })) setCostumeId(id);
    }

    async function toggleTitle(id: string) {
        if (busy) return;
        const next = titleIds.includes(id) ? titleIds.filter((one) => one !== id) : [...titleIds, id];
        if (next.length > MAX_TITLES) {
            setMessage(`称号は${MAX_TITLES}つまでです。どれかを外してください。`);
            return;
        }
        if (await save({ titleIds: next })) setTitleIds(next);
    }

    const costumes = items.filter((one) => one.kind === "costume");
    const titles = items.filter((one) => one.kind === "badge");
    const worn = costumes.find((one) => one.id === costumeId)?.asset_url ?? null;

    return (
        <>
            <button type="button" className={className} style={style} onClick={() => setIsOpen(true)}>
                衣装・称号
            </button>

            {isOpen && createPortal(
                <div className="lpop-dim" onClick={close}>
                    <div className="dru" role="dialog" aria-modal="true" aria-label="衣装・称号" onClick={(event) => event.stopPropagation()}>
                        <div className="dru-h">
                            <b>衣装・称号</b>
                            <button type="button" onClick={close} aria-label="とじる">
                                ×
                            </button>
                        </div>

                        <div className="dru-preview">
                            <span className="dru-av">
                                {iconUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={iconUrl} alt="" />
                                ) : (
                                    <span className="dru-av-none">{initial}</span>
                                )}
                                <CostumeOverlay url={worn} size={72} />
                            </span>
                            <span className="dru-ttl">
                                {titleIds
                                    .map((id) => titles.find((one) => one.id === id))
                                    .filter(Boolean)
                                    .map((one) =>
                                        one!.asset_url ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img key={one!.id} src={one!.asset_url} alt={one!.name} />
                                        ) : (
                                            <em key={one!.id}>{one!.name}</em>
                                        ),
                                    )}
                            </span>
                        </div>

                        {!isLoaded ? (
                            <p className="dru-note">読み込み中…</p>
                        ) : (
                            <>
                                <p className="dru-sec">アイコン衣装（1つ）</p>
                                {costumes.length === 0 ? (
                                    <p className="dru-note">
                                        まだ持っていません。<Link href="/mypage#items" onClick={close}>アイテムツリー</Link>で交換できます。
                                    </p>
                                ) : (
                                    <ul className="dru-grid">
                                        <li>
                                            <button
                                                type="button"
                                                className={`dru-pick${costumeId === null ? " is-on" : ""}`}
                                                onClick={() => void pickCostume(null)}
                                                disabled={busy}
                                            >
                                                <span className="dru-none">なし</span>
                                            </button>
                                        </li>
                                        {costumes.map((one) => (
                                            <li key={one.id}>
                                                <button
                                                    type="button"
                                                    className={`dru-pick${costumeId === one.id ? " is-on" : ""}`}
                                                    onClick={() => void pickCostume(one.id)}
                                                    disabled={busy}
                                                    title={one.name}
                                                >
                                                    {one.asset_url && (
                                                        /* eslint-disable-next-line @next/next/no-img-element */
                                                        <img src={one.asset_url} alt={one.name} />
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <p className="dru-sec">
                                    称号（{MAX_TITLES}つまで　{titleIds.length}/{MAX_TITLES}）
                                </p>
                                {titles.length === 0 ? (
                                    <p className="dru-note">
                                        まだ持っていません。<Link href="/mypage#items" onClick={close}>アイテムツリー</Link>で交換できます。
                                    </p>
                                ) : (
                                    <ul className="dru-titles">
                                        {titles.map((one) => {
                                            const on = titleIds.includes(one.id);
                                            return (
                                                <li key={one.id}>
                                                    <button
                                                        type="button"
                                                        className={`dru-title${on ? " is-on" : ""}`}
                                                        onClick={() => void toggleTitle(one.id)}
                                                        disabled={busy}
                                                        title={one.name}
                                                    >
                                                        {one.asset_url ? (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img src={one.asset_url} alt={one.name} />
                                                        ) : (
                                                            one.name
                                                        )}
                                                        {on && <span className="dru-mark">{titleIds.indexOf(one.id) + 1}</span>}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </>
                        )}

                        {message && <p className="dru-msg">{message}</p>}
                        <button type="button" className="lpop-close" onClick={close}>
                            とじる
                        </button>
                    </div>
                </div>,
                /* ★ 体の直下に出す。祖先に transform 等があると、画面いっぱいに広がらないため */
                document.body,
            )}
        </>
    );
}
