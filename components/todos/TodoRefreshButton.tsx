"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TodoRefreshButtonProps {
    /** True while a manual or background refetch of the viewed list is running. */
    isRefreshing: boolean;
    isOnline: boolean;
    /** Id of the visible offline notice, referenced while the button is offline-disabled. */
    offlineNoticeId?: string;
    onRefresh: () => void;
}

/**
 * Icon-only manual refresh for the viewed todo list. Uses `aria-disabled`
 * (not `disabled`) so keyboard focus stays on the button while it spins.
 * The "已更新" announcement comes from the sync status line's live region.
 */
export function TodoRefreshButton({
    isRefreshing,
    isOnline,
    offlineNoticeId,
    onRefresh,
}: TodoRefreshButtonProps) {
    const isDisabled = isRefreshing || !isOnline;

    return (
        <button
            type="button"
            aria-label="重新整理"
            title="重新整理"
            aria-disabled={isDisabled ? "true" : undefined}
            aria-busy={isRefreshing ? "true" : undefined}
            aria-describedby={!isOnline ? offlineNoticeId : undefined}
            onClick={() => {
                if (isDisabled) {
                    return;
                }
                onRefresh();
            }}
            className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-primary shadow-2xs transition-colors hover:border-primary/40 hover:bg-background active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface forest:text-text-main forest:hover:border-primary/70 ocean:hover:border-primary/60 motion-reduce:transition-none",
                isDisabled &&
                    "cursor-not-allowed opacity-55 hover:border-border hover:bg-surface active:scale-100",
            )}
        >
            <RefreshCw
                aria-hidden="true"
                className={cn(
                    "size-[15px] shrink-0",
                    isRefreshing && "animate-spin motion-reduce:animate-none",
                )}
            />
        </button>
    );
}
