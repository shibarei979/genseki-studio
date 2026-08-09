/**
 * ============================================================
 * 原石航路 Studio
 * 画像を外へ置く
 *
 * IndexedDB は、その端末のブラウザの中にしかない。
 * コンテストの絵を貼っても、ほかの人には届かない。
 *
 * Supabase Storage に置けば、URL で誰でも見られる。
 * ============================================================
 */

import { createClient } from "@/lib/supabase/client";

/** 置き場所の名前 */
const BUCKET = "public-images";

/**
 * 画像を置いて、URL を返す。
 *
 * 名前は重ならないように作る。
 * 同じ名前だと、前の絵を上書きしてしまう。
 */
export async function uploadImage(
    /** Blob か、data:image/... の文字列 */
    source: Blob | string,
    folder: string,
): Promise<string> {
    const supabase = createClient();

    /*
     * 縮めたあとの絵は data: の文字列で返ってくる。
     * そのままでは置けないので、中身に戻す。
     */
    const file = typeof source === "string" ? toBlob(source) : source;

    const extension = file.type.includes("png") ? "png" : "jpg";
    const name = `${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(name, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
    });

    if (error) {
        throw new Error(
            error.message.includes("Bucket not found")
                ? `置き場所がありません。Supabase の Storage で "${BUCKET}" を作ってください。`
                : `画像を置けませんでした（${error.message}）`,
        );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl;
}

/**
 * 置いた画像を消す。
 *
 * URL から名前を取り出す。
 * 外の URL だったら何もしない。
 */
export async function removeImage(url: string): Promise<void> {
    if (!url.includes(`/${BUCKET}/`)) return;

    const name = url.split(`/${BUCKET}/`)[1];
    if (!name) return;

    await createClient().storage.from(BUCKET).remove([name]);
}

/**
 * data: の文字列を、中身に戻す。
 *
 * "data:image/jpeg;base64,xxxx" の形。
 * 頭の説明と中身を分けて、1 バイトずつ組み直す。
 */
function toBlob(dataUrl: string): Blob {
    const [head, body] = dataUrl.split(",");
    const type = head.match(/data:(.*?);/)?.[1] ?? "image/jpeg";

    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type });
}
