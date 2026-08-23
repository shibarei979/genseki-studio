import Link from "next/link";
import { notFound } from "next/navigation";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import ProjectJoin from "@/components/projects/project-join";
import { formatProjectPeriod, isProjectOpen } from "@/types";
import type { Project } from "@/types";

/**
 * ============================================================
 * 原石航路
 * 企画のページ
 *
 * 企画の説明と、参加している作品が並ぶ。
 *
 * 参加は合言葉（タグ）で決まる。
 * そのタグを作品に付ければ、ここに出る。承認は要らない。
 * ============================================================
 */

export const revalidate = 60;

/** 一度に出す作品の数 */
const ENTRY_LIMIT = 100;

export default async function ProjectPage({
    params,
}: {
    params: { id: string };
}) {
    const supabase = await createClient();

    const { data: row } = await supabase
        .from("projects")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();

    if (!row) notFound();
    const project = row as Project;

    /* 立てた人 */
    const { data: owner } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("user_id", project.owner_id)
        .maybeSingle();

    /*
     * 参加している作品。
     *
     * 合言葉と同じタグを持つ、公開中の作品を集める。
     * 承認の仕組みは無いので、タグを付けた時点で並ぶ。
     */
    const { data: entries } = await supabase
        .from("novels")
        .select("id, title, summary, genre, tags, author_id, created_at")
        .contains("tags", [project.tag])
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(ENTRY_LIMIT);

    const novels = entries || [];

    /* 作者の名前 */
    const authorIds = Array.from(
        new Set(novels.map((n: { author_id: string }) => n.author_id)),
    );
    const { data: authors } = authorIds.length
        ? await supabase
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", authorIds)
        : { data: [] };

    const authorName: Record<string, string> = {};
    (authors || []).forEach((a: { user_id: string; display_name: string }) => {
        authorName[a.user_id] = a.display_name;
    });

    const open = isProjectOpen(project);

    return (
        <div className="page-with-footer bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "自主企画", href: "/projects" },
                    { label: project.title },
                ]}
            />

            <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
                {/* 企画そのもの */}
                <section className="overflow-hidden rounded-xl border border-line bg-surface">
                    {project.banner_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={project.banner_url}
                            alt=""
                            className="block aspect-[3/1] w-full object-cover"
                        />
                    )}

                    <div className="px-5 py-5">
                    <div className="flex items-start justify-between gap-3">
                        <h1 className="text-[19px] font-semibold leading-snug text-ink">
                            {project.title}
                        </h1>
                        <span
                            className={[
                                "shrink-0 rounded-full px-2.5 py-1 text-[11px]",
                                open
                                    ? "bg-forest-tint text-forest"
                                    : "bg-canvas text-faint",
                            ].join(" ")}
                        >
                            {open ? "受付中" : "終了"}
                        </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
                        <span>主催：{owner?.display_name || "不明"}</span>
                        <span>{formatProjectPeriod(project)}</span>
                    </div>

                    {project.description && (
                        <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                            {project.description}
                        </p>
                    )}

                    {/*
                     * 参加の仕方。
                     *
                     * 合言葉を出すだけでは伝わらない。
                     * 何をすれば参加になるのかを、その場に書く。
                     */}
                    <div className="mt-5 rounded-lg border border-forest-line/60 bg-forest-tint/30 px-4 py-3.5">
                        <p className="text-[12px] font-medium text-ink">参加の仕方</p>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                            作品のタグに
                            <span className="mx-1 rounded bg-surface px-2 py-0.5 font-medium text-forest">
                                {project.tag}
                            </span>
                            を入れると、この一覧に並びます。
                        </p>
                        <p className="mt-1.5 text-[11px] text-faint">
                            下の押し具から選ぶと、タグが自動で付きます。
                        </p>

                        {/* 受付中のときだけ出す。終わった企画には参加できない */}
                        {open && (
                            <ProjectJoin tag={project.tag} projectTitle={project.title} />
                        )}
                    </div>
                    </div>
                </section>

                {/* 参加している作品 */}
                <section className="mt-8">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 className="text-[14px] font-semibold text-ink">
                            参加している作品
                        </h2>
                        <span className="text-[12px] text-muted">{novels.length}作品</span>
                    </div>

                    {novels.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-line bg-surface px-5 py-10 text-center text-[13px] text-faint">
                            まだ参加している作品がありません。
                            <br />
                            はじめの一作になってみませんか。
                        </p>
                    ) : (
                        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                            {novels.map(
                                (novel: {
                                    id: string;
                                    title: string;
                                    summary: string | null;
                                    genre: string;
                                    author_id: string;
                                }) => (
                                    <li key={novel.id}>
                                        <Link
                                            href={`/novel/${novel.id}`}
                                            className="block px-4 py-3.5 hover:bg-canvas"
                                        >
                                            <p className="truncate text-[14px] text-ink">
                                                {novel.title}
                                            </p>
                                            <p className="mt-1 text-[11px] text-faint">
                                                著：{authorName[novel.author_id] || "不明な作者"}
                                                　{novel.genre}
                                            </p>
                                            {novel.summary && (
                                                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                                                    {novel.summary}
                                                </p>
                                            )}
                                        </Link>
                                    </li>
                                ),
                            )}
                        </ul>
                    )}
                </section>
            </div>

            <Footer />
        </div>
    );
}
