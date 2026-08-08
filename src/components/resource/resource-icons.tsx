/**
 * ============================================================
 * 原石航路 Studio
 * 資料ページのアイコン
 *
 * ページの種類が一目で分かるようにする。
 * 文字だけの一覧は、数が増えると全部同じ顔になる。
 * ============================================================
 */

interface Props {
    /** 組み込みページの識別子。自作ページは null */
    builtinKey: string | null;
    size?: number;
    className?: string;
}

export default function ResourceIcon({ builtinKey, size = 18, className }: Props) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2.1,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        className,
        "aria-hidden": true,
    };

    switch (builtinKey) {
        case "character":
            return (
                <svg {...common}>
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
                </svg>
            );
        case "place":
            return (
                <svg {...common}>
                    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                </svg>
            );
        case "relation":
            return (
                <svg {...common}>
                    <circle cx="6" cy="7" r="2.5" />
                    <circle cx="18" cy="7" r="2.5" />
                    <circle cx="12" cy="18" r="2.5" />
                    <path d="M8 8.5 10.5 16M16 8.5 13.5 16M8.5 7h7" />
                </svg>
            );
        case "timeline":
            return (
                <svg {...common}>
                    <rect x="3.5" y="5" width="17" height="15" rx="2" />
                    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
                </svg>
            );
        case "plot":
            return (
                <svg {...common}>
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
                    <path d="M4 5.5v15" />
                </svg>
            );
        case "memo":
            return (
                <svg {...common}>
                    <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
                    <path d="M8 8h8M8 12h8M8 16h5" />
                </svg>
            );
        case "organization":
            return (
                <svg {...common}>
                    <rect x="4" y="8" width="7" height="12" rx="1" />
                    <rect x="13" y="4" width="7" height="16" rx="1" />
                    <path d="M6.5 11.5h2M6.5 15h2M15.5 7.5h2M15.5 11h2M15.5 14.5h2" />
                </svg>
            );
        case "term":
            return (
                <svg {...common}>
                    <path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3Z" />
                    <path d="M17 7.5h2v12.5H8" />
                </svg>
            );
        case "item":
            return (
                <svg {...common}>
                    <path d="M12 3.5 20 8v8l-8 4.5L4 16V8Z" />
                    <path d="M4 8l8 4.5L20 8M12 12.5V20.5" />
                </svg>
            );
        case "case":
            return (
                <svg {...common}>
                    <circle cx="10.5" cy="10.5" r="6" />
                    <path d="m15 15 5 5" />
                </svg>
            );
        case "map":
            return (
                <svg {...common}>
                    <path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2Z" />
                    <path d="M9 4.5v13M15 6.5v13" />
                </svg>
            );
        default:
            return (
                <svg {...common}>
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <path d="M8 9h8M8 13h5" />
                </svg>
            );
    }
}
