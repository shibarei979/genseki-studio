'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * ============================================================
 * 原石航路
 * IconCropper — アイコンを切り抜く
 *
 * 選んだ絵をそのまま使うと、
 * 顔が端に寄ったり、余白ばかりになったりする。
 *
 * 丸の中でどこを見せるかを、自分で決められるようにする。
 *
 * 出来上がりは 400×400 の正方形。
 * 元が大きくても、ここで小さくしてから送る。
 * ============================================================
 */

/** 出来上がりの一辺 */
const OUTPUT_SIZE = 400

/** 画面に出す枠の一辺 */
const VIEW_SIZE = 260

export default function IconCropper({
    file,
    onDone,
    onCancel,
    shape = 'circle',
    title = 'アイコンを切り抜く',
    aspect = 1,
}: {
    file: File
    onDone: (blob: Blob) => void
    onCancel: () => void
    /**
     * 枠の形。
     *
     *   circle  丸。アイコン用
     *   rect    角。表紙用
     */
    shape?: 'circle' | 'rect'
    title?: string
    /** 縦横の比。表紙は縦長にする */
    aspect?: number
}) {
    /* 枠の高さ。比が 1 なら正方形、小さいほど縦長 */
    const viewH = Math.round(VIEW_SIZE / aspect)
    const outH = Math.round(OUTPUT_SIZE / aspect)

    const [image, setImage] = useState<HTMLImageElement | null>(null)
    const [scale, setScale] = useState(1)
    const [pos, setPos] = useState({ x: 0, y: 0 })
    const [isBusy, setIsBusy] = useState(false)

    const dragging = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
            setImage(img)

            /*
             * 最初の大きさ。
             *
             * 短いほうの辺が枠いっぱいになるようにする。
             * こうすると、どの絵でも隙間なく始まる。
             */
            const fit = Math.max(VIEW_SIZE / img.width, viewH / img.height)
            setScale(fit)
            setPos({ x: 0, y: 0 })
        }

        img.src = url
        return () => URL.revokeObjectURL(url)
    }, [file])

    /* 動かせる範囲に収める。枠の外に隙間ができないように */
    function clamp(next: { x: number; y: number }, s: number) {
        if (!image) return next

        const w = image.width * s
        const h = image.height * s
        const maxX = Math.max(0, (w - VIEW_SIZE) / 2)
        const maxY = Math.max(0, (h - viewH) / 2)

        return {
            x: Math.min(maxX, Math.max(-maxX, next.x)),
            y: Math.min(maxY, Math.max(-maxY, next.y)),
        }
    }

    function handleDown(e: React.MouseEvent | React.TouchEvent) {
        const point = 'touches' in e ? e.touches[0] : e
        dragging.current = { x: point.clientX - pos.x, y: point.clientY - pos.y }
    }

    function handleMove(e: React.MouseEvent | React.TouchEvent) {
        if (!dragging.current) return
        const point = 'touches' in e ? e.touches[0] : e

        setPos(
            clamp(
                {
                    x: point.clientX - dragging.current.x,
                    y: point.clientY - dragging.current.y,
                },
                scale,
            ),
        )
    }

    function handleUp() {
        dragging.current = null
    }

    function changeScale(next: number) {
        setScale(next)
        setPos((prev) => clamp(prev, next))
    }

    async function crop() {
        if (!image || isBusy) return
        setIsBusy(true)

        const canvas = document.createElement('canvas')
        canvas.width = OUTPUT_SIZE
        canvas.height = outH

        const ctx = canvas.getContext('2d')
        if (!ctx) {
            setIsBusy(false)
            return
        }

        /* 画面で見えている通りに写す */
        const ratio = OUTPUT_SIZE / VIEW_SIZE
        const w = image.width * scale * ratio
        const h = image.height * scale * ratio
        const x = (OUTPUT_SIZE - w) / 2 + pos.x * ratio
        const y = (outH - h) / 2 + pos.y * ratio

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, OUTPUT_SIZE, outH)
        ctx.drawImage(image, x, y, w, h)

        canvas.toBlob(
            (blob) => {
                setIsBusy(false)
                if (blob) onDone(blob)
            },
            'image/jpeg',
            0.9,
        )
    }

    return (
        <div
            onClick={onCancel}
            style={{
                position: 'fixed', inset: 0, zIndex: 300,
                background: 'rgba(20,30,40,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--color-bg-card)',
                    borderRadius: 14,
                    padding: '22px 24px',
                    width: 'min(340px, 100%)',
                }}
            >
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    {title}
                </p>
                <p style={{ fontSize: 11.5, lineHeight: 1.8, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    絵を動かして、見せたい場所を決めてください。
                </p>

                {/*
                 * 切り抜く枠。
                 *
                 * 丸く見せるが、実際に切るのは正方形。
                 * 出す場所によって丸だったり角だったりするため。
                 */}
                <div
                    onMouseDown={handleDown}
                    onMouseMove={handleMove}
                    onMouseUp={handleUp}
                    onMouseLeave={handleUp}
                    onTouchStart={handleDown}
                    onTouchMove={handleMove}
                    onTouchEnd={handleUp}
                    style={{
                        position: 'relative',
                        width: VIEW_SIZE, height: viewH,
                        margin: '16px auto 0',
                        borderRadius: shape === 'circle' ? '50%' : 10,
                        overflow: 'hidden',

                        /*
                         * 枠の輪郭。
                         *
                         * 背景と同じ色だと、
                         * どこまでが切り抜かれるのか分からない。
                         * 線と影で、丸をはっきりさせる。
                         */
                        background: '#e8e8e8',
                        border: '2px solid var(--color-brand)',
                        boxShadow: '0 0 0 4px rgba(0,0,0,0.06)',

                        cursor: 'move',
                        touchAction: 'none',
                    }}
                >
                    {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={image.src}
                            alt=""
                            draggable={false}
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                width: image.width * scale,
                                height: image.height * scale,
                                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                                maxWidth: 'none',
                                userSelect: 'none',
                            }}
                        />
                    )}
                </div>

                <p style={{
                    fontSize: 10.5,
                    textAlign: 'center',
                    color: 'var(--color-text-faint)',
                    marginTop: 8,
                }}>
                    {shape === 'circle' ? 'この丸の中が、アイコンになります' : 'この枠の中が、表紙になります'}
                </p>

                {/* 大きさ */}
                <div style={{ marginTop: 16 }}>
                    <label style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                        大きさ
                    </label>
                    <input
                        type="range"
                        min={0.2}
                        max={3}
                        step={0.01}
                        value={scale}
                        onChange={(e) => changeScale(Number(e.target.value))}
                        style={{ width: '100%', marginTop: 4 }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            flex: 1, padding: '10px 0', borderRadius: 8,
                            border: '1px solid var(--color-brand-border)',
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-text-muted)',
                            fontSize: 13, cursor: 'pointer',
                        }}
                    >
                        やめる
                    </button>
                    <button
                        type="button"
                        onClick={() => void crop()}
                        disabled={!image || isBusy}
                        style={{
                            flex: 1, padding: '10px 0', borderRadius: 8,
                            border: 'none',
                            background: 'var(--color-brand)',
                            color: 'var(--base-color-1, #fff)',
                            fontSize: 13, fontWeight: 600,
                            cursor: isBusy ? 'default' : 'pointer',
                            opacity: isBusy ? 0.6 : 1,
                        }}
                    >
                        {isBusy ? '切り抜いています…' : 'これにする'}
                    </button>
                </div>
            </div>
        </div>
    )
}
