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
    const h = Math.round((width * 212) / 400)

    return (
        <svg viewBox="0 -28 400 212" width={width} height={h} aria-hidden="true">
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
                <linearGradient id="gp-crown" x1="0" y1="0" x2="0.1" y2="1">
                    <stop offset="0%" stopColor="#fffaea" />
                    <stop offset="30%" stopColor="#fbeec4" />
                    <stop offset="66%" stopColor="#f0d795" />
                    <stop offset="100%" stopColor="#dfb96b" />
                </linearGradient>
                <filter id="gp-soft" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="7" />
                </filter>
                <linearGradient id="gp-text" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fffaea" />
                    <stop offset="100%" stopColor="#e9d49b" />
                </linearGradient>
                <clipPath id="gp-clip">
                    <path d={PLATE} />
                </clipPath>
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

            {/* 板の落ち影 */}
            <path
                d={PLATE}
                fill="#0a1c31"
                opacity=".3"
                transform="translate(0 5)"
            />

            <path d={PLATE} fill="url(#gp-plate)" />
            <path d={PLATE} fill="url(#gp-inner)" />

            {/* 斜めの照り。平らな板に見せない */}
            <g clipPath="url(#gp-clip)">
                <path
                    d="M-40 150 L140 -30 L200 -30 L20 150 Z"
                    fill="#ffffff"
                    opacity=".05"
                />
                <path
                    d="M40 170 L230 -20 L258 -20 L68 170 Z"
                    fill="#ffffff"
                    opacity=".035"
                />
                {/* 縁の内側の暗がり */}
                <path
                    d={PLATE}
                    fill="none"
                    stroke="#04101e"
                    strokeWidth="14"
                    opacity=".45"
                />
            </g>

            {/* 奥の輪。地が平らに見えないように */}
            <g opacity=".1" stroke="#cfe6f5" fill="none">
                <circle cx="200" cy="94" r="44" strokeWidth=".8" />
                <circle cx="200" cy="94" r="60" strokeWidth=".6" />
            </g>

            <path
                d={PLATE}
                fill="none"
                stroke="#6b4e1d"
                strokeWidth="5"
                opacity=".8"
            />
            <path
                d={PLATE}
                fill="none"
                stroke="url(#gp-gold)"
                strokeWidth="3.4"
            />
            <path
                d={PLATE}
                fill="none"
                stroke="#fff4d2"
                strokeWidth="1"
                opacity=".5"
                strokeDasharray="120 400"
                strokeDashoffset="-40"
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
            <g transform="translate(200 4)">
                {/* 後ろの光 */}
                <ellipse
                    cx="0"
                    cy="-6"
                    rx="56"
                    ry="30"
                    fill="#ffdf9a"
                    opacity=".4"
                    filter="url(#gp-soft)"
                />

                {/* 影。板に載っている */}
                <ellipse cx="0" cy="18" rx="38" ry="4.5" fill="#07172a" opacity=".38" />

                {/*
                  * ★ 五つの峰。
                  *
                  *   外の二つは外向きに張り出し、
                  *   真ん中がいちばん高い。
                  *   角を丸めた太い縁取りで、描いた絵に寄せる。
                  */}
                <path
                    d={CROWN}
                    fill="url(#gp-crown)"
                    stroke="#b5842f"
                    strokeWidth="3.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {/* 底の帯。台座の厚みを出す */}
                <path
                    d="M-38 6 Q0 12 38 6 Q0 20 -38 6 Z"
                    fill="#e0b76b"
                    opacity=".5"
                />

                {/* 真ん中の氷の星 */}
                <g transform="translate(0 -4)">
                    <path
                        d="M0 -15 Q1.8 -2 13 0 Q1.8 2 0 15 Q-1.8 2 -13 0 Q-1.8 -2 0 -15 Z"
                        fill="#d2edfc"
                        stroke="#8fc3dd"
                        strokeWidth="1.1"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M0 -8 Q.9 -1.1 6.5 0 Q.9 1.1 0 8 Q-.9 1.1 -6.5 0 Q-.9 -1.1 0 -8 Z"
                        fill="#ffffff"
                        opacity=".92"
                    />
                </g>
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
                y="76"
                textAnchor="middle"
                fill="#ded2b2"
                fontSize="14"
                letterSpacing="6"
            >
                ???
            </text>

            <text
                x="200"
                y="112"
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
                <path d="M118 126 H188" stroke="#c69c4a" strokeWidth=".8" />
                <path d="M212 126 H282" stroke="#c69c4a" strokeWidth=".8" />
                <path d="M200 121 l4.5 5 -4.5 5 -4.5 -5 Z" fill="#e3c47e" />
            </g>

            <text
                x="200"
                y="142"
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

/*
 * 王冠の形。
 *
 * ★ 見本に合わせて、峰は五つ。
 *   外の二つは外へ張り出し、下すぼまり。
 *   底は、板の丸みに沿って少し下へふくらむ。
 */
const CROWN = [
    'M-38 13',
    'L-44 -16',
    'L-34 -8',
    'L-25 -23',
    'L-14 -8',
    'L0 -33',
    'L14 -8',
    'L25 -23',
    'L34 -8',
    'L44 -16',
    'L38 13',
    'Q0 20 -38 13 Z',
].join(' ')

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
