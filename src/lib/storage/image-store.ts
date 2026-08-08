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
 * 画面の細かい端末（2倍）を見込んで 1200px あれば足りる。
 * これ以上残しても、見た目は変わらず容量だけ増える。
 */
const WIDE_MAX_EDGE = 1200;
const WIDE_QUALITY = 0.86;

export async function shrinkImage(
    file: File,
    /** 大きく出すものは true。縮める加減を緩める */
    isWide = false,
): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    // SVG は縮めても意味が無いのでそのまま
    if (file.type === "image/svg+xml") return dataUrl;

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

    return canvas.toDataURL("image/webp", isWide ? WIDE_QUALITY : QUALITY);
}
