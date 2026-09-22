import type React from 'react';

/**
 * ============================================================
 * 原石航路
 * ログインの案内に添える小さな絵
 *
 * ★ 淡い色だけで描く。光や星は付けない。
 *   案内の主役は言葉と押し具。絵は、何の案内かが一目で分かる程度に。
 * ============================================================
 */

/** 本棚に残す（しおりを挟んだ本の山、湯のみ、小さな鉢） */
export function SaveArt() {
    return (
        <svg width="180" height="112" viewBox="0 0 180 112" aria-hidden="true">
            <ellipse cx="90" cy="102" rx="74" ry="8" fill="#e6edf1" />
            {/* 本の山 */}
            <rect x="36" y="74" width="98" height="18" rx="3" fill="#8fb0c4" />
            <rect x="36" y="74" width="98" height="5" rx="2" fill="#c9dbe5" />
            <rect x="130" y="76" width="4" height="14" fill="#6f93ab" />
            <rect x="42" y="56" width="90" height="18" rx="3" fill="#2f5f7c" />
            <rect x="42" y="56" width="90" height="5" rx="2" fill="#5f86a0" />
            <rect x="46" y="62" width="30" height="2" rx="1" fill="#d6c29a" />
            <rect x="34" y="38" width="94" height="18" rx="3" fill="#cdb895" />
            <rect x="34" y="38" width="94" height="5" rx="2" fill="#e7dac0" />
            <rect x="124" y="40" width="4" height="14" fill="#b39c76" />
            {/* しおり */}
            <path className="lia-ribbon" d="M98 30 h12 v40 l-6 -6 l-6 6 z" fill="#1f4e6b" />
            {/* 湯のみ */}
            <path d="M140 80 h20 v8 a10 8 0 0 1 -20 0 z" fill="#f1ede4" stroke="#d9d2c3" strokeWidth="1.2" />
            <path d="M160 82 a4 4 0 0 1 0 8" fill="none" stroke="#d9d2c3" strokeWidth="1.6" />
            <path d="M146 74 c-2 -3 2 -5 0 -8 M153 74 c-2 -3 2 -5 0 -8" stroke="#c9d6de" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            {/* 鉢と葉 */}
            <path d="M14 84 h16 l-2 12 h-12 z" fill="#e3d9c8" />
            <path d="M22 84 c-8 -6 -10 -16 -6 -24 c4 6 6 14 6 24 z" fill="#9db894" />
            <path d="M22 84 c6 -8 12 -12 18 -12 c-2 6 -8 10 -18 12 z" fill="#b7cdaa" />
        </svg>
    );
}

/** 応援する（ハートの手紙と、添えた葉） */
export function SupportArt() {
    return (
        <svg width="180" height="112" viewBox="0 0 180 112" aria-hidden="true">
            <ellipse cx="90" cy="102" rx="66" ry="7" fill="#f1eef0" />
            {/* 葉 */}
            <path d="M36 70 c-10 -10 -8 -24 2 -30 c4 10 4 20 -2 30 z" fill="#c3d6ba" />
            <path d="M144 76 c10 -8 10 -20 2 -26 c-4 8 -6 18 -2 26 z" fill="#d4e2cc" />
            <g transform="rotate(-9 90 60)">
                <rect x="46" y="32" width="88" height="58" rx="6" fill="#ffffff" stroke="#c9d6de" strokeWidth="2" />
                <path d="M48 36 L90 66 L132 36" fill="none" stroke="#c9d6de" strokeWidth="2" strokeLinejoin="round" />
                <path d="M48 88 L78 62 M132 88 L102 62" fill="none" stroke="#e1e8ec" strokeWidth="2" />
                <path
                    className="lia-heart"
                    d="M90 72 c-7 -6 -14 -10 -14 -17 c0 -5 3.5 -8 8 -8 c2.5 0 4.6 1.2 6 3.4 c1.4 -2.2 3.5 -3.4 6 -3.4 c4.5 0 8 3 8 8 c0 7 -7 11 -14 17 z"
                    fill="#e07f8e"
                />
            </g>
        </svg>
    );
}

