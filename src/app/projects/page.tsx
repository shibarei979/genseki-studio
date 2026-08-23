import Link from "next/link";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { formatProjectPeriod, isProjectOpen } from "@/types";
import type { Project } from "@/types";

/**
 * ============================================================
 * 原石航路
 * 自主企画の一覧
 *
 * 利用者が立てた企画が並ぶ。
 * 運営のコンテストとは別で、賞も審査も無い。
 *
 * 受付中を先に、終わったものを後に置く。
 * 探しに来る人のほとんどは、いま参加できるものに用がある。
 * ============================================================
 */

export const revalidate = 60;

export const metadata = {
    title: "自主企画 | 原石航路",
    description: "利用者が立てた企画に、作品で参加できます。",
};

export default async function ProjectsPage() {
    const supabase = await createClient();

    const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(200);

    const projects = (data || []) as Project[];

    /* 立てた人の名前 */
    const ownerIds = Array.from(new Set(projects.map((p) => p.owner_id)));
    const { data: owners } = ownerIds.length
        ? await supabase
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", ownerIds)
        : { data: [] };

    const ownerName: Record<string, string> = {};
    (owners || []).forEach((o: { user_id: string; display_name: string }) => {
        ownerName[o.user_id] = o.display_name;
    });

    const open = projects.filter((p) => isProjectOpen(p));
    const closed = projects.filter((p) => !isProjectOpen(p));

    return (
        <div className="page-with-footer bg-canvas">
            <Header breadcrumbs={[{ label: "自主企画" }]} />

            <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-[20px] font-semibold text-ink">自主企画</h1>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                            利用者が立てた企画です。
                            <br />
                            合言葉を作品のタグに入れると参加できます。
                        </p>
                    </div>

                    <Link
                        href="/projects/new"
                        className="shrink-0 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-white hover:bg-forest-dark"
                    >
                        企画を立てる
                    </Link>
                </div>

                {projects.length === 0 ? (
                    <p className="mt-10 rounded-xl border border-line bg-surface px-5 py-10 text-center text-[13px] text-faint">
                        まだ企画がありません。
                        <br />
                        はじめの一つを立ててみませんか。
                    </p>
                ) : (
                    <>
                        <ProjectList
                            title="受付中"
                            projects={open}
                            ownerName={ownerName}
                        />
                        <ProjectList
                            title="終わった企画"
                            projects={closed}
                            ownerName={ownerName}
                            dim
                        />
                    </>
                )}
            </div>

            <Footer />
        </div>
    );
}

function ProjectList({
    title,
    projects,
    ownerName,
    dim = false,
}: {
    title: string;
    projects: Project[];
    ownerName: Record<string, string>;
    /** 終わった企画は薄く出す */
    dim?: boolean;
}) {
    if (projects.length === 0) return null;

    return (
        <section className="mt-8">
            <h2 className="text-[13px] font-semibold text-ink">{title}</h2>

            <ul className="mt-3 space-y-2.5">
                {projects.map((project) => (
                    <li key={project.id}>
                        <Link
                            href={`/projects/${project.id}`}
                            className={[
                                "block rounded-xl border border-line bg-surface px-4 py-3.5 hover:border-forest-line",
                                dim ? "opacity-60" : "",
                            ].join(" ")}
                        >
                            {/* 画像があれば上に。無ければ題名から始まる */}
                            {project.banner_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={project.banner_url}
                                    alt=""
                                    className="mb-3 aspect-video w-full rounded-lg object-cover"
                                />
                            )}

                            <div className="flex items-baseline justify-between gap-3">
                                <p className="min-w-0 truncate text-[14px] font-semibold text-ink">
                                    {project.title}
                                </p>
                                <span className="shrink-0 text-[11px] text-muted">
                                    {formatProjectPeriod(project)}
                                </span>
                            </div>

                            {project.description && (
                                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                                    {project.description}
                                </p>
                            )}

                            <div className="mt-2.5 flex items-center gap-2">
                                <span className="rounded-full bg-forest-tint px-2.5 py-1 text-[11px] text-forest">
                                    #{project.tag}
                                </span>
                                <span className="text-[11px] text-faint">
                                    {ownerName[project.owner_id] || "不明な主催"}
                                </span>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
