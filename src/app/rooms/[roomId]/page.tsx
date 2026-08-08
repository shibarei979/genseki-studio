import RoomClient from "@/components/room/room-client";

interface Props {
    params: { roomId: string };
}

export default function RoomPage({ params }: Props) {
    return <RoomClient roomId={params.roomId} />;
}