/** そのほか（開いた本と、しおり紐） */
export function BookArt() {
    return (
        <svg width="180" height="112" viewBox="0 0 180 112" aria-hidden="true">
            <ellipse cx="90" cy="100" rx="66" ry="7" fill="#e9eef1" />
            <path d="M90 36 C74 26 52 26 34 31 V86 C52 81 74 81 90 91 Z" fill="#ffffff" stroke="#c3d2dc" strokeWidth="2" />
            <path d="M90 36 C106 26 128 26 146 31 V86 C128 81 106 81 90 91 Z" fill="#f5f8fa" stroke="#c3d2dc" strokeWidth="2" />
            <path d="M44 44 h32 M44 53 h32 M44 62 h24 M104 44 h32 M104 53 h32 M104 62 h24" stroke="#d6e1e8" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M118 30 v34 l-4 -4 l-4 4 v-34" fill="#1f4e6b" />
        </svg>
    );
}

/** 小さな印（一覧の行頭） */
export function BellIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f4e6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
    );
}

export function BookIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f4e6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
            <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}

export function StarIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1f4e6b" aria-hidden="true">
            <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" />
        </svg>
    );
}

export function ChatIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f4e6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 9h8M8 13h5" />
        </svg>
    );
}

export function HeartIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#d9828f" aria-hidden="true">
            <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.5 1.1 4.4 2.6C11.9 6.1 13.4 5 15.4 5 18.8 5 21 8.3 19.5 11.8 17.5 16.4 12 21 12 21z" />
        </svg>
    );
}

export function FollowIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f4e6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="4" />
            <path d="M2 21c0-4 3-6 7-6s7 2 7 6" />
            <path d="M19 8v6M16 11h6" />
        </svg>
    );
}

/**
 * 絵の後ろの、淡い丸。
 * ★ 細い線の絵だけだと、白い窓の中で頼りなく見えた。後ろに淡い色を敷いて、絵に居場所をつくる。
 */
export function ArtBackdrop({ children, tint = '#eaf1f5' }: { children: React.ReactNode; tint?: string }) {
    return (
        <div
            style={{
                position: 'relative',
                width: 176,
                height: 112,
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: '6px 18px 0',
                    borderRadius: '50% 50% 46% 54% / 60% 58% 42% 40%',
                    background: tint,
                }}
            />
            <div style={{ position: 'relative' }}>{children}</div>
        </div>
    );
}

/** 夜の海と月（話の終わりの帯）。静かな絵。動かさない */
export function NightSea() {
    return (
        <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
            <circle cx="330" cy="30" r="11" fill="#f3ead2" opacity="0.9" />
            <circle cx="330" cy="30" r="22" fill="#f3ead2" opacity="0.08" />
            <path d="M0 92 C40 86 70 88 110 84 C150 80 170 86 210 83 C250 80 290 86 330 82 C360 79 380 83 400 81 V120 H0 Z" fill="#163a51" opacity="0.8" />
            <path d="M0 102 C50 98 90 101 140 97 C190 93 230 99 280 96 C330 93 370 97 400 95 V120 H0 Z" fill="#12314a" />
            <path d="M300 96 h40" stroke="#f3ead2" strokeWidth="1.5" opacity="0.35" strokeLinecap="round" />
            <path d="M310 103 h22" stroke="#f3ead2" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
            {/* 遠くの岬と灯台 */}
            <path d="M0 84 C20 78 40 76 62 80 L70 84 Z" fill="#1b4560" />
            <rect x="40" y="66" width="4" height="12" fill="#2a5873" />
            <circle cx="42" cy="65" r="2" fill="#f3ead2" opacity="0.8" />
        </svg>
    );
}

/**
 * 夕暮れの港町（話の終わりの帯）。
 * ★ 星は五つだけ、ゆっくり瞬く。ほかは動かない。
 */
