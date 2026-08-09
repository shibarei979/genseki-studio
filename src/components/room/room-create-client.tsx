/**
 * ============================================================
 * 原石航路 Studio
 * RoomCreateClient — 執筆室を作成する
 *
 * 一覧の中に折りたたまれていた作成欄を、独立した画面に出した。
 * 部屋を立てるのは何度もする作業ではないぶん、
 * 決めることが多い。一覧の上に開くと、
 * 下の部屋を見ながら書き換えることになって落ち着かない。
 *
 * 3 段に分けている。
 *
 *   設定 … 名前・入れる人・人数・発言
 *   確認 … 決めた内容を並べて見せる
 *   完了 … 立て終わり、模様替えへ渡す
 *
 * 確認を挟むのは、公開範囲を後から変えると
 * すでに URL を配った人に影響が出るため。
 * 立てる前に一度読み返す場所が要る。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";


import { getRepository } from "@/lib/repository";
import { useAuth } from "@/hooks/use-auth";
import { loadIdentity } from "@/lib/room/presence";
import { backgroundFor } from "@/lib/room/room-backgrounds";
import type { RoomVisibility } from "@/types";
import {
    ROOM_VISIBILITY_DESCRIPTION,
    ROOM_VISIBILITY_LABEL,
    SELECTABLE_VISIBILITY,
} from "@/types";

/** 名前と説明の長さ。数えて出すので、ここを唯一の出どころにする */
const NAME_MAX = 20;
const DESC_MAX = 100;

/** 入れる人数 */
const CAPACITY_MIN = 1;
const CAPACITY_MAX = 50;

const STEPS = ["設定", "確認", "完了"] as const;

