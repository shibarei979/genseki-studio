import type { Config } from "tailwindcss";

/**
 * ============================================================
 * 原石航路 Studio
 * Tailwind Configuration
 *
 * 色は globals.css の CSS 変数を参照する。
 * 将来テーマ（白 / 生成り / セピア / 夜間 / 黒）を切り替えるとき、
 * CSS 変数の差し替えだけで済ませるため。
 * ============================================================
 */

const config: Config = {
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                logo: "var(--color-logo)",
                forest: "var(--color-forest)",
                "forest-dark": "var(--color-forest-dark)",
                "forest-tint": "var(--color-forest-tint)",
                "forest-line": "var(--color-forest-line)",
                canvas: "var(--color-canvas)",
                surface: "var(--color-surface)",
                line: "var(--color-line)",
                ink: "var(--color-ink)",
                muted: "var(--color-muted)",
                faint: "var(--color-faint)",
                amber: "var(--color-amber)",
                "amber-tint": "var(--color-amber-tint)",
            },
            fontFamily: {
                sans: ["var(--font-sans)", "sans-serif"],
                serif: ["var(--font-serif)", "serif"],
            },

        },
    },
    plugins: [],
};

export default config;
