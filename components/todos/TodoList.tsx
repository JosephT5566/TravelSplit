"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/src/hooks/useOnlineStatus";
import { useTodoView } from "@/src/hooks/useTodoView";
import type { TodoItem } from "@/src/types";
import {
    getCompletionStats,
    getTodoCategories,
    groupTodosByCategory,
    isForbiddenError,
    normalizeTodoCategory,
    sortTodos,
    type TodoCompletionStats,
} from "@/src/utils/todoList";
import type { TodoOutboxPatch } from "@/src/utils/todoOutbox";
import { TodoAddRow } from "./TodoAddRow";
import { TodoExportButton } from "./TodoExportButton";
import { TodoRow, type TodoRowEditUpdates } from "./TodoRow";
import {
    TodoEmptyState,
    TodoLoadErrorState,
    TodoLoadingSkeleton,
    TodoOfflineBanner,
    TodoOfflineNoCacheState,
    TodoReadOnlyBanner,
} from "./TodoStates";

export type ReadOnlyTopActionContext = {
    items: TodoItem[];
    isOnline: boolean;
};

export interface TodoListProps {
    sheetId: string;
    ownerEmail: string;
    canEdit: boolean;
    ownerName?: string;
    headerActions?: React.ReactNode;
    memberBar?: React.ReactNode;
    readOnlyTopAction?:
        | React.ReactNode
        | ((context: ReadOnlyTopActionContext) => React.ReactNode);
    onBackToMine?: () => void;
}

type ActiveRowAction = {
    id: string;
    mode: "edit" | "delete";
} | null;

type PendingFocus =
    | {
          target: "text" | "delete";
          id: string;
          expectedCategory?: string;
          waitUntilAbsentId?: string;
      }
    | { target: "add"; waitUntilAbsentId?: string }
    | null;

interface TodoListCardProps {
    canEdit: boolean;
    ownerName?: string;
    isOnline: boolean;
    offlineBannerId: string;
    hasData: boolean;
    sortedTodos: TodoItem[];
    stats: TodoCompletionStats;
    isOfflineNoCache: boolean;
    isInitialLoading: boolean;
    isError: boolean;
    error: unknown;
    isFetching: boolean;
    onRetry: () => void;
    onCreate: (text: string, category?: string) => Promise<unknown>;
    onUpdate: (id: string, patch: TodoOutboxPatch) => Promise<unknown>;
    onRemove: (id: string) => Promise<unknown>;
    readOnlyTopAction?:
        | React.ReactNode
        | ((context: ReadOnlyTopActionContext) => React.ReactNode);
    onBackToMine?: () => void;
}