export default function RoomCreateClient() {
    const router = useRouter();

    /* 部屋主。ログインしていれば、その id を使う */
    const { user } = useAuth();

    const [step, setStep] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [createdId, setCreatedId] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [visibility, setVisibility] = useState<RoomVisibility>("link");
    const [capacity, setCapacity] = useState(10);
    const [allowChat, setAllowChat] = useState(true);
    const [allowVoice, setAllowVoice] = useState(false);
    const [limitCount, setLimitCount] = useState(10);

    const canGoNext = name.trim().length > 0;

    /* 人数で部屋そのものが変わる。下見にはその絵をそのまま出す */
    const background = backgroundFor(capacity);

    async function handleCreate() {
        if (isSaving) return;
        setIsSaving(true);
        setError("");

        try {
            const created = await getRepository().createRoom({
                name: name.trim(),
                description: description.trim(),
                visibility,
                /*
                 * 内装は人数で決まる部屋の絵に紐づく。
                 * 一覧のアイコンにも使うので、部屋の大きさをそのまま入れる。
                 */
                theme: "library",
                /* ログインしていれば、その id を部屋主にする */
                host_id: user?.id ?? loadIdentity().id,
                capacity,
                allow_chat: allowChat,
                allow_host_voice: allowVoice,
                chat_limit_count: limitCount,
            });
            setCreatedId(created.id);
            setStep(2);
        } catch (caught) {
            /*
             * 立てられなかったことを伝えて、確認の段に留める。
             * 完了へ進めてしまうと、無い部屋へ入ろうとすることになる。
             */
            setError(
                caught instanceof Error ? caught.message : "部屋を立てられませんでした",
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-page px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                {/* 見出しと段 */}
                <div className="flex flex-wrap items-start gap-4 border-b border-line px-6 py-5 sm:px-8">
                    <div className="flex min-w-0 items-start gap-3">
                        <InkIcon />
                        <div className="min-w-0">
                            <h1 className="text-[20px] font-semibold tracking-wide text-ink">
                                執筆室を作成する
                            </h1>
                            <p className="mt-0.5 text-[12px] text-muted">
                                あなただけの創作空間をつくりましょう。
                            </p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        <StepBar current={step} />
                        <Link
                            href="/rooms"
                            aria-label="やめて執筆室の一覧へ戻る"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-faint hover:bg-canvas hover:text-ink"
                        >
                            <CloseIcon />
                        </Link>
                    </div>
                </div>

                <div className="grid gap-5 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                    {/* 左。どんな部屋になるか */}
                    <div>
                        {/*
                         * 下見。
                         * 人数を変えると、そのまま入る部屋の絵が入れ替わる。
                         * 立ててから「思っていた広さと違う」と気づくことがない。
                         */}
                        <div className="overflow-hidden rounded-xl border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={background.src}
                                alt={`${background.label}の見取り図`}
                                className="block h-auto w-full"
                            />
                        </div>

                        <p className="mt-2 text-center text-[12px] text-ink">
                            {background.label}
                            <span className="ml-1.5 text-[11px] text-muted">
                                {background.seats.length}席
                            </span>
                        </p>

                        <p className="mt-3 flex items-start gap-2 rounded-lg bg-canvas px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
                            <InfoIcon />
                            部屋の間取りは入室できる人数で決まります。
                            家具の位置は変えられません。
                        </p>
                    </div>

                    {/* 右。決めること */}
                    <div className="min-w-0">
                        {step === 0 && (
                            <SettingsStep
                                name={name}
                                setName={setName}
                                description={description}
                                setDescription={setDescription}
                                visibility={visibility}
                                setVisibility={setVisibility}
                                capacity={capacity}
                                setCapacity={setCapacity}
                                allowChat={allowChat}
                                setAllowChat={setAllowChat}
                                allowVoice={allowVoice}
                                setAllowVoice={setAllowVoice}
                                limitCount={limitCount}
                                setLimitCount={setLimitCount}
                            />
                        )}

                        {step === 1 && (
                            <ReviewStep
                                rows={[
                                    ["部屋の名前", name.trim()],
                                    ["説明", description.trim() || "（なし）"],
                                    ["入れる人", ROOM_VISIBILITY_LABEL[visibility]],
                                    ["最大入室人数", `${capacity}人`],
                                    [
                                        "部屋",
                                        `${background.label}（${background.seats.length}席）`,
                                    ],
                                    [
                                        "文字での発言",
                                        allowChat
                                            ? `許可する（10分あたり${limitCount}回まで）`
                                            : "許可しない",
                                    ],
                                    [
                                        "部屋主のマイク",
                                        allowVoice ? "使う（準備中）" : "使わない",
                                    ],
                                ]}
                                error={error}
                            />
                        )}

                        {step === 2 && <DoneStep name={name.trim()} />}
                    </div>
                </div>

                {/* 下の操作 */}
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4 sm:px-8">
                    {step === 0 && (
                        <>
                            <Link
                                href="/rooms"
                                className="rounded-lg border border-line px-5 py-2.5 text-[13px] text-muted hover:text-ink"
                            >
                                キャンセル
                            </Link>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                disabled={!canGoNext}
                                className="rounded-lg bg-forest-dark px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                            >
                                内容を確認する
                            </button>
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setStep(0)}
                                className="rounded-lg border border-line px-5 py-2.5 text-[13px] text-muted hover:text-ink"
                            >
                                戻って直す
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleCreate()}
                                disabled={isSaving}
                                className="flex items-center gap-2 rounded-lg bg-forest-dark px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                                <SparkIcon />
                                {isSaving ? "立てています" : "執筆室を作成する"}
                            </button>
                        </>
                    )}

                    {step === 2 && createdId && (
                        <>
                            <Link
                                href="/rooms"
                                className="rounded-lg border border-line px-5 py-2.5 text-[13px] text-muted hover:text-ink"
                            >
                                一覧へ戻る
                            </Link>
                            <button
                                type="button"
                                onClick={() => router.push(`/rooms/${createdId}`)}
                                className="rounded-lg bg-forest-dark px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                部屋に入る
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 段の表示
 *
 * 済んだ段も丸を塗る。
 * 現在地だけ塗ると、いくつ終えたのかが分からない。
 * ============================================================
 */

function StepBar({ current }: { current: number }) {
    return (
        <ol className="hidden items-center gap-1.5 sm:flex">
            {STEPS.map((label, index) => (
                <li key={label} className="flex items-center gap-1.5">
                    {index > 0 && (
                        <span
                            className={[
                                "block h-px w-7",
                                index <= current ? "bg-forest" : "bg-line",
                            ].join(" ")}
                        />
                    )}
                    <span className="flex flex-col items-center gap-1">
                        <span
                            aria-current={index === current ? "step" : undefined}
                            className={[
                                "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold",
                                index <= current
                                    ? "bg-forest-dark text-white"
                                    : "bg-canvas text-faint",
                            ].join(" ")}
                        >
                            {index + 1}
                        </span>
                        <span
                            className={[
                                "text-[10px]",
                                index === current ? "text-forest" : "text-faint",
                            ].join(" ")}
                        >
                            {label}
                        </span>
                    </span>
                </li>
            ))}
        </ol>
    );
}

/**
 * ============================================================
 * 1 段目・設定
 * ============================================================
 */

function SettingsStep({
    name,
    setName,
    description,
    setDescription,
    visibility,
    setVisibility,
    capacity,
    setCapacity,
    allowChat,
    setAllowChat,
    allowVoice,
    setAllowVoice,
    limitCount,
    setLimitCount,
}: {
    name: string;
    setName: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    visibility: RoomVisibility;
    setVisibility: (value: RoomVisibility) => void;
    capacity: number;
    setCapacity: (value: number) => void;
    allowChat: boolean;
    setAllowChat: (value: boolean) => void;
    allowVoice: boolean;
    setAllowVoice: (value: boolean) => void;
    limitCount: number;
    setLimitCount: (value: number) => void;
}) {
    /** 上限と下限からはみ出さないようにする */
    function moveCapacity(delta: number) {
        setCapacity(
            Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, capacity + delta)),
        );
    }

    return (
        <div className="space-y-5">
            {/* 基本情報 */}
            <section>
                <SectionTitle icon={<PenIcon />}>基本情報</SectionTitle>

                <div className="mt-2.5 space-y-3">
                    <div>
                        <label
                            htmlFor="room-name"
                            className="block text-[12px] text-muted"
                        >
                            部屋の名前
                        </label>
                        <div className="relative mt-1">
                            <input
                                id="room-name"
                                type="text"
                                value={name}
                                maxLength={NAME_MAX}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="深夜の作業部屋"
                                className="w-full rounded-lg border border-line bg-canvas px-3.5 py-2.5 pr-16 text-[13px] outline-none focus:border-forest focus:bg-surface"
                            />
                            <Counter value={name.length} max={NAME_MAX} />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="room-desc"
                            className="block text-[12px] text-muted"
                        >
                            説明（任意）
                        </label>
                        <div className="relative mt-1">
                            <textarea
                                id="room-desc"
                                value={description}
                                maxLength={DESC_MAX}
                                rows={2}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="22時から2時まで開けています。お気軽にどうぞ。"
                                className="w-full resize-none rounded-lg border border-line bg-canvas px-3.5 py-2.5 pb-6 text-[13px] leading-relaxed outline-none focus:border-forest focus:bg-surface"
                            />
                            <Counter value={description.length} max={DESC_MAX} />
                        </div>
                    </div>
                </div>
            </section>

            {/* 誰が入れるか */}
            <section>
                <SectionTitle icon={<LockIcon />}>アクセス設定</SectionTitle>
                <p className="mt-0.5 text-[11px] text-muted">
                    誰がこの部屋に入れるかを選びましょう
                </p>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {SELECTABLE_VISIBILITY.map((key) => (
                        <label
                            key={key}
                            className={[
                                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-3",
                                visibility === key
                                    ? "border-forest bg-forest-tint"
                                    : "border-line hover:bg-canvas",
                            ].join(" ")}
                        >
                            <input
                                type="radio"
                                name="visibility"
                                checked={visibility === key}
                                onChange={() => setVisibility(key)}
                                className="mt-0.5 accent-[var(--color-forest)]"
                            />
                            <span className="min-w-0">
                                <span className="block text-[13px] font-medium text-ink">
                                    {ROOM_VISIBILITY_LABEL[key]}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                                    {ROOM_VISIBILITY_DESCRIPTION[key]}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>

                {/*
                 * オープンを選んだときだけ知らせる。
                 *
                 * 一覧に並ぶことを知らずに選ぶと、
                 * 知らない人が入ってきたときに驚かせる。
                 */}
                {visibility === "open" && (
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-tint px-3.5 py-2.5 text-[11px] leading-relaxed text-amber">
                        <BulbIcon />
                        この部屋は執筆室の一覧に並びます。
                        URL を渡していない人も入ってきます。
                    </p>
                )}
            </section>

            {/* 人数 */}
            <section>
                <SectionTitle icon={<PeopleIcon />}>入室人数の設定</SectionTitle>
                <p className="mt-0.5 text-[11px] text-muted">
                    同時に入室できる最大人数を設定します
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-[12px] text-ink">最大入室人数</span>

                    <div className="flex items-center overflow-hidden rounded-lg border border-line">
                        <StepButton
                            onClick={() => moveCapacity(-1)}
                            disabled={capacity <= CAPACITY_MIN}
                            label="1人減らす"
                        >
                            −
                        </StepButton>

                        <span className="flex items-baseline gap-1 px-4 py-2">
                            <span className="text-[15px] font-semibold tabular-nums text-ink">
                                {capacity}
                            </span>
                            <span className="text-[11px] text-muted">人</span>
                        </span>

                        <StepButton
                            onClick={() => moveCapacity(1)}
                            disabled={capacity >= CAPACITY_MAX}
                            label="1人増やす"
                        >
                            ＋
                        </StepButton>
                    </div>

                    <span className="text-[11px] text-faint">
                        {CAPACITY_MIN}人〜{CAPACITY_MAX}人まで設定できます
                    </span>

                    {/*
                     * どのひな形が入るかをその場で見せる。
                     * 立ててから「思った広さと違う」と気づくと、
                     * 家具を全部並べ直すことになる。
                     */}
                    <span className="w-full text-[11px] text-muted">
                        この人数だと「{backgroundFor(capacity).label}」（
                        {backgroundFor(capacity).seats.length}席）になります。
                    </span>
                </div>
            </section>

            {/* 発言 */}
            <section>
                <SectionTitle icon={<GearIcon />}>その他の設定</SectionTitle>

                <div className="mt-2 divide-y divide-line rounded-lg border border-line">
                    <ToggleRow
                        icon={<ChatIcon />}
                        title="文字での発言を許可する"
                        note="テキストチャットでの会話を許可します"
                        checked={allowChat}
                        onChange={setAllowChat}
                    />

                    {allowChat && (
                        <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
                            <label
                                htmlFor="room-limit"
                                className="text-[12px] text-muted"
                            >
                                10分あたりの発言回数
                            </label>
                            <input
                                id="room-limit"
                                type="number"
                                min={1}
                                max={60}
                                value={limitCount}
                                onChange={(event) =>
                                    setLimitCount(Number(event.target.value) || 1)
                                }
                                className="w-20 rounded-md border border-line px-2.5 py-1.5 text-[13px] tabular-nums outline-none focus:border-forest"
                            />
                            <span className="text-[11px] text-faint">
                                スタンプは制限しません
                            </span>
                        </div>
                    )}

                    <ToggleRow
                        icon={<MicIcon />}
                        title="部屋主のマイクを使う（任意）"
                        note="声を流す仕組みは調整中です。設定だけ残せます"
                        checked={allowVoice}
                        onChange={setAllowVoice}
                    />
                </div>
            </section>
        </div>
    );
}

/**
 * ============================================================
 * 2 段目・確認
 * ============================================================
 */

function ReviewStep({
    rows,
    error,
}: {
    rows: [string, string][];
    error: string;
}) {
    return (
        <div>
            <SectionTitle icon={<CheckIcon />}>この内容で立てます</SectionTitle>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                名前と説明は後から変えられます。
                入れる人の範囲は、URL を配ったあとに変えると
                入れなくなる人が出ます。ここで決めておくのが安全です。
            </p>

            <dl className="mt-3 divide-y divide-line rounded-lg border border-line">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex gap-4 px-4 py-2.5">
                        <dt className="w-[7.5em] shrink-0 text-[12px] text-muted">
                            {label}
                        </dt>
                        <dd className="min-w-0 flex-1 break-words text-[13px] text-ink">
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>

            {error && (
                <p className="mt-3 rounded-lg bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--color-danger)]">
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 3 段目・完了
 * ============================================================
 */

function DoneStep({ name }: { name: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-tint text-forest">
                <CheckIcon large />
            </span>

            <h2 className="mt-4 text-[17px] font-semibold text-ink">
                「{name}」ができました
            </h2>
            <p className="mt-2 max-w-[24em] text-[12px] leading-[1.9] text-muted">
                好きな席に座って、書きはじめてください。
                URL を渡せば、その人もこの部屋に入れます。
            </p>
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function SectionTitle({
    icon,
    children,
}: {
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <span className="text-forest">{icon}</span>
            {children}
        </h2>
    );
}

/** 入力欄の右下に出す字数。入れた字に重ならないよう内側に余白を取ってある */
function Counter({ value, max }: { value: number; max: number }) {
    return (
        <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-faint">
            {value} / {max}
        </span>
    );
}

function StepButton({
    onClick,
    disabled,
    label,
    children,
}: {
    onClick: () => void;
    disabled: boolean;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="px-3.5 py-2 text-[15px] text-forest hover:bg-forest-tint disabled:text-faint disabled:hover:bg-transparent"
        >
            {children}
        </button>
    );
}

function ToggleRow({
    icon,
    title,
    note,
    checked,
    onChange,
}: {
    icon: React.ReactNode;
    title: string;
    note: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
            <span className="shrink-0 text-faint">{icon}</span>

            <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-ink">{title}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{note}</span>
            </span>

            {/*
             * 見た目だけの切り替え。
             * 本体の checkbox は隠すが、消さずに残す。
             * 消すとキーボードで触れなくなる。
             */}
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="peer sr-only"
            />
            <span
                aria-hidden="true"
                className={[
                    "relative block h-[22px] w-10 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-forest-line",
                    checked ? "bg-forest-dark" : "bg-line",
                ].join(" ")}
            >
                <span
                    className={[
                        "absolute top-[3px] block h-4 w-4 rounded-full bg-white shadow transition-all",
                        checked ? "left-[21px]" : "left-[3px]",
                    ].join(" ")}
                />
            </span>
        </label>
    );
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

function stroke(width = 1.9) {
    return {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: width,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };
}

function InkIcon() {
    return (
        <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            className="shrink-0 text-forest"
            {...stroke(1.6)}
        >
            <path d="M6 20.5h9a2.5 2.5 0 0 0 0-5H8a2 2 0 0 1 0-4h4" />
            <path d="M14.5 12.5 20 4l1.5 1.5-6 8Z" />
            <path d="M4.5 20.5h1.5" />
        </svg>
    );
}

function PenIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(2)}>
            <path d="M4.5 19.5h3.6L19.4 8.2a2.6 2.6 0 0 0-3.6-3.6L4.5 15.9Z" />
            <path d="m14.6 5.8 3.6 3.6" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(2)}>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
        </svg>
    );
}

function PeopleIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(2)}>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
            <path d="M16 5.3a3.2 3.2 0 0 1 0 5.4M17.5 14.9c2 .6 3.5 2.3 3.5 4.6" />
        </svg>
    );
}

function GearIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(2)}>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
        </svg>
    );
}

function ChatIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke(1.9)}>
            <path d="M20.5 12c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.3L4.5 20.5l1.3-3.6A6.9 6.9 0 0 1 3.5 12c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" />
        </svg>
    );
}

function MicIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke(1.9)}>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
        </svg>
    );
}

function BulbIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            className="mt-px shrink-0"
            {...stroke(1.9)}
        >
            <path d="M9.5 17.5h5M10.5 20.5h3" />
            <path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6h-5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5Z" />
        </svg>
    );
}

function InfoIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            className="mt-px shrink-0"
            {...stroke(1.9)}
        >
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 11v5.5M12 7.8v.4" />
        </svg>
    );
}

function CheckIcon({ large = false }: { large?: boolean }) {
    const size = large ? 26 : 15;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2.2)}>
            <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
    );
}

function SparkIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(1.9)}>
            <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9Z" />
            <path d="M18.5 16.5 19 18.5l2 .5-2 .5-.5 2-.5-2-2-.5 2-.5Z" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" {...stroke(2)}>
            <path d="m6 6 12 12M18 6 6 18" />
        </svg>
    );
}
