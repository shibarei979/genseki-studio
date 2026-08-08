import ResourceClient from "@/components/resource/resource-client";

interface Props {
    params: { workId: string };
}

export default function ResourcePage({ params }: Props) {
    return <ResourceClient workId={params.workId} />;
}
