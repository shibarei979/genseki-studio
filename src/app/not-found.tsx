import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-canvas">
            <div className="text-center">
                <p className="text-sm text-ink">このページはありません。</p>
                <Link
                    href="/"
                    className="mt-6 inline-block rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark"
                >
                    作品一覧へ戻る
                </Link>
            </div>
        </div>
    );
}
