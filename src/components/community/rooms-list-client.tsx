/**
 * ============================================================
 * 原石航路 Studio
 * RoomsListClient — 執筆室の一覧
 *
 * 頁の枠を持ち、中身は RoomsPanel に任せる。
 * コミュニティーの中でも同じ部品を使えるようにするため、
 * 一覧そのものと、頁の枠を分けてある。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import Header from "@/components/layout/header";
import RoomsPanel from "@/components/community/rooms-panel";
import { getRepository } from "@/lib/repository";
import { loadIdentity } from "@/lib/room/presence";
import type { WritingRoom } from "@/types";

export default function RoomsListClient() {
    const [rooms, setRooms] = useState<WritingRoom[]>([]);

    const reload = useCallback(async () => {
        setRooms(await getRepository().listRooms());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const openRooms = rooms.filter((room) => room.visibility === "open");
    const myRooms = rooms.filter(
        (room) => room.host_id === loadIdentity().id && room.visibility !== "open",
    );

    return (
        <div className="min-h-screen bg-page">
            <Header
                breadcrumbs={[
                    { label: "コミュニティー", href: "/rooms" },
                    { label: "執筆室" },
                ]}
            />

            <main className="mx-auto max-w-5xl px-6 py-6">
                <RoomsPanel
                    openRooms={openRooms}
                    myRooms={myRooms}
                    onChanged={reload}
                />
            </main>
        </div>
    );
}
