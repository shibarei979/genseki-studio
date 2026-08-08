/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
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
