import SettingsClient from "@/components/settings/settings-client";

interface Props {
    params: { workId: string };
}

export default function SettingsPage({ params }: Props) {
    return <SettingsClient workId={params.workId} />;
}
