/**
 * ============================================================
 * 原石航路 Studio
 * 画像の保存
 *
 * localStorage には入れない。上限が 5MB ほどしかないので、
 * 画像を数枚入れただけで原稿ごと書き込めなくなる。
 * 実際にそれで壊れた。
 *
 * IndexedDB は数百MB まで入るので、画像だけこちらへ移す。
 * 資料の項目には「idb:xxxx」という目印だけを持たせ、
 * 表示するときに引き出す。
 * ============================================================
 */

const DB_NAME = "genseki-images";
const DB_VERSION = 1;
const STORE = "images";

/** 目印の頭。これが付いていたら IndexedDB を見る */
export const IDB_PREFIX = "idb:";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("indexedDB がありません"));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

function run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    return openDb().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const tx = db.transaction(STORE, mode);
                const request = action(tx.objectStore(STORE));
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }),
    );
}

/**
 * 画像を入れて、目印を返す。
 * 返ってきた文字列を entry.image_url に持たせる。
 */
export async function putImage(dataUrl: string): Promise<string> {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await run("readwrite", (store) => store.put(dataUrl, id));
    return `${IDB_PREFIX}${id}`;
}

/** 目印から画像を引き出す。無ければ null */
export async function getImage(ref: string): Promise<string | null> {
    if (!ref.startsWith(IDB_PREFIX)) return ref;
    try {
        const value = await run<string | undefined>("readonly", (store) =>
            store.get(ref.slice(IDB_PREFIX.length)),
        );
        return value ?? null;
    } catch {
        return null;
    }
}

export async function deleteImage(ref: string): Promise<void> {
    if (!ref.startsWith(IDB_PREFIX)) return;
    try {
        await run("readwrite", (store) => store.delete(ref.slice(IDB_PREFIX.length)));
    } catch {
        // 消せなくても実害は無い
    }
}

/**
 * ============================================================
 * 取り込んだ画像を小さくする
 *
 * 書き手が貼る画像は、そのままだと数MBあることがある。
 * 資料の目印として使うだけなので、長辺 900px あれば足りる。
 * ============================================================
 */

const MAX_EDGE = 900;
const QUALITY = 0.82;

/**
 * 大きく出す画像はここまで残す。
 *
 * コンテストの帯は 600px ほどで出るので、
 * 画面の細かい端末（2倍）を見込んで 1200px あれば足りていた。
 *
 * ★ 挿絵も同じ道を通るので 1600px まで残す。
 *
 *   挿絵は作者が幅を決められる。上げた時点で縮めてしまうと、
 *   大きく見せたい絵が、そこまでしか広げられない。
 *   容量は増えるが、絵の荒れのほうが目につく。
 */
const WIDE_MAX_EDGE = 1600;
/* 描き直すときの質。線画がつぶれない所まで上げる */
const WIDE_QUALITY = 0.95;

/**
 * 絵を縮める。
 *
 * ★ 触らずに済むものは、触らない。
 *
 *   これまでは、どの絵も一度 webp に描き直していた。
 *   線画や字の入った絵は、それだけで輪郭が甘くなる。
 *   小さくて軽い絵は、元のまま上げるほうがきれいで速い。
 *
 * @param keepOriginal 元のまま置けるなら、そうする（挿絵で使う）
 */
/**
 * 描き直すときの形を選ぶ。
 *
 * ★ 絵によって、落ちにくい形が違う。
 *
 *   線画・字・べた塗り … 色数が少ない。png なら 1 ドットも変わらない
 *   写真・厚塗り       … 色数が多い。png だと桁違いに重くなるので webp
 *
 *   色の数を数えて分ける。透けている所があれば png（webp でも残るが、
 *   透過のある絵は線画であることが多い）。
 */
export function pickFormat(canvas: HTMLCanvasElement): {
    mime: string;
    quality: number;
} {
    try {
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return { mime: "image/webp", quality: 0.95 };

        /* 全部見ると重いので、間引いて数える */
        const { width, height } = canvas;
        const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
        const data = context.getImageData(0, 0, width, height).data;

        const colors = new Set<number>();
        let hasAlpha = false;

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const at = (y * width + x) * 4;
                if (data[at + 3] < 250) hasAlpha = true;
                colors.add(
                    (data[at] << 16) | (data[at + 1] << 8) | data[at + 2],
                );
                if (colors.size > 6000) break;
            }
            if (colors.size > 6000) break;
        }

        /* 色数が少ないもの、透けているものは、まったく落とさない形で */
        if (hasAlpha || colors.size <= 6000) {
            return { mime: "image/png", quality: 1 };
        }
    } catch {
        /* 数えられなければ、これまでどおり */
    }

    return { mime: "image/webp", quality: 0.95 };
}

export async function shrinkImage(
    file: File,
    /** 大きく出すものは true。縮める加減を緩める */
    isWide = false,
    keepOriginal = false,
): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    // SVG は縮めても意味が無いのでそのまま
    if (file.type === "image/svg+xml") return dataUrl;

    /*
     * ★ 元のまま置ける絵は、描き直さない。
     *
     *   4MB 未満で、長辺が上限を超えていないもの。
     *   dataUrl は元の中身をそのまま写したものなので、
     *   これを返せば画質はまったく落ちない。
     */
    if (keepOriginal && file.size < 4_000_000) {
        const fits = await new Promise<boolean>((resolve) => {
            const probe = new Image();
            probe.onload = () =>
                resolve(
                    Math.max(probe.width, probe.height) <=
                        (isWide ? WIDE_MAX_EDGE : MAX_EDGE),
                );
            probe.onerror = () => resolve(false);
            probe.src = dataUrl;
        });

        if (fits) return dataUrl;
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("画像を読めませんでした"));
        element.src = dataUrl;
    });

    const maxEdge = isWide ? WIDE_MAX_EDGE : MAX_EDGE;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    if (scale === 1 && dataUrl.length < 400000) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    /*
     * ★ 形は絵に合わせて選ぶ。
     *   線画や字は png（まったく落ちない）、写真は webp。
     */
    const picked = pickFormat(canvas);
    return canvas.toDataURL(
        picked.mime,
        picked.mime === "image/png" ? 1 : isWide ? WIDE_QUALITY : QUALITY,
    );
}
