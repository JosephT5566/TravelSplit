"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
    useCreateTodos,
    useDeleteTodo,
    useTodosQuery,
    useUpdateTodo,
} from "@/services/dataFetcher";
import { getTodosQueryKey } from "@/services/todoCache";
import { useOnlineStatus } from "@/src/hooks/useOnlineStatus";
import type { TodoItem } from "@/src/types";
import {
    getCompletionStats,
    getTodoErrorMessage,
    isNotFoundError,
    isOfflineError,
    sortTodos,
    type TodoAction,
} from "@/src/utils/todoList";
import { TodoAddRow } from "./TodoAddRow";
import { TodoRow } from "./TodoRow";
import {
    TodoEmptyState,
    TodoLoadErrorState,
    TodoLoadingSkeleton,
    TodoOfflineBanner,
    TodoOfflineNoCacheState,
} from "./TodoStates";

export interface TodoListProps {
    sheetId: string;
    ownerEmail: string;
    canEdit: boolean;
    headerActions?: React.ReactNode;
}

type ActiveRowAction = {
    id: string;
    mode: "edit" | "delete";
} | null;

type PendingFocus =
    | { target: "text" | "delete"; id: string }
    | { target: "add" }
    | null;

export function TodoList({
    sheetId,
    ownerEmail,
    canEdit,
    headerActions,
}: TodoListProps) {
    const isOnline = useOnlineStatus();
    const showToast = useToast();
    const queryClient = useQueryClient();
    const offlineBannerId = useId();

    const todosQuery = useTodosQuery(sheetId, ownerEmail);
    const createTodosMutation = useCreateTodos(sheetId, ownerEmail);
    const updateTodoMutation = useUpdateTodo(sheetId, ownerEmail);
    const deleteTodoMutation = useDeleteTodo(sheetId, ownerEmail);

    const [activeRowAction, setActiveRowAction] =
        useState<ActiveRowAction>(null);
    const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
    const [isAdding, setIsAdding] = useState(false);
    const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);

    const activeRowActionRef = useRef<ActiveRowAction>(null);
    const pendingIdsRef = useRef<Set<string>>(new Set());
    const addInputRef = useRef<HTMLInputElement>(null);
    const textButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const deleteButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

    // True when keyboard focus can safely be restored for a settled request:
    // the user has not moved on to a different row in the meantime.
    const canRestoreFocusFor = (id: string) =>
        activeRowActionRef.current === null ||
        activeRowActionRef.current.id === id;

    // A row whose save/delete is in flight must stay mounted so that a failure
    // can keep its draft and inline error.
    const isActiveRowBusy = () =>
        activeRowActionRef.current !== null &&
        pendingIdsRef.current.has(activeRowActionRef.current.id);

    useEffect(() => {
        if (!pendingFocus) return;
        const target =
            pendingFocus.target === "add"
                ? null
                : pendingFocus.target === "text"
                  ? textButtonRefs.current.get(pendingFocus.id)
                  : deleteButtonRefs.current.get(pendingFocus.id);
        (target ?? addInputRef.current)?.focus();
        setPendingFocus(null);
    }, [pendingFocus]);

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

    const startRowPending = useCallback((id: string) => {
        if (pendingIdsRef.current.has(id)) {
            return false;
        }
        pendingIdsRef.current.add(id);
        setPendingIds(new Set(pendingIdsRef.current));
        return true;
    }, []);

    const endRowPending = useCallback((id: string) => {
        pendingIdsRef.current.delete(id);
        setPendingIds(new Set(pendingIdsRef.current));
    }, []);

    const notifyWriteError = useCallback(
        (error: unknown, action: Exclude<TodoAction, "load">) => {
            const message = getTodoErrorMessage(error, action);
            showToast({
                kind: isOfflineError(error) ? "warning" : "error",
                message,
            });
            if (isNotFoundError(error)) {
                // The mutation's own onError may already have started a refetch.
                void queryClient.invalidateQueries(
                    {
                        queryKey: getTodosQueryKey(sheetId, ownerEmail),
                        exact: true,
                    },
                    { cancelRefetch: false },
                );
            }
            return message;
        },
        [ownerEmail, queryClient, sheetId, showToast],
    );

    const sortedTodos = useMemo(
        () => (todosQuery.data ? sortTodos(todosQuery.data) : []),
        [todosQuery.data],
    );

    const hasData = todosQuery.data !== undefined;
    const stats = useMemo(
        () => getCompletionStats(sortedTodos),
        [sortedTodos],
    );

    const handleAdd = useCallback(
        async (text: string): Promise<boolean> => {
            if (!canEdit) return false;
            setIsAdding(true);
            try {
                await createTodosMutation.mutateAsync([{ text }]);
                showToast({ kind: "success", message: "已新增待辦" });
                return true;
            } catch (error) {
                notifyWriteError(error, "create");
                return false;
            } finally {
                setIsAdding(false);
            }
        },
        [canEdit, createTodosMutation, notifyWriteError, showToast],
    );

    const handleToggleCheck = useCallback(
        async (item: TodoItem) => {
            if (!canEdit || !isOnline || !startRowPending(item.id)) {
                return;
            }
            try {
                await updateTodoMutation.mutateAsync({
                    id: item.id,
                    checked: !item.checked,
                });
            } catch (error) {
                notifyWriteError(error, "update");
            } finally {
                endRowPending(item.id);
            }
        },
        [
            canEdit,
            endRowPending,
            isOnline,
            notifyWriteError,
            startRowPending,
            updateTodoMutation,
        ],
    );

    const handleStartEdit = useCallback(
        (item: TodoItem) => {
            if (!canEdit || !isOnline || pendingIdsRef.current.has(item.id)) {
                return;
            }
            if (isActiveRowBusy() && activeRowActionRef.current?.id !== item.id) {
                return;
            }
            updateActiveRowAction({ id: item.id, mode: "edit" });
        },
        [canEdit, isOnline],
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
        async (id: string, text: string): Promise<string | null> => {
            if (!canEdit || !startRowPending(id)) {
                return null;
            }
            try {
                await updateTodoMutation.mutateAsync({ id, text });
                const restoreFocus = canRestoreFocusFor(id);
                updateActiveRowAction((current) =>
                    current?.id === id && current.mode === "edit"
                        ? null
                        : current,
                );
                if (restoreFocus) {
                    setPendingFocus({ target: "text", id });
                }
                return null;
            } catch (error) {
                return notifyWriteError(error, "update");
            } finally {
                endRowPending(id);
            }
        },
        [
            canEdit,
            endRowPending,
            notifyWriteError,
            startRowPending,
            updateActiveRowAction,
            updateTodoMutation,
        ],
    );

    const handleStartDelete = useCallback(
        (item: TodoItem) => {
            if (!canEdit || !isOnline || pendingIdsRef.current.has(item.id)) {
                return;
            }
            if (isActiveRowBusy() && activeRowActionRef.current?.id !== item.id) {
                return;
            }
            updateActiveRowAction({ id: item.id, mode: "delete" });
        },
        [canEdit, isOnline],
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
            if (!canEdit || !startRowPending(item.id)) {
                return;
            }
            const currentIndex = sortedTodos.findIndex(
                (candidate) => candidate.id === item.id,
            );
            const nextItem =
                currentIndex >= 0 ? sortedTodos[currentIndex + 1] : undefined;
            const prevItem =
                currentIndex > 0 ? sortedTodos[currentIndex - 1] : undefined;

            const focusAfterRowGone = (): PendingFocus =>
                nextItem
                    ? { target: "text", id: nextItem.id }
                    : prevItem
                      ? { target: "text", id: prevItem.id }
                      : { target: "add" };

            try {
                await deleteTodoMutation.mutateAsync(item.id);
                const restoreFocus = canRestoreFocusFor(item.id);
                updateActiveRowAction((current) =>
                    current?.id === item.id ? null : current,
                );
                showToast({ kind: "success", message: "已刪除待辦" });
                if (restoreFocus) {
                    setPendingFocus(focusAfterRowGone());
                }
            } catch (error) {
                notifyWriteError(error, "delete");
                const restoreFocus = canRestoreFocusFor(item.id);
                updateActiveRowAction((current) =>
                    current?.id === item.id ? null : current,
                );
                if (restoreFocus) {
                    setPendingFocus(
                        isNotFoundError(error)
                            ? focusAfterRowGone()
                            : { target: "delete", id: item.id },
                    );
                }
            } finally {
                endRowPending(item.id);
            }
        },
        [
            canEdit,
            deleteTodoMutation,
            endRowPending,
            notifyWriteError,
            showToast,
            sortedTodos,
            startRowPending,
            updateActiveRowAction,
        ],
    );

    const isOfflineNoCache =
        !hasData &&
        todosQuery.status === "pending" &&
        (todosQuery.fetchStatus === "paused" || !isOnline);
    const isInitialLoading =
        !hasData &&
        todosQuery.status === "pending" &&
        todosQuery.fetchStatus !== "paused" &&
        isOnline;

    return (
        <section
            aria-labelledby="todos-heading"
            className="flex min-w-0 flex-col gap-2.5"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
                    {headerActions}
                </div>
            </div>

            {!isOnline && <TodoOfflineBanner id={offlineBannerId} />}

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
                        {canEdit && (
                            <TodoAddRow
                                isOnline={isOnline}
                                isSubmitting={isAdding}
                                offlineBannerId={offlineBannerId}
                                inputRef={addInputRef}
                                onAdd={handleAdd}
                            />
                        )}

                        {sortedTodos.length === 0 ? (
                            <TodoEmptyState />
                        ) : (
                            <>
                                <ul className="divide-y divide-border/75">
                                    {sortedTodos.map((item) => {
                                        const mode =
                                            activeRowAction?.id === item.id
                                                ? activeRowAction.mode
                                                : "normal";

                                        return (
                                            <TodoRow
                                                key={item.id}
                                                item={item}
                                                canEdit={canEdit}
                                                isOnline={isOnline}
                                                isPending={pendingIds.has(
                                                    item.id,
                                                )}
                                                mode={mode}
                                                offlineBannerId={
                                                    offlineBannerId
                                                }
                                                setTextButtonRef={
                                                    setTextButtonRef
                                                }
                                                setDeleteButtonRef={
                                                    setDeleteButtonRef
                                                }
                                                onToggleCheck={
                                                    handleToggleCheck
                                                }
                                                onStartEdit={handleStartEdit}
                                                onCancelEdit={handleCancelEdit}
                                                onSaveEdit={handleSaveEdit}
                                                onStartDelete={
                                                    handleStartDelete
                                                }
                                                onCancelDelete={
                                                    handleCancelDelete
                                                }
                                                onConfirmDelete={
                                                    handleConfirmDelete
                                                }
                                            />
                                        );
                                    })}
                                </ul>

                                {canEdit && isOnline && (
                                    <p className="flex items-center gap-1.5 border-t border-border/60 bg-background/40 px-4 py-2 text-[11px] text-text-main/55 forest:text-text-main/68 ocean:text-text-main/65">
                                        <Pencil
                                            aria-hidden="true"
                                            className="size-3 shrink-0"
                                        />
                                        <span>點項目文字即可編輯</span>
                                    </p>
                                )}
                            </>
                        )}
                    </>
                ) : isOfflineNoCache ? (
                    <TodoOfflineNoCacheState />
                ) : isInitialLoading ? (
                    <TodoLoadingSkeleton />
                ) : todosQuery.isError ? (
                    <TodoLoadErrorState
                        error={todosQuery.error}
                        isOnline={isOnline}
                        isRetrying={todosQuery.isFetching}
                        offlineBannerId={offlineBannerId}
                        onRetry={() => {
                            if (!isOnline) {
                                return;
                            }
                            void todosQuery.refetch();
                        }}
                    />
                ) : null}
            </div>
        </section>
    );
}
