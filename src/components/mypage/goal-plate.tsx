/**
 * いちばん奥の札。
 *
 * ★ 絵ではなく、描いて作る。
 *   絵に値段を焼き込むと、値段を変えるたび描き直しになる。
 *
 * ★ 見本の札に寄せる。
 *   角は切り込み、上に王冠、外に四条の光。
 */
export function GoalPlate({
    price,
    caption,
    width = 300,
}: {
    price: number
    caption: string
    width?: number
}) {
    const h = Math.round((width * 184) / 400)

    return (
        <svg viewBox="0 0 400 184" width={width} height={h} aria-hidden="true">
            <defs>
                <radialGradient id="gp-plate" cx=".5" cy=".34" r=".78">
                    <stop offset="0%" stopColor="#265a86" />
                    <stop offset="45%" stopColor="#16375c" />
                    <stop offset="100%" stopColor="#0a1c31" />
                </radialGradient>
                <linearGradient id="gp-gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbeec2" />
                    <stop offset="38%" stopColor="#e3c47e" />
                    <stop offset="62%" stopColor="#c69c4a" />
                    <stop offset="100%" stopColor="#8e6a2c" />
                </linearGradient>
                <linearGradient id="gp-text" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fffaea" />
                    <stop offset="100%" stopColor="#e9d49b" />
                </linearGradient>
                <radialGradient id="gp-glow">
                    <stop offset="0%" stopColor="#ffe6a8" stopOpacity=".5" />
                    <stop offset="55%" stopColor="#a9ded0" stopOpacity=".2" />
                    <stop offset="100%" stopColor="#a9ded0" stopOpacity="0" />
                </radialGradient>
                <filter id="gp-shine" x="-40%" y="-60%" width="180%" height="220%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <radialGradient id="gp-inner" cx=".5" cy=".28" r=".8">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity=".16" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
            </defs>

            <ellipse cx="200" cy="92" rx="200" ry="90" fill="url(#gp-glow)" />

            <path d={PLATE} fill="url(#gp-plate)" />
            <path d={PLATE} fill="url(#gp-inner)" />

            {/* 奥の輪。地が平らに見えないように */}
            <g opacity=".1" stroke="#cfe6f5" fill="none">
                <circle cx="200" cy="94" r="44" strokeWidth=".8" />
                <circle cx="200" cy="94" r="60" strokeWidth=".6" />
            </g>

            <path
                d={PLATE}
                fill="none"
                stroke="url(#gp-gold)"
                strokeWidth="3"
            />
            <path
                d={PLATE_IN}
                fill="none"
                stroke="#e3c47e"
                strokeWidth="1"
                opacity=".6"
            />

            {/* 縁の真ん中の飾り */}
            <path d="M36 92 L46 82 L56 92 L46 102 Z" fill="url(#gp-gold)" />
            <path d="M364 92 L354 82 L344 92 L354 102 Z" fill="url(#gp-gold)" />
            <path d="M200 150 L209 158 L200 166 L191 158 Z" fill="url(#gp-gold)" />

            {/* 角の唐草。小さく描くと汚れに見えるので、細い線で */}
            <g fill="none" stroke="#d9be84" strokeWidth="1.1" opacity=".55">
                <path d="M88 44 q14 0 20 10" />
                <path d="M88 44 q0 12 -8 16" />
                <path d="M312 140 q-14 0 -20 -10" />
                <path d="M312 140 q0 -12 8 -16" />
            </g>

            {/* 王冠 */}
            <g transform="translate(200 13) scale(1.12)">
                <path
                    d="M-26 16 L-26 -1 L-14 7 L0 -11 L14 7 L26 -1 L26 16 Z"
                    fill="url(#gp-gold)"
                    stroke="#8e6a2c"
                    strokeWidth="1"
                    strokeLinejoin="round"
                />
                <path d="M-26 16 H26" stroke="#8e6a2c" strokeWidth="1.6" />
                <path d="M0 -17 l3.4 4 -3.4 4 -3.4 -4 Z" fill="#a8dcf0" />
                <circle cx="-26" cy="-2" r="2.4" fill="#fbeec2" />
                <circle cx="26" cy="-2" r="2.4" fill="#fbeec2" />
            </g>

            {/* 鍵 */}
            <g transform="translate(200 46)">
                <rect
                    x="-8"
                    y="-1"
                    width="16"
                    height="12"
                    rx="2.5"
                    fill="#f4ead2"
                />
                <path
                    d="M-4.5 -1 v-4 a4.5 4.5 0 0 1 9 0 v4"
                    fill="none"
                    stroke="#f4ead2"
                    strokeWidth="2.2"
                />
                <circle cx="0" cy="5" r="1.6" fill="#15355a" />
            </g>

            <text
                x="200"
                y="78"
                textAnchor="middle"
                fill="#ded2b2"
                fontSize="14"
                letterSpacing="6"
            >
                ???
            </text>

            <text
                x="200"
                y="116"
                textAnchor="middle"
                fill="url(#gp-text)"
                fontSize="32"
                fontWeight="700"
                fontFamily="Georgia, 'Times New Roman', serif"
                filter="url(#gp-shine)"
            >
                {price.toLocaleString()} pt
            </text>

            <g opacity=".8">
                <path d="M118 130 H188" stroke="#c69c4a" strokeWidth=".8" />
                <path d="M212 130 H282" stroke="#c69c4a" strokeWidth=".8" />
                <path d="M200 125 l4.5 5 -4.5 5 -4.5 -5 Z" fill="#e3c47e" />
            </g>

            <text
                x="200"
                y="146"
                textAnchor="middle"
                fill="#cfc4a6"
                fontSize="10.5"
                letterSpacing="1.5"
            >
                {caption}
            </text>

            {/* 四条の光 */}
            <Spark x={20} y={92} r={19} />
            <Spark x={380} y={92} r={19} />
            <Spark x={56} y={36} r={8} />
            <Spark x={346} y={150} r={8} />
            <Spark x={352} y={30} r={5.5} />
            <Spark x={44} y={152} r={5.5} />
        </svg>
    )
}

/* 角を切り込んだ札の形 */
const PLATE = [
    'M76 26 H324',
    'Q336 26 336 38',
    'Q336 50 350 56',
    'Q364 62 364 80',
    'V104',
    'Q364 122 350 128',
    'Q336 134 336 146',
    'Q336 158 324 158',
    'H76',
    'Q64 158 64 146',
    'Q64 134 50 128',
    'Q36 122 36 104',
    'V80',
    'Q36 62 50 56',
    'Q64 50 64 38',
    'Q64 26 76 26 Z',
].join(' ')

const PLATE_IN = [
    'M82 34 H318',
    'Q328 34 328 44',
    'Q328 56 342 62',
    'Q354 68 354 82',
    'V102',
    'Q354 116 342 122',
    'Q328 128 328 140',
    'Q328 150 318 150',
    'H82',
    'Q72 150 72 140',
    'Q72 128 58 122',
    'Q46 116 46 102',
    'V82',
    'Q46 68 58 62',
    'Q72 56 72 44',
    'Q72 34 82 34 Z',
].join(' ')

/** 四条の光。腕を細く長く */
function Spark({ x, y, r }: { x: number; y: number; r: number }) {
    const k = r * 0.11
    return (
        <path
            d={`M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r} Z`}
            fill="#fff8e4"
        />
    )
}
