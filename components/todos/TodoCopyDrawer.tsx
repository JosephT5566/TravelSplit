"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useTodoView } from "@/src/hooks/useTodoView";
import type { TodoItem } from "@/src/types";
import {
    buildCopyCandidates,
    buildCopyItems,
    groupCopyCandidatesByCategory,
    summarizeCopyResult,
    toggleGroupSelection,
    type TodoCopyCandidate,
} from "@/src/utils/todoCopy";
import { sortTodos } from "@/src/utils/todoList";

export interface TodoCopyDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sheetId: string;
    myEmail: string;
    ownerName: string;
    sourceItems: readonly TodoItem[];
    isOnline?: boolean;
    onSuccess: (message: string) => void;
    onCloseAutoFocus?: (event: Event) => void;
    onGoToMine?: () => void;
}

interface TodoCopyDrawerBodyProps {
    sheetId: string;
    myEmail: string;
    ownerName: string;
    sourceItems: readonly TodoItem[];
    onClose: () => void;
    onSuccess: (message: string) => void;
}

function TodoCopyDrawerBody({
    sheetId,
    myEmail,
    ownerName,
    sourceItems,
    onClose,
    onSuccess,
}: TodoCopyDrawerBodyProps) {
    const myTodoView = useTodoView(sheetId, myEmail);
    const groupHeadingPrefix = useId();

    const activeItems = useMemo(() => sortTodos(sourceItems), [sourceItems]);

    const candidates = useMemo(
        () => buildCopyCandidates(activeItems, myTodoView.items),
        [activeItems, myTodoView.items],
    );
    const candidateGroups = useMemo(
        () => groupCopyCandidatesByCategory(candidates),
        [candidates],
    );
    const hasCategoryHeaders = candidateGroups.some(
        (group) => group.showHeader,
    );

    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
        const initialCandidates = buildCopyCandidates(
            sortTodos(sourceItems),
            myTodoView.items,
        );
        return new Set(
            initialCandidates
                .filter((candidate) => !candidate.isDuplicate)
                .map((candidate) => candidate.id),
        );
    });

    const submittingRef = useRef(false);
    const hasAppliedInitialDuplicatesRef = useRef(
        myTodoView.items !== undefined,
    );
    const hasUserToggledRef = useRef(false);

    // If myTodos arrives asynchronously before the user makes manual edits,
    // automatically uncheck newly detected duplicates once.
    useEffect(() => {
        if (
            myTodoView.items === undefined ||
            hasAppliedInitialDuplicatesRef.current ||
            hasUserToggledRef.current ||
            submittingRef.current
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
    }, [candidates, myTodoView.items]);

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
        if (submittingRef.current) {
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

    const handleToggleGroup = (groupItemIds: readonly string[]) => {
        if (submittingRef.current || groupItemIds.length === 0) {
            return;
        }
        hasUserToggledRef.current = true;
        setSelectedIds((current) =>
            toggleGroupSelection(current, groupItemIds),
        );
    };

    const handleToggleSelectAll = () => {
        if (submittingRef.current || candidates.length === 0) {
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
        if (submittingRef.current) {
            return;
        }
        const selectedCandidates = candidates.filter((candidate) =>
            selectedIds.has(candidate.id),
        );
        if (selectedCandidates.length === 0) {
            return;
        }
        const payloadItems = buildCopyItems(selectedCandidates, selectedIds);
        if (payloadItems.length === 0) {
            return;
        }

        submittingRef.current = true;
        hasUserToggledRef.current = true;
        try {
            await myTodoView.createMany(payloadItems);
            const summary = summarizeCopyResult({
                total: payloadItems.length,
                copied: payloadItems.length,
            });
            onSuccess(summary.message);
        } finally {
            submittingRef.current = false;
        }
    };

    const isConfirmDisabled = selectedCount === 0;

    const renderCandidateRow = (candidate: TodoCopyCandidate) => {
        const isChecked = selectedIds.has(candidate.id);
        return (
            <li key={candidate.id}>
                <label className="flex min-h-[52px] cursor-pointer items-start gap-1 py-1 pr-3 pl-1.5 transition-colors hover:bg-background/60 motion-reduce:transition-none">
                    <span className="grid size-11 shrink-0 place-items-center">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleItem(candidate.id)}
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
                        {candidate.isDuplicate && (
                            <span className="inline-flex self-start items-center rounded-md border border-amber-600/35 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 forest:border-amber-400/40 forest:bg-amber-950/60 forest:text-amber-200">
                                已在我的清單
                            </span>
                        )}
                    </span>
                </label>
            </li>
        );
    };

    return (
        <>
            <DrawerHeader className="shrink-0 px-4 pt-3 pb-2 text-left">
                <DrawerTitle className="text-[17px] leading-snug font-bold text-text-main">
                    複製 {ownerName} 的待辦到我的清單
                </DrawerTitle>
                <DrawerDescription className="mt-1 text-[13px] leading-[1.45] text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                    {selectedCount > 0
                        ? hasCategoryHeaders
                            ? `將新增 ${selectedCount} 項到我的清單，項目會以未完成狀態加入並保留分類。`
                            : `將新增 ${selectedCount} 項到我的清單，項目會以未完成狀態加入。`
                        : "請至少選取 1 個項目。"}
                </DrawerDescription>
            </DrawerHeader>

            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 pb-1.5">
                <button
                    type="button"
                    disabled={candidates.length === 0}
                    onClick={handleToggleSelectAll}
                    className="inline-flex min-h-11 min-w-11 -ml-2 items-center justify-center rounded-lg px-2 text-[13px] font-semibold whitespace-nowrap text-text-main underline decoration-primary/70 underline-offset-4 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:no-underline disabled:opacity-45 motion-reduce:transition-none"
                >
                    {allSelected ? "取消全選" : "全選"}
                </button>
                <span className="text-xs font-semibold tabular-nums text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                    已選 {selectedCount} / {candidates.length} 項
                </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {hasCategoryHeaders ? (
                    <div>
                        {candidateGroups.map((group, groupIndex) => {
                            const headingId = `${groupHeadingPrefix}-group-${groupIndex}`;
                            const groupItemIds = group.items.map(
                                (item) => item.id,
                            );
                            const groupSelectedCount = group.items.reduce(
                                (count, item) =>
                                    selectedIds.has(item.id)
                                        ? count + 1
                                        : count,
                                0,
                            );
                            const allGroupSelected =
                                group.items.length > 0 &&
                                groupSelectedCount === group.items.length;

                            const representative = group.items[0];
                            const categoryHint =
                                !group.isUncategorized &&
                                myTodoView.items !== undefined &&
                                representative
                                    ? representative.categoryMatchKind ===
                                      "merged"
                                        ? `併入我的「${representative.category}」`
                                        : representative.categoryMatchKind ===
                                            "new"
                                          ? "新分類"
                                          : null
                                    : null;

                            return (
                                <section
                                    key={
                                        group.isUncategorized
                                            ? "uncategorized"
                                            : `category:${group.key}`
                                    }
                                    aria-labelledby={headingId}
                                    className="border-t border-border first:border-t-0"
                                >
                                    <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border/75 bg-background/75 pr-2.5 pl-4">
                                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 py-2">
                                            <h3
                                                id={headingId}
                                                className={cn(
                                                    "text-[13px] leading-[18px] wrap-anywhere",
                                                    group.isUncategorized
                                                        ? "font-semibold text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68"
                                                        : "font-bold text-text-main",
                                                )}
                                            >
                                                {group.label}
                                            </h3>
                                            {categoryHint && (
                                                <span className="text-[11px] leading-4 font-medium wrap-anywhere text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                                                    {categoryHint}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1">
                                            <span className="text-[11px] leading-4 font-semibold whitespace-nowrap tabular-nums text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                                                已選 {groupSelectedCount} /{" "}
                                                {group.total}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={`${
                                                    allGroupSelected
                                                        ? "取消全選"
                                                        : "全選"
                                                }「${group.label}」`}
                                                onClick={() =>
                                                    handleToggleGroup(
                                                        groupItemIds,
                                                    )
                                                }
                                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-1.5 text-xs font-semibold whitespace-nowrap text-text-main underline decoration-primary/70 underline-offset-4 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                                            >
                                                {allGroupSelected
                                                    ? "取消全選"
                                                    : "全選"}
                                            </button>
                                        </div>
                                    </div>

                                    <ul className="divide-y divide-border/75">
                                        {group.items.map(renderCandidateRow)}
                                    </ul>
                                </section>
                            );
                        })}
                    </div>
                ) : (
                    <ul className="divide-y divide-border/75">
                        {candidates.map(renderCandidateRow)}
                    </ul>
                )}

                {candidates.length > 0 && (
                    <p className="border-t border-border/75 px-4 py-3 text-center text-xs leading-[18px] text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                        複製後與對方的清單互不影響
                    </p>
                )}
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 border-t border-border bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold whitespace-nowrap text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        disabled={isConfirmDisabled}
                        onClick={() => {
                            void handleConfirmCopy();
                        }}
                        className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold whitespace-nowrap text-gray-950 transition-colors hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-text-main/45 disabled:opacity-100 disabled:active:scale-100 ocean:text-white motion-reduce:transition-none"
                    >
                        <span>複製 {selectedCount} 項</span>
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
    onSuccess,
    onCloseAutoFocus,
}: TodoCopyDrawerProps) {
    // A fresh body session per open, so state never leaks into a re-open that
    // happens while the previous close animation is still running.
    const [wasOpen, setWasOpen] = useState(open);
    const [sessionId, setSessionId] = useState(0);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setSessionId((id) => id + 1);
        }
    }

    const handleClose = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    return (
        <Drawer open={open} onOpenChange={onOpenChange} autoFocus>
            <DrawerContent
                onCloseAutoFocus={onCloseAutoFocus}
                className="flex max-h-[82dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface text-text-main data-[vaul-drawer-direction=bottom]:max-h-[82dvh]"
            >
                <TodoCopyDrawerBody
                    key={sessionId}
                    sheetId={sheetId}
                    myEmail={myEmail}
                    ownerName={ownerName}
                    sourceItems={sourceItems}
                    onClose={handleClose}
                    onSuccess={onSuccess}
                />
            </DrawerContent>
        </Drawer>
    );
}
