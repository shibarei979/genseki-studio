/**
 * いちばん奥の札。
 *
 * ★ 枠は絵、数字だけこちらで出す。
 *
 *   枠・王冠・鍵・唐草・四条の光は、描いてもらった絵をそのまま使う。
 *   絵に焼き込まれていた「? ? ?」「2,000 pt」「まだ見ぬアイテムがここに」
 *   だけを消してあるので、そこへ字を重ねる。
 *
 *   値段を変えても、絵を描き直さなくてよい。
 *
 * ★ 置き場所は、絵の中の割合で決める。
 *   絵をどの大きさで出しても、字はそこからずれない。
 */

/** 絵の中で、字を置く高さ（絵の高さに対する割合） */
const AT = {
    unknown: 45.6,
    price: 58.43,
    rule: 69.88,
    caption: 80.42,
}

/** 値段の両脇の光 */
function Spark({ size }: { size: number }) {
    return (
        <span
            style={{
                flex: '0 0 auto',
                width: size,
                height: size,
                background: '#fff6dd',
                clipPath:
                    'polygon(50% 0%, 59% 41%, 100% 50%, 59% 59%, 50% 100%, 41% 59%, 0% 50%, 41% 41%)',
            }}
        />
    )
}

export function GoalPlate({
    price,
    caption,
    width = 340,
}: {
    price: number
    caption: string
    width?: number
}) {
    /* 字の大きさも、絵の幅から出す */
    const size = (percent: number) => Math.round(width * percent) / 100

    return (
        <div
            style={{
                position: 'relative',
                width,
                lineHeight: 1,
                userSelect: 'none',
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/items/goal-plate.webp"
                alt=""
                style={{ width: '100%', height: 'auto', display: 'block' }}
            />

            <span
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: `${AT.unknown}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: size(5.4),
                    letterSpacing: '.3em',
                    textIndent: '.3em',
                    color: '#ded2b4',
                    textShadow: '0 0 6px rgba(255,238,196,.45)',
                    whiteSpace: 'nowrap',
                }}
            >
                ???
            </span>

            {/*
              * ★ 値段と両脇の光は、ひとつの行にまとめる。
              *
              *   光を絵の位置に固定すると、
              *   値段が長くなったとき字が光に重なる。
              *   並べておけば、何桁でも離れる。
              */}
            <span
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: `${AT.price}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: size(3.2),
                    whiteSpace: 'nowrap',
                }}
            >
                <Spark size={size(2.4)} />

                <span
                    style={{
                        fontSize: size(7.4),
                        fontWeight: 700,
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        color: '#fdf6e2',
                        textShadow:
                            '0 0 10px rgba(255,232,178,.6), 0 0 22px rgba(255,214,130,.35)',
                    }}
                >
                    {price.toLocaleString()} pt
                </span>

                <Spark size={size(2.4)} />
            </span>

            {/*
              * ★ 値段と下の一行を分ける細い線。
              *   絵にあったものを、そのまま引き直す。
              */}
            <span
                style={{
                    position: 'absolute',
                    left: '26%',
                    right: '26%',
                    top: `${AT.rule}%`,
                    height: 1,
                    transform: 'translateY(-50%)',
                    background:
                        'linear-gradient(90deg, rgba(214,178,106,0) 0%, rgba(214,178,106,.85) 22%, rgba(214,178,106,.85) 42%, rgba(214,178,106,0) 47%, rgba(214,178,106,0) 53%, rgba(214,178,106,.85) 58%, rgba(214,178,106,.85) 78%, rgba(214,178,106,0) 100%)',
                }}
            />

            <span
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: `${AT.rule}%`,
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    width: size(1.5),
                    height: size(1.5),
                    background: '#e3c47e',
                }}
            />

            <span
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: `${AT.caption}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: size(2.9),
                    letterSpacing: '.08em',
                    color: '#e4d8bd',
                    whiteSpace: 'nowrap',
                }}
            >
                {caption}
            </span>
        </div>
    )
}
