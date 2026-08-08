/**
 * ============================================================
 * 原石航路 Studio
 * GET /api/ai/status
 *
 * モデルに繋がっているかを画面へ伝える。
 *
 * 鍵そのものは返さない。返すのは「あるか無いか」と模型名だけ。
 * これが無いと、いま動いているのが本物のモデルなのか
 * 端末内の簡易版なのか、画面から判断できない。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { hasModelAccess, serverEnv } from "@/config/env.server";

export async function GET() {
    return NextResponse.json({
        connected: hasModelAccess(),
        model: hasModelAccess() ? serverEnv.textModel : null,
        imageModel: hasModelAccess() ? serverEnv.imageModel : null,
    });
}
