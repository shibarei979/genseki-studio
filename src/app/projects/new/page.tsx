import { notFound } from "next/navigation";
import { PROJECTS_ENABLED } from "@/config/projects";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import ProjectForm from "@/components/projects/project-form";

/**
 * ============================================================
 * 原石航路
 * 企画を立てる
 * ============================================================
 */

export const metadata = {
    title: "企画を立てる | 原石航路",
};

export default function NewProjectPage() {
    /* いまは表に出さない。config/projects.ts で入切する */
    if (!PROJECTS_ENABLED) notFound();


    return (
        <div className="page-with-footer bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "自主企画", href: "/projects" },
                    { label: "企画を立てる" },
                ]}
            />

            {/* m9-pjn: 携帯だけの見た目（styles/mobile-p9.css） */}
            <div className="m9-pjn mx-auto w-full max-w-2xl px-5 py-8 sm:px-6">
                <h1 className="text-[20px] font-semibold text-ink">企画を立てる</h1>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    合言葉を決めると、その言葉をタグに入れた作品が集まります。
                    <br />
                    賞や審査はありません。読み合うための場所です。
                </p>

                <div className="mt-7">
                    <ProjectForm />
                </div>
            </div>

            <Footer />
        </div>
    );
}
