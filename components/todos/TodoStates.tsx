"use client";

import React from "react";
import {
    Eye,
    ListTodo,
    RefreshCw,
    ShieldAlert,
    TriangleAlert,
    WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isInvalidParamsError } from "@/src/utils/todoCopy";
import {
    getTodoErrorKind,
    getTodoErrorMessage,
    isForbiddenError,
} from "@/src/utils/todoList";

const SKELETON_WIDTHS = ["68%", "52%", "80%", "44%"] as const;

export function TodoReadOnlyBanner({
    ownerName,
    onBackToMine,
}: {
    ownerName: string;
    onBackToMine?: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs leading-5 text-text-main forest:border-primary/40 forest:bg-primary/18 ocean:border-primary/30 ocean:bg-primary/8">
            <div className="flex min-w-0 items-center gap-2 py-1">
                <Eye
                    aria-hidden="true"
                    className="size-4 shrink-0 text-primary forest:text-text-main"
                />
                <span className="min-w-0 wrap-anywhere">
                    正在檢視 <strong className="font-semibold">{ownerName}</strong>{" "}
                    的清單（唯讀）
                </span>
            </div>
            {onBackToMine && (
                <button
                    type="button"
                    onClick={onBackToMine}
                    className="inline-flex min-h-11 -my-1.5 -mr-1 items-center rounded-lg px-2 text-xs font-semibold whitespace-nowrap text-text-main underline decoration-primary/70 underline-offset-4 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                >
                    回到我的清單
                </button>
            )}
        </div>
    );
}

export function TodoOfflineBanner({
    id,
    readOnly = false,
}: {
    id?: string;
    readOnly?: boolean;
}) {
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
                {readOnly
                    ? "目前離線：顯示的是已快取的清單。"
                    : "目前離線：可瀏覽已快取的清單，恢復連線後即可修改。"}
            </span>
        </div>
    );
}

export function TodoLoadingSkeleton({
    readOnly = false,
    ownerName,
}: {
    readOnly?: boolean;
    ownerName?: string;
}) {
    if (readOnly) {
        return (
            <div
                role="status"
                aria-label={
                    ownerName
                        ? `載入 ${ownerName} 的待辦清單中`
                        : "載入待辦清單中"
                }
            >
                <div className="border-b border-border bg-background/55 p-3">
                    <div className="h-11 w-full animate-pulse rounded-xl bg-border/75 motion-reduce:animate-none" />
                </div>
                <div className="divide-y divide-border/75 px-4 py-0.5">
                    {SKELETON_WIDTHS.map((width, index) => (
                        <div
                            key={index}
                            className="flex min-h-[48px] items-center gap-3"
                        >
                            <div className="size-5 shrink-0 animate-pulse rounded-full bg-border/75 motion-reduce:animate-none" />
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

export function TodoEmptyState({
    ownerName,
    readOnly = false,
}: {
    ownerName?: string;
    readOnly?: boolean;
}) {
    const title =
        readOnly && ownerName
            ? `${ownerName} 還沒有待辦事項`
            : "還沒有待辦事項";
    const subtitle = readOnly
        ? "等對方新增項目後，就能在這裡查看並複製。"
        : "把行前準備、要訂的票或提醒記在這裡。";

    return (
        <div className="flex flex-col items-center px-6 py-8 text-center">
            <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary forest:text-text-main">
                <ListTodo aria-hidden="true" className="size-6" />
            </div>
            <p className="text-[15px] font-bold text-text-main">{title}</p>
            <p className="mt-1.5 max-w-[260px] text-[13px] leading-5 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                {subtitle}
            </p>
        </div>
    );
}

export function TodoOfflineNoCacheState({
    ownerName,
    readOnly = false,
}: {
    ownerName?: string;
    readOnly?: boolean;
}) {
    const subtitle = readOnly
        ? ownerName
            ? `恢復網路連線後即可載入 ${ownerName} 的待辦清單。`
            : "恢復網路連線後即可載入這份待辦清單。"
        : "恢復網路連線後將自動載入你的待辦事項。";

    return (
        <div className="flex flex-col items-center px-6 py-8 text-center">
            <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-amber-600/45 bg-amber-50 text-amber-700 forest:border-amber-400/45 forest:bg-amber-950/55 forest:text-amber-300">
                <WifiOff aria-hidden="true" className="size-6" />
            </div>
            <p className="text-[15px] font-bold text-text-main">
                目前離線，尚未載入過這份清單
            </p>
            <p className="mt-1.5 max-w-[260px] text-[13px] leading-5 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                {subtitle}
            </p>
        </div>
    );
}

export function TodoLoadErrorState({
    error,
    isOnline = true,
    isRetrying,
    offlineBannerId,
    onRetry,
    ownerName,
    readOnly = false,
    onBackToMine,
}: {
    error: unknown;
    isOnline?: boolean;
    isRetrying: boolean;
    offlineBannerId?: string;
    onRetry: () => void;
    ownerName?: string;
    readOnly?: boolean;
    onBackToMine?: () => void;
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
    const isInvalidMember = readOnly && isInvalidParamsError(error);
    const title =
        readOnly && ownerName
            ? `無法載入 ${ownerName} 的清單`
            : "無法載入待辦清單";
    const subtitle = isInvalidMember
        ? "這位旅伴可能已從試算表設定中移除，請稍後再試或切換其他成員。"
        : kind === "invalid_sheet_layout" || kind === "unauthorized"
          ? getTodoErrorMessage(error, "load")
          : "請確認網路連線後再試一次。";
    const isDisabled = isRetrying || !isOnline;
    const isSpinnerActive = isRetrying && isOnline;

    return (
        <div
            role="alert"
            className="flex flex-col items-center px-6 py-8 text-center"
        >
            <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600 forest:bg-red-950/60 forest:text-red-300">
                <TriangleAlert aria-hidden="true" className="size-6" />
            </div>
            <p className="text-[15px] font-bold text-text-main">{title}</p>
            <p className="mt-1.5 max-w-[260px] text-[13px] leading-5 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                {subtitle}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={isDisabled}
                    aria-disabled={isDisabled ? "true" : undefined}
                    aria-describedby={!isOnline ? offlineBannerId : undefined}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-surface motion-reduce:transition-none"
                >
                    <RefreshCw
                        aria-hidden="true"
                        className={cn(
                            "size-4",
                            isSpinnerActive &&
                                "animate-spin motion-reduce:animate-none",
                        )}
                    />
                    <span>重新載入</span>
                </button>
                {isInvalidMember && onBackToMine && (
                    <button
                        type="button"
                        onClick={onBackToMine}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                    >
                        回到我的清單
                    </button>
                )}
            </div>
        </div>
    );
}
