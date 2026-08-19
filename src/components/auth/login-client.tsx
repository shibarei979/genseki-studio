/**
 * ============================================================
 * 原石航路 Studio
 * LoginClient — ログインと登録
 *
 * 登録は 2 段。
 *   1. ペンネーム・メール・合言葉
 *   2. 生年月日・同意
 *
 * 分けるのは、最初の画面で並ぶ入力欄を減らすため。
 * 全部を一度に見せると、多さで手が止まる。
 *
 * Google でも入れる。その場合は生年月日を聞かない。
 * あとから設定で入れてもらう。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { hasSupabase } from "@/config/env.client";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

interface Props {
    /**
     * 開いたときにどちら側を出すか。
     * 「無料で始める」から来た人にログイン画面を出すと、
     * 持っていない合言葉を求められて行き止まりになる。
     */
    initialMode?: Mode;
}

export default function LoginClient({ initialMode = "signin" }: Props) {
    const router = useRouter();

    const [mode, setMode] = useState<Mode>(initialMode);

    /*
     * ログインしたあとの行き先。
     *
     * 「執筆画面を開こうとしてログインを求められた」人は、
     * 入ったあとその場所へ戻りたい。
     * ホームへ放り出すと、もう一度たどることになる。
     */
    const [nextPath, setNextPath] = useState("/");

    useEffect(() => {
        const to = new URLSearchParams(window.location.search).get("next");
        /* 外のサイトへは飛ばさない。「/」で始まる道だけ */
        if (to && to.startsWith("/") && !to.startsWith("//")) setNextPath(to);
    }, []);

    /*
     * 戻ってきたときの理由を出す。
     *
     * 黙ってログイン画面に戻すと、
     * 押した人には「何も起きなかった」ようにしか見えない。
     */
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        if (params.get("error") === "banned") {
            setError("このアカウントは利用できません（BANされています）。");
            return;
        }

        if (params.get("error") !== "callback") return;

        const reason = params.get("reason");
        setError(
            reason
                ? `ログインを完了できませんでした（${reason}）`
                : "ログインを完了できませんでした。",
        );
    }, []);
    const [step, setStep] = useState<1 | 2>(1);

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [birthYear, setBirthYear] = useState("");
    const [birthMonth, setBirthMonth] = useState("");
    const [birthDay, setBirthDay] = useState("");
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreeAge, setAgreeAge] = useState(false);

    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    if (!hasSupabase()) return <NotConnected />;

    /** 生年月日から歳を出す。選び終えていなければ -1 */
    function calcAge(): number {
        if (!birthYear || !birthMonth || !birthDay) return -1;

        const birth = new Date(
            Number(birthYear),
            Number(birthMonth) - 1,
            Number(birthDay),
        );
        const today = new Date();

        let age = today.getFullYear() - birth.getFullYear();
        // 誕生日がまだ来ていなければ 1 つ引く
        if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) {
            age -= 1;
        }
        return age;
    }

    /*
     * よそのアカウントで入る。
     *
     * Google・X・GitHub で作りは同じなので 1 つにまとめる。
     * 生年月日を聞かないのも同じ（向こうで済んでいる）。
     *
     * queryParams は Google だけ。X と GitHub に渡すと弾かれる。
     */
    /*
     * この住所は BAN されていないか。
     *
     * BAN のときは認証ごと消してあるので、
     * そのまま進むと「新しく登録できてしまう」。
     * 入る前と、作る前に確かめる。
     */
    async function isBanned(target: string): Promise<boolean> {
        try {
            const response = await fetch("/api/auth/check-ban", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: target }),
            });
            const data = await response.json();
            return data?.banned === true;
        } catch {
            /* 確かめられなければ通す。ここで全員を止めない */
            return false;
        }
    }

    async function signInWith(
        provider: "google" | "twitter" | "github",
        label: string,
    ) {
        setIsBusy(true);
        setError("");

        /* 戻ってきたときに読む。住所には付けられないので端末に控える */
        try {
            window.sessionStorage.setItem("genseki:login-next", nextPath);
        } catch {
            /* 控えられなくても、ホームへは戻れる */
        }

        const { error: caught } = await createClient().auth.signInWithOAuth({
            provider,
            options: {
                /*
                 * 問い符から後ろは付けない。
                 *
                 * Supabase の Redirect URLs は ** を付けても
                 * 「?」以降が付いた住所を別物として扱う。
                 * 行き先はどのみちホームなので、付ける得が無い。
                 */
                /*
                 * 戻り先は住所に付けず、端末に控える。
                 * 問い符から後ろを付けると Supabase が弾く。
                 */
                redirectTo: `${window.location.origin}/auth/callback`,
                ...(provider === "google"
                    ? { queryParams: { access_type: "offline", prompt: "consent" } }
                    : {}),
            },
        });

        if (caught) {
            setError(`${label} での登録に進めませんでした。`);
            setIsBusy(false);
        }
    }

    /** 1 段目。入力を確かめて 2 段目へ */
    function goToStep2() {
        setError("");

        if (!displayName.trim()) {
            setError("ペンネームを入れてください。");
            return;
        }
        if (!email.trim()) {
            setError("メールアドレスを入れてください。");
            return;
        }
        if (password.length < 6) {
            setError("合言葉は6文字以上にしてください。");
            return;
        }
        if (password !== confirm) {
            setError("合言葉が一致しません。");
            return;
        }

        setStep(2);
    }

    async function submitSignUp() {
        setError("");

        const age = calcAge();
        if (age < 0) {
            setError("生年月日を選んでください。");
            return;
        }
        if (age < 13) {
            setError("13歳未満の方は登録できません。");
            return;
        }
        if (!agreeTerms) {
            setError("利用規約への同意が必要です。");
            return;
        }
        if (!agreeAge) {
            setError("年齢についての確認に同意してください。");
            return;
        }

        setIsBusy(true);

        if (await isBanned(email.trim())) {
            setError("このメールアドレスは利用できません（BANされています）。");
            setIsBusy(false);
            return;
        }

        const birthdate = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;

        const { error: caught } = await createClient().auth.signUp({
            email: email.trim(),
            password,
            options: {
                /*
                 * ここに預けたものが、登録の引き金から profiles へ入る。
                 * 画面から別途書き込むと、作られる前後で取り合いになる。
                 */
                data: {
                    display_name: displayName.trim(),
                    birthdate,
                    age_verified: age >= 18,
                    agreed: true,
                },
            },
        });

        setIsBusy(false);

        if (caught) {
            setError(describe(caught.message));
            return;
        }

        const { data: session } = await createClient().auth.getSession();
        if (session.session) {
            router.push(nextPath);
            router.refresh();
            return;
        }

        setNotice("確かめのメールを送りました。届いた道筋を開くと、登録が終わります。");
    }

    async function submitSignIn() {
        setError("");

        if (!email.trim() || !password) {
            setError("メールと合言葉を入れてください。");
            return;
        }

        setIsBusy(true);

        if (await isBanned(email.trim())) {
            setError("このメールアドレスは利用できません（BANされています）。");
            setIsBusy(false);
            return;
        }

        const { error: caught } = await createClient().auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        setIsBusy(false);

        if (caught) {
            setError(describe(caught.message));
            return;
        }

        router.push(nextPath);
        router.refresh();
    }

    return (
        <div
            className="flex min-h-screen items-center justify-center px-6 py-12"
            style={{ background: "var(--color-canvas)" }}
        >
            <div className="w-full max-w-md rounded-2xl bg-surface px-7 py-9 shadow-sm">
                {/* ロゴ */}
                <Link href="/lp" className="mx-auto block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.svg" alt="原石航路" className="h-16 w-auto" />
                </Link>

                <h1 className="mt-5 text-center text-[22px] font-semibold text-ink">
                    {mode === "signin" ? "ログイン" : "アカウント登録"}
                </h1>
                <p className="mt-1.5 text-center text-xs text-muted">
                    {mode === "signin"
                        ? "書いたものを、どの端末からでも"
                        : "書く、調べる、集まる"}
                </p>

                {/* 段の目印 */}
                {mode === "signup" && (
                    <div className="mt-6 flex">
                        {(
                            [
                                { no: 1, label: "アカウント情報" },
                                { no: 2, label: "年齢・同意" },
                            ] as const
                        ).map((row) => (
                            <div
                                key={row.no}
                                className="flex-1 border-b-2 pb-2.5 text-center"
                                style={{
                                    borderColor:
                                        step === row.no
                                            ? "var(--color-forest)"
                                            : "var(--color-line)",
                                }}
                            >
                                <span
                                    className="text-[13px]"
                                    style={{
                                        color:
                                            step === row.no
                                                ? "var(--color-forest)"
                                                : "var(--color-faint)",
                                        fontWeight: step === row.no ? 600 : 400,
                                    }}
                                >
                                    {row.no} {row.label}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* よそのアカウントで入る */}
                {step === 1 && (
                    <>
                        <div className="mt-6 space-y-2">
                            <button
                                type="button"
                                onClick={() => void signInWith("google", "Google")}
                                disabled={isBusy}
                                className="flex w-full items-center justify-center gap-3 rounded-lg border border-line py-3 text-sm text-ink hover:border-forest-line disabled:opacity-50"
                            >
                                <GoogleMark />
                                Google で{mode === "signin" ? "ログイン" : "登録"}
                            </button>

                            <button
                                type="button"
                                onClick={() => void signInWith("twitter", "X")}
                                disabled={isBusy}
                                className="flex w-full items-center justify-center gap-3 rounded-lg border border-line py-3 text-sm text-ink hover:border-forest-line disabled:opacity-50"
                            >
                                <XMark />
                                X で{mode === "signin" ? "ログイン" : "登録"}
                            </button>

                            <button
                                type="button"
                                onClick={() => void signInWith("github", "GitHub")}
                                disabled={isBusy}
                                className="flex w-full items-center justify-center gap-3 rounded-lg border border-line py-3 text-sm text-ink hover:border-forest-line disabled:opacity-50"
                            >
                                <GitHubMark />
                                GitHub で{mode === "signin" ? "ログイン" : "登録"}
                            </button>
                        </div>

                        <div className="my-5 flex items-center gap-3">
                            <span className="h-px flex-1 bg-[var(--color-line)]" />
                            <span className="text-[11px] text-faint">
                                またはメールアドレスで
                            </span>
                            <span className="h-px flex-1 bg-[var(--color-line)]" />
                        </div>
                    </>
                )}

                {/* 1 段目 */}
                {step === 1 && (
                    <div className="space-y-4">
                        {mode === "signup" && (
                            <Field label="ペンネーム" note="作者名として公開されます">
                                <input
                                    type="text"
                                    value={displayName}
                                    maxLength={30}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="例：月詠零"
                                    className={inputClass}
                                />
                            </Field>
                        )}

                        <Field label="メールアドレス">
                            <input
                                type="email"
                                value={email}
                                autoComplete="email"
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className={inputClass}
                            />
                        </Field>

                        <Field
                            label={
                                mode === "signup" ? "合言葉（6文字以上）" : "合言葉"
                            }
                        >
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    autoComplete={
                                        mode === "signin"
                                            ? "current-password"
                                            : "new-password"
                                    }
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && mode === "signin") {
                                            void submitSignIn();
                                        }
                                    }}
                                    placeholder={
                                        mode === "signup" ? "6文字以上" : undefined
                                    }
                                    className={`${inputClass} pr-14`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((open) => !open)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint hover:text-ink"
                                >
                                    {showPassword ? "隠す" : "表示"}
                                </button>
                            </div>
                        </Field>

                        {mode === "signup" && (
                            <Field label="合言葉（確認）">
                                <input
                                    type="password"
                                    value={confirm}
                                    autoComplete="new-password"
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="もう一度入力"
                                    className={inputClass}
                                />
                            </Field>
                        )}
                    </div>
                )}

                {/* 2 段目 */}
                {step === 2 && (
                    <div className="mt-6 space-y-5">
                        <div>
                            <p className="text-xs font-medium text-ink">生年月日</p>
                            <p className="mt-0.5 text-[10px] text-faint">
                                年齢の確認に使います。ほかの人には見えません。
                            </p>

                            <div className="mt-2 flex gap-2">
                                <Select
                                    value={birthYear}
                                    onChange={setBirthYear}
                                    placeholder="年"
                                    options={years()}
                                    suffix="年"
                                />
                                <Select
                                    value={birthMonth}
                                    onChange={setBirthMonth}
                                    placeholder="月"
                                    options={range(1, 12)}
                                    suffix="月"
                                />
                                <Select
                                    value={birthDay}
                                    onChange={setBirthDay}
                                    placeholder="日"
                                    options={range(1, 31)}
                                    suffix="日"
                                />
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <Check
                                checked={agreeTerms}
                                onChange={setAgreeTerms}
                                label="利用規約とプライバシーポリシーに同意します"
                            />
                            <Check
                                checked={agreeAge}
                                onChange={setAgreeAge}
                                label="13歳以上であることを確認しました"
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <p className="mt-4 rounded-md bg-[var(--color-danger-tint)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-danger)]">
                        {error}
                    </p>
                )}

                {notice && (
                    <p className="mt-4 rounded-md bg-forest-tint px-3 py-2 text-[11px] leading-relaxed text-ink">
                        {notice}
                    </p>
                )}

                {/* 進む */}
                <button
                    type="button"
                    onClick={() => {
                        if (mode === "signin") return void submitSignIn();
                        if (step === 1) return goToStep2();
                        void submitSignUp();
                    }}
                    disabled={isBusy}
                    className="mt-6 w-full rounded-lg bg-forest py-3 text-sm font-medium text-white hover:bg-forest-dark disabled:opacity-40"
                >
                    {isBusy
                        ? "少し待ってください"
                        : mode === "signin"
                          ? "ログイン"
                          : step === 1
                            ? "次へ →"
                            : "登録する"}
                </button>

                {/* 戻る */}
                {mode === "signup" && step === 2 && (
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="mt-2 w-full py-2 text-xs text-muted hover:text-ink"
                    >
                        ← 戻る
                    </button>
                )}

                <p className="mt-5 text-center text-xs text-muted">
                    {mode === "signin" ? "はじめての方は" : "すでにお持ちの方は"}
                    <button
                        type="button"
                        onClick={() => {
                            setMode(mode === "signin" ? "signup" : "signin");
                            setStep(1);
                            setError("");
                            setNotice("");
                        }}
                        className="ml-1.5 font-medium text-forest hover:underline"
                    >
                        {mode === "signin" ? "アカウント登録" : "ログインはこちら"}
                    </button>
                </p>

                <Link
                    href="/lp"
                    className="mt-3 block text-center text-[11px] text-faint hover:text-forest"
                >
                    原石航路 Studio について
                </Link>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

const inputClass =
    "mt-1 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm outline-none focus:border-forest";

function Field({
    label,
    note,
    children,
}: {
    label: string;
    note?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-xs font-medium text-ink">
                {label}
                <span className="ml-1 text-[var(--color-danger)]">*</span>
            </span>
            {children}
            {note && <span className="mt-1 block text-[10px] text-faint">{note}</span>}
        </label>
    );
}

function Select({
    value,
    onChange,
    placeholder,
    options,
    suffix,
}: {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    options: number[];
    suffix: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={placeholder}
            className="min-w-0 flex-1 rounded-lg border border-line px-2 py-2.5 text-sm outline-none focus:border-forest"
        >
            <option value="">{placeholder}</option>
            {options.map((n) => (
                <option key={n} value={String(n)}>
                    {n}
                    {suffix}
                </option>
            ))}
        </select>
    );
}

function Check({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-2.5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-forest)]"
            />
            <span className="text-[12px] leading-relaxed text-ink">{label}</span>
        </label>
    );
}

function NotConnected() {
    return (
        <div
            className="flex min-h-screen items-center justify-center px-6"
            style={{ background: "var(--color-canvas)" }}
        >
            <div className="max-w-md rounded-2xl bg-surface px-8 py-10 text-center shadow-sm">
                <p className="text-sm text-ink">まだ繋がっていません</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                    保存先を用意すると、ここからログインできるようになります。
                    いまは自分の端末の中だけで動いています。
                </p>
                <Link
                    href="/"
                    className="mt-6 inline-block rounded-lg border border-line px-5 py-2 text-xs text-muted hover:border-forest-line hover:text-forest"
                >
                    ホームへ戻る
                </Link>
            </div>
        </div>
    );
}

/** X の印。旧 Twitter。Supabase 側の名前は今も twitter */
function XMark() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.53 3h3.2l-6.99 7.99L22 21h-6.44l-5.04-6.6L4.75 21H1.54l7.48-8.55L2 3h6.6l4.56 6.03L17.53 3Zm-1.12 16.06h1.77L7.68 4.84H5.78l10.63 14.22Z" />
        </svg>
    );
}

/** GitHub の印 */
function GitHubMark() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10Z" />
        </svg>
    );
}

function GoogleMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
            />
            <path
                fill="#34A853"
                d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24Z"
            />
            <path
                fill="#FBBC05"
                d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z"
            />
            <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
            />
        </svg>
    );
}

/** 年の選択肢。100 年ぶん */
function years(): number[] {
    const now = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => now - i);
}

function range(from: number, to: number): number[] {
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Supabase の英語の返事を、対処が分かる言い方にする */
function describe(message: string): string {
    if (message.includes("Invalid login credentials")) {
        return "メールか合言葉が違います。";
    }
    if (message.includes("already registered") || message.includes("User already")) {
        return "このメールアドレスはすでに登録されています。ログインしてください。";
    }
    if (message.includes("Email not confirmed")) {
        return "メールの確かめが済んでいません。届いた道筋を開いてください。";
    }
    if (message.includes("rate limit")) {
        return "少し時間をおいてから、もう一度お試しください。";
    }
    return "うまくいきませんでした。しばらくしてからお試しください。";
}