export function DuskTown() {
    return (
        <svg
            viewBox="0 0 400 150"
            preserveAspectRatio="xMidYMin slice"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
            <defs>
                <linearGradient id="dusk-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1b3550" />
                    <stop offset="0.55" stopColor="#2c5673" />
                    <stop offset="0.85" stopColor="#8a7f86" />
                    <stop offset="1" stopColor="#d6a883" />
                </linearGradient>
            </defs>
            <rect width="400" height="150" fill="url(#dusk-sky)" />
            {[
                [40, 22, 0],
                [96, 40, 1.2],
                [312, 46, 0.6],
                [352, 44, 2],
                [120, 12, 2.8],
            ].map(([x, y, delay]) => (
                <circle key={`${x}`} className="lia-star" cx={x} cy={y} r="1.3" fill="#fff" style={{ animationDelay: `${delay}s` }} />
            ))}
            <circle cx="272" cy="14" r="7" fill="#f5ecd6" opacity="0.9" />
            <circle className="lia-moon" cx="272" cy="14" r="13" fill="#f5ecd6" opacity="0.08" />
            {/* 町並み（文字に掛からないよう、低めに） */}
            <g transform="translate(0 26)">
            <path
                d="M0 150 V112 h18 v-10 h10 v10 h14 v-22 h12 v22 h8 v-14 h16 v14 h10 v-30 l6 -8 l6 8 v30 h12 v-18 h14 v18 h10 v-12 h18 v12 h8 v-26 h12 v26 h14 v-16 h10 v16 h16 v-34 h4 v-8 h4 v8 h4 v34 h12 v-20 h16 v20 h10 v-14 h14 v14 h8 v-24 h12 v24 h16 v-12 h14 v12 h10 v-18 h16 v18 h12 V150 Z"
                fill="#15293d"
            />
            {/* 窓の灯り */}
            {[
                [22, 118], [46, 104], [74, 120], [104, 96], [160, 114], [198, 108], [246, 104], [252, 122], [300, 114], [346, 110], [372, 126],
            ].map(([x, y]) => (
                <rect key={`${x}-${y}`} className="lia-window" x={x} y={y} width="3" height="3" fill="#f3d9a0" style={{ animationDelay: `${0.5 + ((x * 7) % 11) * 0.12}s` }} />
            ))}
            </g>
        </svg>
    );
}

/** 次の話の小さな絵（題名の横） */
export function NextThumb() {
    return (
        <svg width="92" height="64" viewBox="0 0 72 52" aria-hidden="true" preserveAspectRatio="xMidYMid slice" style={{ borderRadius: 10, flex: 'none', display: 'block' }}>
            <defs>
                <linearGradient id="thumb-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3d6a86" />
                    <stop offset="1" stopColor="#c9a88c" />
                </linearGradient>
            </defs>
            <rect width="72" height="52" fill="url(#thumb-sky)" />
            <path d="M0 52 V38 h8 v-6 h6 v6 h8 v-12 h6 v12 h6 v-8 h8 v8 h6 v-16 l3 -4 l3 4 v16 h8 v-10 h10 V52 Z" fill="#1c3348" />
            <path d="M0 46 h72 v6 H0 Z" fill="#23425a" opacity="0.8" />
        </svg>
    );
}

/** 本棚の小さな絵（右下の誘い） */
export function ShelfArt() {
    return (
        <svg width="64" height="64" viewBox="0 0 46 46" aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
            <circle cx="23" cy="23" r="23" fill="#e8f0f4" />
            <rect className="lia-book" x="10" y="12" width="6" height="22" rx="1.5" fill="#8fb0c4" />
            <rect className="lia-book" x="17" y="9" width="6" height="25" rx="1.5" fill="#2f5f7c" style={{ animationDelay: '.08s' }} />
            <rect className="lia-book" x="24" y="14" width="5" height="20" rx="1.5" fill="#cdb895" style={{ animationDelay: '.16s' }} />
            <rect x="30" y="13" width="5" height="21" rx="1.5" fill="#d98c7a" transform="rotate(12 32 34)" />
            <path d="M19 9 v8 l-1.5 -1.5 l-1.5 1.5 v-8" fill="#e0b85c" transform="translate(2 0)" />
            <rect x="8" y="34" width="30" height="2.5" rx="1" fill="#6f8797" />
        </svg>
    );
}
