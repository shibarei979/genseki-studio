import WorkspaceClient from "@/components/workspace/workspace-client";

interface Props {
    params: { workId: string };
}

export default function WorkspacePage({ params }: Props) {
    return <WorkspaceClient workId={params.workId} />;
}
