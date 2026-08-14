/*
 * 守りのヘッダー。
 *
 * CSP は「どこの物なら読み込んでよいか」の許し状。
 * この項目に無い所からは、絵も台本も読み込まれない。
 * 使っている先（Supabase・GTM）は許してある。
 * 新しい外部の物を足して出なくなったら、まずここを疑うこと。
 */
const contentSecurityPolicy = [
    "default-src 'self'",
    // Next と GTM。inline は Next の仕組み上はずせない
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    // 絵は自前・Supabase の置き場・貼り付け(data/blob)から
    "img-src 'self' data: blob: https://*.supabase.co https://www.googletagmanager.com",
    // 声(blob)と取り込んだ音
    "media-src 'self' blob:",
    // PDF を読む働き手
    "worker-src 'self' blob:",
    "font-src 'self' data:",
    // 通信の相手。wss は執筆室のつなぎ（消すとマイクと在室が死ぬ）
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.googletagmanager.com https://*.google-analytics.com",
    "frame-src https://www.googletagmanager.com",
    // このサイトを他所の枠に入れさせない
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    // 中身の型を偽って読ませない
    { key: "X-Content-Type-Options", value: "nosniff" },
    // 他所へ飛ぶとき、渡すのは行き先の分だけ
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // 使う道具の申告。マイクは自分の頁でだけ使う
    {
        key: "Permissions-Policy",
        value: "camera=(), geolocation=(), microphone=(self)",
    },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,

    async headers() {
        return [{ source: "/(.*)", headers: securityHeaders }];
    },
    compiler: {
        removeConsole:
            process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
    },

    webpack(config, { isServer }) {
        /*
         * PDF を読む部品は、立てるときに持ち込まない。
         *
         * 読み込むのはブラウザの中だけ。
         * サーバー側で解こうとすると、canvas が無いと言われる。
         */
        if (isServer) {
            config.resolve = config.resolve ?? {};
            config.resolve.alias = {
                ...(config.resolve.alias ?? {}),
                canvas: false,
            };
        }

        return config;
    },
};

module.exports = nextConfig;