function TodoListCard({
    canEdit,
    ownerName,
    isOnline,
    offlineBannerId,
    hasData,
    sortedTodos,
    stats,
    isOfflineNoCache,
    isInitialLoading,
    isError,
    error,
    isFetching,
    onRetry,
    onCreate,
    onUpdate,
    onRemove,
    readOnlyTopAction,
    onBackToMine,
}: TodoListCardProps) {
    const showToast = useToast();
    const groupIdPrefix = useId();

    const [activeRowAction, setActiveRowAction] =
        useState<ActiveRowAction>(null);
    const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
        () => new Set(),
    );

    const activeRowActionRef = useRef<ActiveRowAction>(null);
    const addInputRef = useRef<HTMLInputElement>(null);
    const textButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const deleteButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    const groups = useMemo(
        () => groupTodosByCategory(sortedTodos),
        [sortedTodos],
    );
    const showGroupHeaders = groups.some((group) => group.showHeader);
    const existingCategories = useMemo(
        () => (canEdit ? getTodoCategories(sortedTodos) : []),
        [canEdit, sortedTodos],
    );

    const updateActiveRowAction = useCallback(
        (
            next:
                | ActiveRowAction
                | ((current: ActiveRowAction) => ActiveRowAction),
        ) => {
            const value =
                typeof next === "function"
                    ? next(activeRowActionRef.current)
                    : next;
            activeRowActionRef.current = value;
            setActiveRowAction(value);
        },
        [],
    );

    // True when keyboard focus can safely be restored for a settled action:
    // the user has not moved on to a different row in the meantime.
    const canRestoreFocusFor = (id: string) =>
        activeRowActionRef.current === null ||
        activeRowActionRef.current.id === id;

    useEffect(() => {
        if (!pendingFocus) return;

        if (
            pendingFocus.waitUntilAbsentId &&
            sortedTodos.some((item) => item.id === pendingFocus.waitUntilAbsentId)
        ) {
            return;
        }

        if (
            pendingFocus.target !== "add" &&
            pendingFocus.expectedCategory !== undefined
        ) {
            const focusedItem = sortedTodos.find(
                (item) => item.id === pendingFocus.id,
            );
            if (
                !focusedItem ||
                normalizeTodoCategory(focusedItem.category) !==
                    pendingFocus.expectedCategory
            ) {
                return;
            }
        }

        const target =
            pendingFocus.target === "add"
                ? null
                : pendingFocus.target === "text"
                  ? textButtonRefs.current.get(pendingFocus.id)
                  : deleteButtonRefs.current.get(pendingFocus.id);
        if (pendingFocus.target !== "add" && !target) {
            return;
        }
        const focusTarget = target ?? addInputRef.current;
        focusTarget?.focus();
        if (target) {
            target.scrollIntoView({ block: "nearest" });
        }
        setPendingFocus(null);
    }, [pendingFocus, sortedTodos, collapsedGroups, showGroupHeaders]);

    const setTextButtonRef = useCallback(
        (id: string, node: HTMLButtonElement | null) => {
            if (node) {
                textButtonRefs.current.set(id, node);
            } else {
                textButtonRefs.current.delete(id);
            }
        },
        [],
    );

    const setDeleteButtonRef = useCallback(
        (id: string, node: HTMLButtonElement | null) => {
            if (node) {
                deleteButtonRefs.current.set(id, node);
            } else {
                deleteButtonRefs.current.delete(id);
            }
        },
        [],
    );

    const expandGroup = useCallback((groupKey: string) => {
        setCollapsedGroups((current) => {
            if (!current.has(groupKey)) {
                return current;
            }
            const next = new Set(current);
            next.delete(groupKey);
            return next;
        });
    }, []);

    const handleToggleGroup = useCallback(
        (groupKey: string) => {
            const willCollapse = !collapsedGroups.has(groupKey);
            if (willCollapse && activeRowActionRef.current) {
                const activeId = activeRowActionRef.current.id;
                const activeItem = sortedTodos.find(
                    (candidate) => candidate.id === activeId,
                );
                if (
                    activeItem &&
                    normalizeTodoCategory(activeItem.category) === groupKey
                ) {
                    updateActiveRowAction(null);
                }
            }
            setCollapsedGroups((current) => {
                const next = new Set(current);
                if (next.has(groupKey)) {
                    next.delete(groupKey);
                } else {
                    next.add(groupKey);
                }
                return next;
            });
        },
        [collapsedGroups, sortedTodos, updateActiveRowAction],
    );

    useEffect(() => {
        setCollapsedGroups((current) => {
            if (!showGroupHeaders) {
                return current.size === 0 ? current : new Set();
            }
            const validKeys = new Set(groups.map((group) => group.key));
            let changed = false;
            const next = new Set<string>();
            for (const key of current) {
                if (validKeys.has(key)) {
                    next.add(key);
                } else {
                    changed = true;
                }
            }
            return changed ? next : current;
        });
    }, [groups, showGroupHeaders]);

    const handleAdd = useCallback(
        async (text: string, category: string): Promise<boolean> => {
            if (!canEdit) return false;
            const normalizedCategory = normalizeTodoCategory(category);
            if (!normalizedCategory) return false;
            await onCreate(text, normalizedCategory);
            expandGroup(normalizedCategory);
            showToast({ kind: "success", message: "已新增待辦" });
            return true;
        },
        [canEdit, expandGroup, onCreate, showToast],
    );

    const handleToggleCheck = useCallback(
        (item: TodoItem) => {
            if (!canEdit) {
                return;
            }
            void onUpdate(item.id, { checked: !item.checked });
        },
        [canEdit, onUpdate],
    );

    const handleStartEdit = useCallback(
        (item: TodoItem) => {
            if (!canEdit) {
                return;
            }
            updateActiveRowAction({ id: item.id, mode: "edit" });
        },
        [canEdit, updateActiveRowAction],
    );

    const handleCancelEdit = useCallback(
        (id: string) => {
            updateActiveRowAction((current) =>
                current?.id === id && current.mode === "edit" ? null : current,
            );
            setPendingFocus({ target: "text", id });
        },
        [updateActiveRowAction],
    );

    const handleSaveEdit = useCallback(
        async (
            id: string,
            updates: TodoRowEditUpdates,
        ): Promise<string | null> => {
            if (!canEdit) {
                return null;
            }
            await onUpdate(id, updates);
            const savedCategory =
                updates.category !== undefined
                    ? normalizeTodoCategory(updates.category)
                    : undefined;
            if (savedCategory !== undefined) {
                expandGroup(savedCategory);
            }
            const restoreFocus = canRestoreFocusFor(id);
            updateActiveRowAction((current) =>
                current?.id === id && current.mode === "edit" ? null : current,
            );
            if (restoreFocus) {
                setPendingFocus({
                    target: "text",
                    id,
                    ...(savedCategory !== undefined
                        ? { expectedCategory: savedCategory }
                        : {}),
                });
            }
            return null;
        },
        [canEdit, expandGroup, onUpdate, updateActiveRowAction],
    );

    const handleStartDelete = useCallback(
        (item: TodoItem) => {
            if (!canEdit) {
                return;
            }
            updateActiveRowAction({ id: item.id, mode: "delete" });
        },
        [canEdit, updateActiveRowAction],
    );

    const handleCancelDelete = useCallback(
        (id: string) => {
            updateActiveRowAction((current) =>
                current?.id === id && current.mode === "delete"
                    ? null
                    : current,
            );
            setPendingFocus({ target: "delete", id });
        },
        [updateActiveRowAction],
    );

    const handleConfirmDelete = useCallback(
        async (item: TodoItem) => {
            if (!canEdit) {
                return;
            }
            const visibleItems = groups.flatMap((group) =>
                showGroupHeaders && collapsedGroups.has(group.key)
                    ? []
                    : group.items,
            );
            const currentIndex = visibleItems.findIndex(
                (candidate) => candidate.id === item.id,
            );
            const nextItem =
                currentIndex >= 0 ? visibleItems[currentIndex + 1] : undefined;
            const prevItem =
                currentIndex > 0 ? visibleItems[currentIndex - 1] : undefined;

            const focusAfterRowGone = (): Exclude<PendingFocus, null> =>
                nextItem
                    ? { target: "text", id: nextItem.id }
                    : prevItem
                      ? { target: "text", id: prevItem.id }
                      : { target: "add" };

            await onRemove(item.id);
            const restoreFocus = canRestoreFocusFor(item.id);
            updateActiveRowAction((current) =>
                current?.id === item.id ? null : current,
            );
            showToast({ kind: "success", message: "已刪除待辦" });
            if (restoreFocus) {
                setPendingFocus({
                    ...focusAfterRowGone(),
                    waitUntilAbsentId: item.id,
                });
            }
        },
        [
            canEdit,
            collapsedGroups,
            groups,
            onRemove,
            showGroupHeaders,
            showToast,
            updateActiveRowAction,
        ],
    );

    const renderedReadOnlyTopAction =
        !canEdit && hasData && sortedTodos.length > 0 && readOnlyTopAction
            ? typeof readOnlyTopAction === "function"
                ? readOnlyTopAction({ items: sortedTodos, isOnline })
                : readOnlyTopAction
            : null;

    const renderTodoRow = (item: TodoItem) => {
        const mode =
            activeRowAction?.id === item.id ? activeRowAction.mode : "normal";

        return (
            <TodoRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                mode={mode}
                existingCategories={existingCategories}
                setTextButtonRef={setTextButtonRef}
                setDeleteButtonRef={setDeleteButtonRef}
                onToggleCheck={handleToggleCheck}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                onStartDelete={handleStartDelete}
                onCancelDelete={handleCancelDelete}
                onConfirmDelete={handleConfirmDelete}
            />
        );
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            {hasData && stats.total > 0 && (
                <div
                    role="progressbar"
                    aria-label="待辦完成進度"
                    aria-valuenow={stats.completed}
                    aria-valuemin={0}
                    aria-valuemax={stats.total}
                    className="h-1 w-full bg-border/60"
                >
                    <div
                        className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
                        style={{ width: `${stats.percent}%` }}
                    />
                </div>
            )}

            {hasData ? (
                <>
                    {canEdit ? (
                        <TodoAddRow
                            existingCategories={existingCategories}
                            inputRef={addInputRef}
                            onAdd={handleAdd}
                        />
                    ) : (
                        renderedReadOnlyTopAction
                    )}

                    {sortedTodos.length === 0 ? (
                        <TodoEmptyState
                            ownerName={ownerName}
                            readOnly={!canEdit}
                        />
                    ) : (
                        <>
                            {showGroupHeaders ? (
                                <div>
                                    {groups.map((group, groupIndex) => {
                                        const isCollapsed = collapsedGroups.has(
                                            group.key,
                                        );
                                        const panelId = `${groupIdPrefix}-group-${groupIndex}`;
                                        const isGroupDone =
                                            group.total > 0 &&
                                            group.completed === group.total;

                                        return (
                                            <div
                                                key={
                                                    group.isUncategorized
                                                        ? "uncategorized"
                                                        : `category:${group.key}`
                                                }
                                                className="border-t border-border first:border-t-0"
                                            >
                                                <h3 className="m-0">
                                                    <button
                                                        type="button"
                                                        aria-expanded={
                                                            !isCollapsed
                                                        }
                                                        aria-controls={panelId}
                                                        onClick={() =>
                                                            handleToggleGroup(
                                                                group.key,
                                                            )
                                                        }
                                                        className={cn(
                                                            "flex min-h-11 w-full items-center justify-between gap-2 bg-background/75 px-3.5 py-2 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none",
                                                            !isCollapsed &&
                                                                "border-b border-border/75",
                                                        )}
                                                    >
                                                        <span className="flex min-w-0 flex-1 items-center gap-2">
                                                            <ChevronDown
                                                                aria-hidden="true"
                                                                className={cn(
                                                                    "size-4 shrink-0 text-text-main/62 transition-transform duration-150 forest:text-text-main/72 ocean:text-text-main/68 motion-reduce:transition-none",
                                                                    isCollapsed &&
                                                                        "-rotate-90",
                                                                )}
                                                            />
                                                            <span
                                                                className={cn(
                                                                    "min-w-0 wrap-anywhere text-[13px] leading-[18px]",
                                                                    group.isUncategorized
                                                                        ? "font-semibold text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68"
                                                                        : "font-bold text-text-main",
                                                                )}
                                                            >
                                                                {group.label}
                                                            </span>
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "shrink-0 text-xs font-semibold tabular-nums",
                                                                isGroupDone
                                                                    ? "text-primary"
                                                                    : "text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68",
                                                            )}
                                                        >
                                                            {group.completed}/
                                                            {group.total}
                                                        </span>
                                                    </button>
                                                </h3>

                                                <ul
                                                    id={panelId}
                                                    hidden={isCollapsed}
                                                    className="divide-y divide-border/75"
                                                >
                                                    {group.items.map(
                                                        renderTodoRow,
                                                    )}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <ul className="divide-y divide-border/75">
                                    {sortedTodos.map(renderTodoRow)}
                                </ul>
                            )}

                            {canEdit && (
                                <p className="flex items-center gap-1.5 border-t border-border/60 bg-background/40 px-4 py-2 text-[11px] text-text-main/55 forest:text-text-main/68 ocean:text-text-main/65">
                                    <Pencil
                                        aria-hidden="true"
                                        className="size-3 shrink-0"
                                    />
                                    <span>
                                        {showGroupHeaders
                                            ? "點項目文字即可編輯內容與分類"
                                            : "點項目文字即可編輯"}
                                    </span>
                                </p>
                            )}
                        </>
                    )}
                </>
            ) : isOfflineNoCache ? (
                <TodoOfflineNoCacheState
                    ownerName={ownerName}
                    readOnly={!canEdit}
                />
            ) : isInitialLoading ? (
                <TodoLoadingSkeleton
                    readOnly={!canEdit}
                    ownerName={ownerName}
                />
            ) : isError ? (
                <TodoLoadErrorState
                    error={error}
                    isOnline={isOnline}
                    isRetrying={isFetching}
                    offlineBannerId={offlineBannerId}
                    ownerName={ownerName}
                    readOnly={!canEdit}
                    onBackToMine={onBackToMine}
                    onRetry={onRetry}
                />
            ) : null}
        </div>
    );
}

export function TodoList({
    sheetId,
    ownerEmail,
    canEdit,
    ownerName,
    headerActions,
    memberBar,
    readOnlyTopAction,
    onBackToMine,
}: TodoListProps) {
    const isOnline = useOnlineStatus();
    const offlineBannerId = useId();

    const todoView = useTodoView(sheetId, ownerEmail, { readOnly: !canEdit });

    const sortedTodos = useMemo(
        () => (todoView.items ? sortTodos(todoView.items) : []),
        [todoView.items],
    );

    const hasData = todoView.items !== undefined;
    const stats = useMemo(
        () => getCompletionStats(sortedTodos),
        [sortedTodos],
    );

    const isOfflineNoCache =
        !hasData &&
        todoView.status === "pending" &&
        (todoView.fetchStatus === "paused" || !isOnline);
    const isInitialLoading =
        !hasData &&
        todoView.status === "pending" &&
        todoView.fetchStatus !== "paused" &&
        isOnline;
    const showReadOnlyBanner =
        !canEdit &&
        Boolean(ownerName) &&
        !(todoView.isError && isForbiddenError(todoView.error));

    return (
        <section
            aria-labelledby="todos-heading"
            className="flex min-w-0 flex-col gap-2.5"
        >
            <div className="flex items-center justify-between gap-2 min-[360px]:gap-3">
                <div className="min-w-0 flex-1">
                    <h2
                        id="todos-heading"
                        className="text-xl font-bold text-text-main"
                    >
                        待辦清單
                    </h2>
                    {hasData && (
                        <p className="mt-0.5 text-xs font-medium tabular-nums text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                            已完成 {stats.completed} / 全部 {stats.total}
                        </p>
                    )}
                </div>

                <div
                    data-slot="todo-header-actions"
                    className="flex min-h-7 shrink-0 items-center gap-1.5"
                >
                    {hasData && sortedTodos.length > 0 && (
                        <TodoExportButton
                            key={JSON.stringify([sheetId, ownerEmail])}
                            items={sortedTodos}
                            ownerDisplayName={ownerName?.trim() || "我"}
                        />
                    )}
                    {headerActions}
                </div>
            </div>

            {memberBar}

            {showReadOnlyBanner && ownerName && (
                <TodoReadOnlyBanner
                    ownerName={ownerName}
                    onBackToMine={onBackToMine}
                />
            )}

            {!isOnline && (
                <TodoOfflineBanner id={offlineBannerId} readOnly={!canEdit} />
            )}

            <TodoListCard
                key={JSON.stringify([sheetId, ownerEmail, canEdit])}
                canEdit={canEdit}
                ownerName={ownerName}
                isOnline={isOnline}
                offlineBannerId={offlineBannerId}
                hasData={hasData}
                sortedTodos={sortedTodos}
                stats={stats}
                isOfflineNoCache={isOfflineNoCache}
                isInitialLoading={isInitialLoading}
                isError={todoView.isError}
                error={todoView.error}
                isFetching={todoView.isFetching}
                onCreate={todoView.create}
                onUpdate={todoView.update}
                onRemove={todoView.remove}
                readOnlyTopAction={readOnlyTopAction}
                onBackToMine={onBackToMine}
                onRetry={() => {
                    if (!isOnline) {
                        return;
                    }
                    void todoView.refetch();
                }}
            />
        </section>
    );
}
