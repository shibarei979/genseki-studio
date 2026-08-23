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
    return (
        <div className="page-with-footer bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "自主企画", href: "/projects" },
                    { label: "企画を立てる" },
                ]}
            />

            <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-6">
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
