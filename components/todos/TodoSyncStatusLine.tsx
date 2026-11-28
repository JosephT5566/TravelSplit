"use client";

import React from "react";
import {
    Check,
    CircleAlert,
    Clock,
    CloudOff,
    Info,
    Loader2,
    LogIn,
    TriangleAlert,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
    TodoSyncStatusKind,
    TodoSyncStatusResult,
    TodoSyncStatusTone,
} from "@/src/utils/todoSyncStatus";

const TONE_CLASS_BY_TONE: Record<TodoSyncStatusTone, string> = {
    ok: "text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68",
    syncing: "text-primary",
    pending: "text-amber-700 forest:text-amber-300",
    offline: "text-amber-800 forest:text-amber-200",
    failed: "text-red-600 forest:text-red-300",
};

function CloudCheckIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
        >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

function StatusIcon({
    kind,
    className,
}: {
    kind: TodoSyncStatusKind;
    className?: string;
}) {
    switch (kind) {
        case "saved":
            return <CloudCheckIcon className={className} />;
        case "refreshed":
            return (
                <Check
                    aria-hidden="true"
                    className={cn(className, "stroke-[2.4]")}
                />
            );
        case "pending":
            return <Clock aria-hidden="true" className={className} />;
        case "inflight":
        case "refreshing":
            return (
                <Loader2
                    aria-hidden="true"
                    className={cn(
                        className,
                        "animate-spin motion-reduce:animate-none",
                    )}
                />
            );
        case "offline-pending":
        case "offline-idle":
            return <CloudOff aria-hidden="true" className={className} />;
        case "auth-expired":
            return <LogIn aria-hidden="true" className={className} />;
        case "failed":
            return <CircleAlert aria-hidden="true" className={className} />;
        default:
            return null;
    }
}

export interface TodoSyncStatusLineProps {
    id?: string;
    status: TodoSyncStatusResult;
    droppedNotice: string | null;
    politeAnnouncement: string;
    alertAnnouncement: string;
    onSyncNow?: () => void;
    onRetryAll?: () => void;
    onSignIn?: () => void;
    onDismissDropped?: () => void;
}

export function TodoSyncStatusLine({
    id,
    status,
    droppedNotice,
    politeAnnouncement,
    alertAnnouncement,
    onSyncNow,
    onRetryAll,
    onSignIn,
    onDismissDropped,
}: TodoSyncStatusLineProps) {
    const hasMainText = status.text.length > 0;
    const hasVisualLine =
        hasMainText || Boolean(droppedNotice) || Boolean(status.warning);
    const toneClass = TONE_CLASS_BY_TONE[status.tone];

    const handleActionClick = () => {
        if (status.action === "sync-now") {
            onSyncNow?.();
        } else if (status.action === "retry") {
            onRetryAll?.();
        } else if (status.action === "sign-in") {
            onSignIn?.();
        }
    };

    const actionAriaLabel =
        status.action === "sync-now" ? `${status.text}，立即同步` : undefined;

    return (
        <>
            {hasVisualLine && (
                <div className="-mt-1 flex min-w-0 flex-col gap-1">
                    {hasMainText &&
                        (status.action !== null ? (
                            <button
                                id={id}
                                type="button"
                                data-slot="todo-sync-status"
                                data-status-kind={status.kind}
                                data-status-tone={status.tone}
                                aria-label={actionAriaLabel}
                                onClick={handleActionClick}
                                className={cn(
                                    "-my-3 inline-flex min-h-11 max-w-full min-w-0 cursor-pointer items-center gap-1.5 self-start rounded-lg py-3 text-left text-xs leading-4 font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
                                    toneClass,
                                )}
                            >
                                <StatusIcon
                                    kind={status.kind}
                                    className="size-3.5 shrink-0"
                                />
                                <span className="min-w-0 break-words tabular-nums underline underline-offset-2">
                                    {status.text}
                                </span>
                            </button>
                        ) : (
                            <p
                                id={id}
                                data-slot="todo-sync-status"
                                data-status-kind={status.kind}
                                data-status-tone={status.tone}
                                className={cn(
                                    "flex min-h-5 max-w-full min-w-0 items-start gap-1.5 text-xs leading-4 font-semibold",
                                    toneClass,
                                )}
                            >
                                <StatusIcon
                                    kind={status.kind}
                                    className="mt-px size-3.5 shrink-0"
                                />
                                <span className="min-w-0 break-words tabular-nums">
                                    {status.text}
                                </span>
                            </p>
                        ))}

                    {droppedNotice && (
                        <div
                            data-slot="todo-dropped-notice"
                            className="flex min-h-5 max-w-full min-w-0 items-center justify-between gap-1 text-xs leading-4 font-medium text-amber-800 forest:text-amber-200"
                        >
                            <span className="flex min-w-0 flex-1 items-start gap-1.5">
                                <Info
                                    aria-hidden="true"
                                    className="mt-px size-3.5 shrink-0"
                                />
                                <span className="min-w-0 break-words">
                                    {droppedNotice}
                                </span>
                            </span>
                            {onDismissDropped && (
                                <button
                                    type="button"
                                    aria-label="關閉提醒"
                                    onClick={onDismissDropped}
                                    className="-my-3 -mr-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-amber-800/80 transition-colors hover:bg-amber-100/80 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary forest:text-amber-200/80 forest:hover:bg-amber-950/60 motion-reduce:transition-none"
                                >
                                    <X
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                </button>
                            )}
                        </div>
                    )}

                    {status.warning && (
                        <p
                            data-slot="todo-storage-warning"
                            className="flex min-h-5 max-w-full min-w-0 items-start gap-1.5 text-xs leading-4 font-medium text-amber-800 forest:text-amber-200"
                        >
                            <TriangleAlert
                                aria-hidden="true"
                                className="mt-px size-3.5 shrink-0"
                            />
                            <span className="min-w-0 break-words">
                                {status.warning}
                            </span>
                        </p>
                    )}
                </div>
            )}

            <span
                data-slot="todo-sync-live-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {politeAnnouncement}
            </span>
            <span
                data-slot="todo-sync-live-alert"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className="sr-only"
            >
                {alertAnnouncement}
            </span>
        </>
    );
}
