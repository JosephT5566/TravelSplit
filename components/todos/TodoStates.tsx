"use client";

import React from "react";
import {
    ListTodo,
    RefreshCw,
    ShieldAlert,
    TriangleAlert,
    WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getTodoErrorKind,
    getTodoErrorMessage,
    isForbiddenError,
} from "@/src/utils/todoList";

const SKELETON_WIDTHS = ["68%", "52%", "80%", "44%"] as const;

export function TodoOfflineBanner({ id }: { id?: string }) {
    return (
        <div
            id={id}
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-amber-600/45 bg-amber-50 px-3 py-2.5 text-xs leading-5 font-medium text-amber-950 forest:border-amber-400/45 forest:bg-amber-950/55 forest:text-amber-100"
        >
            <WifiOff
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-amber-700 forest:text-amber-300"
            />
            <span className="min-w-0 flex-1">
                目前離線：可瀏覽已快取的清單，恢復連線後即可修改。
            </span>
        </div>
    );
}

export function TodoLoadingSkeleton() {
    return (
        <div role="status" aria-label="載入待辦清單中">
            <div className="flex items-center gap-2 border-b border-border bg-background/55 p-3">
                <div className="h-11 min-w-0 flex-1 animate-pulse rounded-xl bg-border/75 motion-reduce:animate-none" />
                <div className="h-11 w-[74px] shrink-0 animate-pulse rounded-xl bg-border/75 motion-reduce:animate-none" />
            </div>
            <div className="divide-y divide-border/75 px-3.5 py-1">
                {SKELETON_WIDTHS.map((width, index) => (
                    <div
                        key={index}
                        className="flex min-h-[52px] items-center gap-3.5"
                    >
                        <div className="size-[22px] shrink-0 animate-pulse rounded-[6px] bg-border/75 motion-reduce:animate-none" />
                        <div
                            className="h-3.5 animate-pulse rounded-md bg-border/75 motion-reduce:animate-none"
                            style={{ width }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TodoEmptyState() {
    return (
        <div className="flex flex-col items-center px-6 py-8 text-center">
            <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary forest:text-text-main">
                <ListTodo aria-hidden="true" className="size-6" />
            </div>
            <p className="text-[15px] font-bold text-text-main">
                還沒有待辦事項
            </p>
            <p className="mt-1.5 max-w-[260px] text-[13px] leading-5 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                把行前準備、要訂的票或提醒記在這裡。
            </p>
        </div>
    );
}

export function TodoOfflineNoCacheState() {
    return (
        <div className="flex flex-col items-center px-6 py-8 text-center">
            <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-amber-600/45 bg-amber-50 text-amber-700 forest:border-amber-400/45 forest:bg-amber-950/55 forest:text-amber-300">
                <WifiOff aria-hidden="true" className="size-6" />
            </div>
            <p className="text-[15px] font-bold text-text-main">
                目前離線，尚未載入過這份清單
            </p>
            <p className="mt-1.5 max-w-[260px] text-[13px] leading-5 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                恢復網路連線後將自動載入你的待辦事項。
            </p>
        </div>
    );
}

export function TodoLoadErrorState({
    error,
    isRetrying,
    onRetry,
}: {
    error: unknown;
    isRetrying: boolean;
    onRetry: () => void;
}) {
    if (isForbiddenError(error)) {
        return (
            <div
                role="alert"
                className="flex flex-col items-center px-6 py-8 text-center"
            >
                <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600 forest:bg-red-950/60 forest:text-red-300">
                    <ShieldAlert aria-hidden="true" className="size-6" />
                </div>
                <p className="text-[15px] font-bold text-text-main">
                    你不是這個旅程的成員，無法查看待辦
                </p>
                <p className="mt-1.5 max-w-[260px] text-[13px] leading-5 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                    若需使用待辦清單，請聯絡旅程管理員將你加入成員。
                </p>
            </div>
        );
    }

    const kind = getTodoErrorKind(error);
    const subtitle =
        kind === "invalid_sheet_layout" || kind === "unauthorized"
            ? getTodoErrorMessage(error, "load")
            : "請確認網路連線後再試一次。";

    return (
        <div
            role="alert"
            className="flex flex-col items-center px-6 py-8 text-center"
        >
            <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600 forest:bg-red-950/60 forest:text-red-300">
                <TriangleAlert aria-hidden="true" className="size-6" />
            </div>
            <p className="text-[15px] font-bold text-text-main">
                無法載入待辦清單
            </p>
            <p className="mt-1.5 max-w-[260px] text-[13px] leading-5 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                {subtitle}
            </p>
            <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-55 motion-reduce:transition-none"
            >
                <RefreshCw
                    aria-hidden="true"
                    className={cn(
                        "size-4",
                        isRetrying &&
                            "animate-spin motion-reduce:animate-none",
                    )}
                />
                <span>重新載入</span>
            </button>
        </div>
    );
}
