/**
 * ============================================================
 * 原石航路 Studio
 * WritingLogForm — 設定 / 執筆の記録
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import { formatNumber } from "@/lib/utils/text";
import type { WorkPreferences, WritingLog } from "@/types";
import { calcStreak, todayKey } from "@/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface Props {
    preferences: WorkPreferences;
    logs: WritingLog[];
    onChange: (patch: Partial<Omit<WorkPreferences, "work_id">>) => void;
}

export default function WritingLogForm({ preferences, logs, onChange }: Props) {
    const byDate = useMemo(
        () => new Map(logs.map((log) => [log.date, log])),
        [logs],
    );

    const streak = useMemo(() => calcStreak(logs), [logs]);
    const today = byDate.get(todayKey());
    const totalWritten = logs.reduce((sum, log) => sum + Math.max(0, log.delta), 0);
    /* 今月に書いた文字数 */
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthChars = logs
        .filter((row) => row.date.startsWith(monthKey) && row.delta > 0)
        .reduce((sum, row) => sum + row.delta, 0);

    const writtenDays = logs.filter((log) => log.delta > 0).length;
    const best = logs.reduce((max, log) => Math.max(max, log.delta), 0);

    /** 表示している月。既定は今月 */
    const [monthOffset, setMonthOffset] = useState(0);

    const calendar = useMemo(() => {
        const base = new Date();
        base.setDate(1);
        base.setMonth(base.getMonth() + monthOffset);

        const year = base.getFullYear();
        const month = base.getMonth();
        const firstWeekday = new Date(year, month, 1).getDay();
        const dayCount = new Date(year, month + 1, 0).getDate();

        const cells: ({ date: string; day: number; delta: number } | null)[] = [];
        // 月の頭の空白。曜日を揃えるため
        for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
        for (let day = 1; day <= dayCount; day += 1) {
            const key = todayKey(new Date(year, month, day));
            cells.push({ date: key, day, delta: byDate.get(key)?.delta ?? 0 });
        }

        const monthTotal = cells.reduce(
            (sum, cell) => sum + Math.max(0, cell?.delta ?? 0),
            0,
        );

        return { year, month: month + 1, cells, monthTotal };
    }, [byDate, monthOffset]);

    const goalRatio =
        preferences.daily_goal > 0 && today
            ? Math.min(1, Math.max(0, today.delta) / preferences.daily_goal)
            : 0;

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-line bg-surface">
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                    <div>
                        <h2 className="text-base font-medium text-ink">執筆の記録</h2>
                        <p className="mt-1 text-sm text-muted">
                            日ごとの文字数と、書いた日の連なりを残します。
                        </p>
                    </div>
                    <Toggle
                        checked={preferences.record_progress}
                        onChange={(next) => onChange({ record_progress: next })}
                        label="執筆の記録を残す"
                    />
                </div>

                {!preferences.record_progress ? (
                    <p className="px-6 py-8 text-sm text-faint">
                        記録はオフです。すでに残っている記録は消えませんが、
                        これ以降は増えません。
                    </p>
                ) : (
                    <div className="px-6 py-5">
                        {/*
                         * 今月のぶんを前に出す。
                         *
                         * 連続日数を大きく出すと、
                         * 「途切れた」という圧になる。
                         * 原石航路は完成を急かさない場所なので、
                         * 積み上がったものを見せるほうが合う。
                         */}
                        <p className="text-[11px] text-faint">今月</p>

                        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <Stat label="書いた文字" value={monthChars} unit="文字" />
                            <Stat label="書いた日" value={writtenDays} unit="日" />
                            <Stat label="いちばん多い日" value={best} unit="文字" />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted">
                            <span>
                                今日　
                                <span className="text-ink">
                                    {formatNumber(today ? Math.max(0, today.delta) : 0)}
                                </span>
                                字
                            </span>

                            {/* 連続は小さく添えるだけ */}
                            {streak > 0 && (
                                <span>
                                    いまの連続　
                                    <span className="text-ink">{streak}</span>日
                                </span>
                            )}
                        </div>

                        {preferences.daily_goal > 0 && (
                            <div className="mt-4">
                                <div className="flex items-baseline justify-between text-xs">
                                    <span className="text-muted">今日の目標</span>
                                    <span className="text-ink">
                                        {formatNumber(today ? Math.max(0, today.delta) : 0)} /{" "}
                                        {formatNumber(preferences.daily_goal)}文字
                                    </span>
                                </div>
                                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                                    <div
                                        className="h-full rounded-full bg-forest transition-all"
                                        style={{ width: `${Math.round(goalRatio * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted">
                                    {calendar.year}年{calendar.month}月
                                    <span className="ml-2 text-faint">
                                        {formatNumber(calendar.monthTotal)}文字
                                    </span>
                                </p>
                                <div className="flex items-center gap-1">
                                    <MonthButton
                                        label="‹"
                                        onClick={() => setMonthOffset((v) => v - 1)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMonthOffset(0)}
                                        disabled={monthOffset === 0}
                                        className="rounded px-2 py-0.5 text-xs text-muted hover:bg-canvas disabled:opacity-30"
                                    >
                                        今月
                                    </button>
                                    <MonthButton
                                        label="›"
                                        disabled={monthOffset >= 0}
                                        onClick={() => setMonthOffset((v) => v + 1)}
                                    />
                                </div>
                            </div>

                            <div className="mt-2 w-fit rounded-md border border-line p-2">
                                <div className="grid grid-cols-7 gap-[3px]">
                                    {WEEKDAYS.map((weekday) => (
                                        <span
                                            key={weekday}
                                            className="text-center text-[10px] text-faint"
                                        >
                                            {weekday}
                                        </span>
                                    ))}
                                    {calendar.cells.map((cell, index) =>
                                        cell === null ? (
                                            <span key={`blank-${index}`} className="h-6 w-6" />
                                        ) : (
                                            <span
                                                key={cell.date}
                                                title={`${cell.date}　${formatNumber(Math.max(0, cell.delta))}文字`}
                                                className="flex h-6 w-6 items-center justify-center rounded-[3px] text-[10px]"
                                                style={{
                                                    background: shade(cell.delta),
                                                    color:
                                                        cell.delta >= 800
                                                            ? "#fff"
                                                            : "var(--color-muted)",
                                                }}
                                            >
                                                {cell.day}
                                            </span>
                                        ),
                                    )}
                                </div>
                            </div>

                            <p className="mt-2 text-xs text-faint">
                                濃いほどたくさん書いた日です。
                                記録は残し始めた日からしか作れないので、既定でオンにしています。
                            </p>
                        </div>

                        <div className="mt-6 max-w-xs">
                            <label
                                htmlFor="daily-goal"
                                className="block text-sm font-medium text-ink"
                            >
                                1日の目標文字数
                            </label>
                            <input
                                id="daily-goal"
                                type="number"
                                min={0}
                                step={100}
                                value={preferences.daily_goal}
                                onChange={(e) =>
                                    onChange({ daily_goal: Number(e.target.value) || 0 })
                                }
                                className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                            <p className="mt-1 text-xs text-faint">
                                0 にすると目標を出しません。
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** 書いた量で色の濃さを変える */
function shade(delta: number): string {
    if (delta <= 0) return "var(--color-line)";
    if (delta < 300) return "#cfe0d4";
    if (delta < 800) return "#9ec4ab";
    if (delta < 2000) return "#5f9a72";
    return "var(--color-forest)";
}

function MonthButton({
    label,
    disabled = false,
    onClick,
}: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="rounded px-2 py-0.5 text-xs text-muted hover:bg-canvas disabled:opacity-30"
        >
            {label}
        </button>
    );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
    return (
        <div className="rounded-md border border-line px-3 py-2.5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-0.5 text-lg text-ink">
                {formatNumber(value)}
                <span className="ml-0.5 text-xs text-muted">{unit}</span>
            </p>
        </div>
    );
}

function Toggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={[
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                checked ? "bg-forest" : "bg-[var(--color-line)]",
            ].join(" ")}
        >
            <span
                className={[
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    checked ? "left-[22px]" : "left-0.5",
                ].join(" ")}
            />
        </button>
    );
}
