"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, Loader2, TriangleAlert } from "lucide-react";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useCreateTodos, useTodosQuery } from "@/services/dataFetcher";
import type { TodoItem } from "@/src/types";
import {
    buildCopyCandidates,
    buildCopyItems,
    chunkCopyItems,
    summarizeCopyResult,
    TODO_COPY_BATCH_SIZE,
    type CopyResultSummary,
} from "@/src/utils/todoCopy";
import { sortTodos } from "@/src/utils/todoList";

export interface TodoCopyDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sheetId: string;
    myEmail: string;
    ownerName: string;
    sourceItems: readonly TodoItem[];
    isOnline: boolean;
    onSuccess: (message: string) => void;
    onGoToMine?: () => void;
}

type CopyFailureState = {
    summary: CopyResultSummary;
    isPartial: boolean;
    isUnconfirmed: boolean;
};

interface TodoCopyDrawerBodyProps {
    sheetId: string;
    myEmail: string;
    ownerName: string;
    sourceItems: readonly TodoItem[];
    isOnline: boolean;
    isSending: boolean;
    onSendingChange: (sending: boolean) => void;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onGoToMine?: () => void;
}

function TodoCopyDrawerBody({
    sheetId,
    myEmail,
    ownerName,
    sourceItems,
    isOnline,
    isSending,
    onSendingChange,
    onClose,
    onSuccess,
    onGoToMine,
}: TodoCopyDrawerBodyProps) {
    const myTodosQuery = useTodosQuery(sheetId, myEmail);
    const createTodosMutation = useCreateTodos(sheetId, myEmail);

    const [activeItems, setActiveItems] = useState<TodoItem[]>(() =>
        sortTodos(sourceItems),
    );
    const [isPartialRetryMode, setIsPartialRetryMode] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{
        current: number;
        total: number;
    } | null>(null);
    const [failureState, setFailureState] = useState<CopyFailureState | null>(
        null,
    );

    const candidates = useMemo(
        () =>
            buildCopyCandidates(
                activeItems,
                isPartialRetryMode ? undefined : myTodosQuery.data,
            ),
        [activeItems, isPartialRetryMode, myTodosQuery.data],
    );

    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
        const initialCandidates = buildCopyCandidates(
            sortTodos(sourceItems),
            myTodosQuery.data,
        );
        return new Set(
            initialCandidates
                .filter((candidate) => !candidate.isDuplicate)
                .map((candidate) => candidate.id),
        );
    });

    const sendingRef = useRef(false);
    const mountedRef = useRef(true);
    const hasAppliedInitialDuplicatesRef = useRef(
        myTodosQuery.data !== undefined,
    );
    const hasUserToggledRef = useRef(false);
    const alertRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // If myTodos arrives asynchronously before the user makes manual edits,
    // automatically uncheck newly detected duplicates once.
    useEffect(() => {
        if (
            myTodosQuery.data === undefined ||
            hasAppliedInitialDuplicatesRef.current ||
            hasUserToggledRef.current ||
            isPartialRetryMode ||
            sendingRef.current
        ) {
            return;
        }
        hasAppliedInitialDuplicatesRef.current = true;
        setSelectedIds(
            new Set(
                candidates
                    .filter((candidate) => !candidate.isDuplicate)
                    .map((candidate) => candidate.id),
            ),
        );
    }, [candidates, isPartialRetryMode, myTodosQuery.data]);

    useEffect(() => {
        if (failureState) {
            alertRef.current?.focus();
        }
    }, [failureState]);

    const selectedCount = useMemo(
        () =>
            candidates.reduce(
                (count, candidate) =>
                    selectedIds.has(candidate.id) ? count + 1 : count,
                0,
            ),
        [candidates, selectedIds],
    );
    const allSelected =
        candidates.length > 0 && selectedCount === candidates.length;

    const handleToggleItem = (id: string) => {
        if (sendingRef.current || isSending) {
            return;
        }
        hasUserToggledRef.current = true;
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (sendingRef.current || isSending || candidates.length === 0) {
            return;
        }
        hasUserToggledRef.current = true;
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(candidates.map((candidate) => candidate.id)));
        }
    };

    const handleConfirmCopy = async () => {
        if (sendingRef.current || isSending || !isOnline) {
            return;
        }

        const selectedCandidates = candidates.filter((candidate) =>
            selectedIds.has(candidate.id),
        );
        if (selectedCandidates.length === 0) {
            return;
        }

        const payloadItems = buildCopyItems(selectedCandidates, selectedIds);
        const chunks = chunkCopyItems(payloadItems, TODO_COPY_BATCH_SIZE);
        if (chunks.length === 0) {
            return;
        }

        sendingRef.current = true;
        onSendingChange(true);
        setFailureState(null);
        setBatchProgress(
            chunks.length > 1 ? { current: 1, total: chunks.length } : null,
        );

        let copiedCount = 0;
        const totalCount = payloadItems.length;

        try {
            for (let index = 0; index < chunks.length; index += 1) {
                if (!mountedRef.current) {
                    return;
                }
                if (chunks.length > 1) {
                    setBatchProgress({
                        current: index + 1,
                        total: chunks.length,
                    });
                }
                await createTodosMutation.mutateAsync(chunks[index]);
                copiedCount += chunks[index].length;
            }

            if (!mountedRef.current) {
                return;
            }

            const summary = summarizeCopyResult({
                total: totalCount,
                copied: copiedCount,
            });
            sendingRef.current = false;
            onSendingChange(false);
            setBatchProgress(null);
            onSuccess(summary.message);
        } catch (error) {
            if (!mountedRef.current) {
                return;
            }

            const summary = summarizeCopyResult({
                total: totalCount,
                copied: copiedCount,
                error,
            });
            const isPartial = summary.status === "partial";
            const isUnconfirmed = summary.classification === "unconfirmed";

            if (isPartial) {
                const remainingCandidates =
                    selectedCandidates.slice(copiedCount);
                const remainingIdSet = new Set(
                    remainingCandidates.map((candidate) => candidate.id),
                );
                setActiveItems((current) =>
                    current.filter((item) => remainingIdSet.has(item.id)),
                );
                setSelectedIds(remainingIdSet);
                setIsPartialRetryMode(true);
            }

            setFailureState({
                summary,
                isPartial,
                isUnconfirmed,
            });
            sendingRef.current = false;
            onSendingChange(false);
            setBatchProgress(null);
        }
    };

    const isConfirmDisabled = isSending || !isOnline || selectedCount === 0;
    const isWarningAlert =
        failureState !== null &&
        (failureState.isPartial || failureState.isUnconfirmed);

    return (
        <>
            <DrawerHeader className="shrink-0 px-4 pt-3 pb-2 text-left">
                <DrawerTitle className="text-[17px] leading-snug font-bold text-text-main">
                    複製 {ownerName} 的待辦到我的清單
                </DrawerTitle>
                <DrawerDescription className="mt-1 text-[13px] leading-[1.45] text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                    {selectedCount > 0
                        ? `將新增 ${selectedCount} 項到我的清單，項目會以未完成狀態加入。`
                        : "請至少選取 1 個項目。"}
                </DrawerDescription>
            </DrawerHeader>

            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 pb-1.5">
                <button
                    type="button"
                    disabled={isSending || candidates.length === 0}
                    onClick={handleToggleSelectAll}
                    className="inline-flex min-h-11 -ml-2 items-center rounded-lg px-2 text-[13px] font-semibold whitespace-nowrap text-text-main underline decoration-primary/70 underline-offset-4 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:no-underline disabled:opacity-45 motion-reduce:transition-none"
                >
                    {allSelected ? "取消全選" : "全選"}
                </button>
                <span className="text-xs font-semibold tabular-nums text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                    已選 {selectedCount} / {candidates.length} 項
                </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <ul className="divide-y divide-border/75">
                    {candidates.map((candidate) => {
                        const isChecked = selectedIds.has(candidate.id);
                        return (
                            <li key={candidate.id}>
                                <label
                                    className={cn(
                                        "flex min-h-[52px] items-start gap-1 py-1 pr-3 pl-1.5 transition-colors motion-reduce:transition-none",
                                        isSending
                                            ? "cursor-not-allowed opacity-60"
                                            : "cursor-pointer hover:bg-background/60",
                                    )}
                                >
                                    <span className="grid size-11 shrink-0 place-items-center">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={isSending}
                                            aria-label={candidate.text}
                                            onChange={() =>
                                                handleToggleItem(candidate.id)
                                            }
                                            className="peer sr-only"
                                        />
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                "grid size-[22px] place-items-center rounded-[6px] border-2 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface motion-reduce:transition-none",
                                                isChecked
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-text-main/35 bg-surface forest:border-text-main/45",
                                            )}
                                        >
                                            {isChecked && (
                                                <Check className="size-3.5 stroke-[3]" />
                                            )}
                                        </span>
                                    </span>

                                    <span className="flex min-w-0 flex-1 flex-col gap-1 px-1 py-2.5">
                                        <span className="text-[15px] leading-[22px] text-text-main wrap-anywhere">
                                            {candidate.text}
                                        </span>
                                        {candidate.isDuplicate &&
                                            !isPartialRetryMode && (
                                                <span className="inline-flex self-start items-center rounded-md border border-amber-600/35 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 forest:border-amber-400/40 forest:bg-amber-950/60 forest:text-amber-200">
                                                    已在我的清單
                                                </span>
                                            )}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 border-t border-border bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                {isSending && (
                    <p
                        role="status"
                        className="flex items-center gap-2 text-xs font-medium text-text-main/62 forest:text-text-main/72"
                    >
                        <Loader2
                            aria-hidden="true"
                            className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
                        />
                        <span>正在複製 {selectedCount} 個項目到我的清單</span>
                    </p>
                )}

                {failureState && (
                    <div
                        ref={alertRef}
                        tabIndex={-1}
                        role="alert"
                        className={cn(
                            "flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-xs leading-5 focus:outline-none",
                            isWarningAlert
                                ? "border-amber-600/45 bg-amber-50 text-amber-950 forest:border-amber-400/45 forest:bg-amber-950/55 forest:text-amber-100"
                                : "border-red-600/45 bg-red-50 text-red-950 forest:border-red-400/45 forest:bg-red-950/55 forest:text-red-100",
                        )}
                    >
                        <div className="flex items-start gap-2 font-semibold">
                            {isWarningAlert ? (
                                <TriangleAlert
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0 text-amber-700 forest:text-amber-300"
                                />
                            ) : (
                                <CircleAlert
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0 text-red-600 forest:text-red-300"
                                />
                            )}
                            <span className="min-w-0 flex-1 wrap-anywhere">
                                {failureState.summary.message}
                            </span>
                        </div>
                        {failureState.summary.detail && (
                            <p className="pl-6 wrap-anywhere">
                                {failureState.summary.detail}
                            </p>
                        )}
                        {failureState.isUnconfirmed && onGoToMine && (
                            <div className="pl-6 pt-0.5">
                                <button
                                    type="button"
                                    disabled={isSending}
                                    onClick={onGoToMine}
                                    className="inline-flex min-h-11 -my-2 -ml-2 items-center rounded-lg px-2 text-xs font-semibold text-current underline underline-offset-4 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                                >
                                    前往我的清單確認
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {!isOnline && !isSending && !failureState && (
                    <p
                        role="status"
                        className="text-xs font-medium text-amber-900 forest:text-amber-200"
                    >
                        離線中，恢復連線後才能複製到我的清單
                    </p>
                )}

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        disabled={isSending}
                        onClick={onClose}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold whitespace-nowrap text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                    >
                        {isPartialRetryMode ? "關閉" : "取消"}
                    </button>
                    <button
                        type="button"
                        disabled={isConfirmDisabled}
                        onClick={() => {
                            void handleConfirmCopy();
                        }}
                        className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold whitespace-nowrap text-gray-950 transition-colors hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-text-main/45 disabled:opacity-100 disabled:active:scale-100 ocean:text-white motion-reduce:transition-none"
                    >
                        {isSending ? (
                            <>
                                <Loader2
                                    aria-hidden="true"
                                    className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                                />
                                <span>
                                    {batchProgress
                                        ? `複製中（第 ${batchProgress.current} / ${batchProgress.total} 批）…`
                                        : "複製中…"}
                                </span>
                            </>
                        ) : isPartialRetryMode ? (
                            <span>重試剩餘 {selectedCount} 項</span>
                        ) : (
                            <span>複製 {selectedCount} 項</span>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}

export function TodoCopyDrawer({
    open,
    onOpenChange,
    sheetId,
    myEmail,
    ownerName,
    sourceItems,
    isOnline,
    onSuccess,
    onGoToMine,
}: TodoCopyDrawerProps) {
    const [isSending, setIsSending] = useState(false);
    const isSendingRef = useRef(false);

    const handleSendingChange = useCallback((sending: boolean) => {
        isSendingRef.current = sending;
        setIsSending(sending);
    }, []);

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (!nextOpen && isSendingRef.current) {
                return;
            }
            if (!nextOpen) {
                isSendingRef.current = false;
                setIsSending(false);
            }
            onOpenChange(nextOpen);
        },
        [onOpenChange],
    );

    const handleClose = useCallback(() => {
        if (isSendingRef.current) {
            return;
        }
        onOpenChange(false);
    }, [onOpenChange]);

    return (
        <Drawer
            open={open}
            onOpenChange={handleOpenChange}
            dismissible={!isSending}
        >
            <DrawerContent
                aria-busy={isSending || undefined}
                onEscapeKeyDown={(event) => {
                    if (isSendingRef.current) {
                        event.preventDefault();
                    }
                }}
                onPointerDownOutside={(event) => {
                    if (isSendingRef.current) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    if (isSendingRef.current) {
                        event.preventDefault();
                    }
                }}
                className="flex max-h-[82dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface text-text-main data-[vaul-drawer-direction=bottom]:max-h-[82dvh]"
            >
                {open && (
                    <TodoCopyDrawerBody
                        sheetId={sheetId}
                        myEmail={myEmail}
                        ownerName={ownerName}
                        sourceItems={sourceItems}
                        isOnline={isOnline}
                        isSending={isSending}
                        onSendingChange={handleSendingChange}
                        onClose={handleClose}
                        onSuccess={onSuccess}
                        onGoToMine={onGoToMine}
                    />
                )}
            </DrawerContent>
        </Drawer>
    );
}
