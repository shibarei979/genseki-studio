"use client";

import { useEffect } from "react";

import { loadFont, usableFont } from "@/lib/fonts/catalog";
import { useMemberFeatures } from "@/lib/subscription/use-member-features";

/**
 * 本文に使う書体の font-family を返し、必要なら読み込む。
 *
 * ★ Pro の書体を選んでいても、Pro でない人（切れた人を含む）には明朝で出す。
 *   選んだ値そのものは消さない。入り直せば、また同じ書体で出る。
 */
export function useFontStack(key: string | null | undefined): string {
    const { fonts } = useMemberFeatures();
    const font = usableFont(key, fonts);

    useEffect(() => {
        loadFont(font.key);
    }, [font.key]);

    return font.stack;
}
