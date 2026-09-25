/**
 * ============================================================
 * 原石航路 Studio
 * ProBadge — サブスクの機能に付ける印
 *
 * ★ どれがサブスクの機能か、ひと目で分かるようにする。
 *   押し具や見出しの右に、小さく添える。
 *
 * ★ 色は琥珀。
 *   サイトの基本の青（forest）と混ざらない色にする。
 *   青の中に青の印を置くと、押し具の一部に見えてしまう。
 *
 * ★ 色は tailwind の名前ではなく、変数で直に指定する。
 *   設定に amber が無くても崩れないように。
 * ============================================================
 */

export default function ProBadge({ className = "" }: { className?: string }) {
    return (
        <span
            aria-label="サブスクの機能"
            title="サブスクの機能"
            className={[
                "inline-flex shrink-0 items-center rounded-[3px] px-[4px] py-[1px] align-middle text-[9px] font-bold leading-[1.3] tracking-wide",
                className,
            ].join(" ")}
            style={{
                background: "var(--color-amber-tint, #fbf0dd)",
                color: "var(--color-amber, #99610a)",
                boxShadow: "inset 0 0 0 1px rgba(153, 97, 10, 0.28)",
            }}
        >
            Pro
        </span>
    );
}
