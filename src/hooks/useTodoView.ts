"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTodosQuery } from "@/services/dataFetcher";
import {
    EMPTY_TODO_SYNC_SNAPSHOT,
    type TodoSyncCreateInput,
    type TodoSyncFlushNowOptions,
    type TodoSyncFlushResult,
    type TodoSyncSnapshot,
} from "@/services/todoSyncEngine";
import { todoSyncManager } from "@/services/todoSyncManager";
import { useAuthState } from "@/src/stores/AuthStore";
import type { TodoItem } from "@/src/types";
import {
    overlayTodos,
    type TodoOutboxEntry,
    type TodoOutboxPatch,
    type TodoOverlayItemStatus,
} from "@/src/utils/todoOutbox";

export type UseTodoViewOptions = {
    readOnly?: boolean;
};

export type UseTodoViewResult = {
    items: TodoItem[] | undefined;
    baseItems: TodoItem[] | undefined;
    isPending: boolean;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    status: "pending" | "error" | "success";
    fetchStatus: "fetching" | "paused" | "idle";
    dataUpdatedAt: number;
    refetch: () => Promise<unknown>;
    sync: TodoSyncSnapshot;
    statusById: Readonly<Record<string, TodoOverlayItemStatus>>;
    errorById: Readonly<Record<string, string>>;
    hasUnsynced: boolean;
    unsyncedCount: number;
    droppedCount: number;
    droppedNotice: string | null;
    create: (
        text: string,
        category?: string,
        checked?: boolean,
    ) => Promise<TodoOutboxEntry | null>;
    createMany: (
        items: readonly TodoSyncCreateInput[],
    ) => Promise<TodoOutboxEntry[]>;
    update: (
        id: string,
        patch: TodoOutboxPatch,
    ) => Promise<TodoOutboxEntry | null>;
    remove: (id: string) => Promise<TodoOutboxEntry | null>;
    retry: (id?: string) => Promise<TodoSyncFlushResult>;
    discard: (id: string) => Promise<void>;
    dismissDropped: () => Promise<void>;
    flushNow: (options?: TodoSyncFlushNowOptions) => Promise<TodoSyncFlushResult>;
};

const EMPTY_FLUSH_RESULT: TodoSyncFlushResult = Object.freeze({
    sentBatches: 0,
    appliedCount: 0,
    remainingCount: 0,
    authExpired: false,
    offline: false,
});

const UNHYDRATED_TODO_SYNC_SNAPSHOT: TodoSyncSnapshot = Object.freeze({
    ...EMPTY_TODO_SYNC_SNAPSHOT,
    hydrated: false,
});

/**
 * Returns the todo list for `(sheetId, ownerEmail)`:
 * - For the signed-in user's own editable list, overlays the persistent outbox
 *   onto the TanStack Query base without writing optimistic state into base cache,
 *   runs dropped-item detection whenever base data changes (refetch), and exposes
 *   local-first actions + sync status snapshot.
 * - For read-only teammate lists, uses the plain TanStack Query with no outbox.
 */
export function useTodoView(
    sheetId: string | null | undefined,
    ownerEmail: string | null | undefined,
    options?: UseTodoViewOptions,
): UseTodoViewResult {
    const queryClient = useQueryClient();
    const { isSignedIn, user } = useAuthState();
    const todosQuery = useTodosQuery(sheetId, ownerEmail);

    const trimmedSheetId = sheetId?.trim() ?? "";
    const trimmedOwnerEmail = ownerEmail?.trim() ?? "";
    const signedInEmail = user?.email?.trim() ?? "";
    const useOutbox = Boolean(
        !options?.readOnly &&
            isSignedIn &&
            trimmedSheetId &&
            trimmedOwnerEmail &&
            signedInEmail === trimmedOwnerEmail,
    );

    useEffect(() => {
        if (!useOutbox) {
            return;
        }
        todoSyncManager.getOrCreateEngine(
            { sheetId: trimmedSheetId, ownerEmail: trimmedOwnerEmail },
            queryClient,
        );
    }, [useOutbox, trimmedSheetId, trimmedOwnerEmail, queryClient]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            if (!useOutbox) {
                return () => {};
            }
            const scope = {
                sheetId: trimmedSheetId,
                ownerEmail: trimmedOwnerEmail,
            };
            let currentEngine = todoSyncManager.peekEngine(scope);
            let unsubscribeEngine = currentEngine
                ? currentEngine.subscribe(onStoreChange)
                : null;

            const unsubscribeManager = todoSyncManager.subscribeActiveEngine(
                () => {
                    const nextEngine = todoSyncManager.peekEngine(scope);
                    if (nextEngine !== currentEngine) {
                        unsubscribeEngine?.();
                        unsubscribeEngine = nextEngine
                            ? nextEngine.subscribe(onStoreChange)
                            : null;
                        currentEngine = nextEngine;
                    }
                    onStoreChange();
                },
            );

            return () => {
                unsubscribeEngine?.();
                unsubscribeManager();
            };
        },
        [useOutbox, trimmedSheetId, trimmedOwnerEmail],
    );

    const getSnapshot = useCallback((): TodoSyncSnapshot => {
        if (!useOutbox) {
            return EMPTY_TODO_SYNC_SNAPSHOT;
        }
        const engine = todoSyncManager.peekEngine({
            sheetId: trimmedSheetId,
            ownerEmail: trimmedOwnerEmail,
        });
        return engine ? engine.getSnapshot() : UNHYDRATED_TODO_SYNC_SNAPSHOT;
    }, [useOutbox, trimmedSheetId, trimmedOwnerEmail]);

    const getServerSnapshot = useCallback((): TodoSyncSnapshot => {
        return useOutbox
            ? UNHYDRATED_TODO_SYNC_SNAPSHOT
            : EMPTY_TODO_SYNC_SNAPSHOT;
    }, [useOutbox]);

    const sync = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );

    const baseItems = todosQuery.data;

    useEffect(() => {
        if (!useOutbox || baseItems === undefined) {
            return;
        }
        const engine = todoSyncManager.getOrCreateEngine(
            { sheetId: trimmedSheetId, ownerEmail: trimmedOwnerEmail },
            queryClient,
        );
        void engine.reconcileWithBase(baseItems);
    }, [
        useOutbox,
        baseItems,
        trimmedSheetId,
        trimmedOwnerEmail,
        queryClient,
    ]);

    const overlay = useMemo(() => {
        if (!useOutbox || baseItems === undefined) {
            return null;
        }
        return overlayTodos(baseItems, sync.entries, {
            ownerEmail: trimmedOwnerEmail,
        });
    }, [useOutbox, baseItems, sync.entries, trimmedOwnerEmail]);

    const getEngineOrThrow = useCallback(() => {
        if (!useOutbox) {
            return null;
        }
        return todoSyncManager.getOrCreateEngine(
            { sheetId: trimmedSheetId, ownerEmail: trimmedOwnerEmail },
            queryClient,
        );
    }, [useOutbox, trimmedSheetId, trimmedOwnerEmail, queryClient]);

    const create = useCallback(
        async (text: string, category?: string, checked = false) => {
            const engine = getEngineOrThrow();
            if (!engine) {
                return null;
            }
            return engine.create(text, category, checked);
        },
        [getEngineOrThrow],
    );

    const createMany = useCallback(
        async (items: readonly TodoSyncCreateInput[]) => {
            const engine = getEngineOrThrow();
            if (!engine) {
                return [];
            }
            return engine.createMany(items);
        },
        [getEngineOrThrow],
    );

    const update = useCallback(
        async (id: string, patch: TodoOutboxPatch) => {
            const engine = getEngineOrThrow();
            if (!engine) {
                return null;
            }
            return engine.update(id, patch);
        },
        [getEngineOrThrow],
    );

    const remove = useCallback(
        async (id: string) => {
            const engine = getEngineOrThrow();
            if (!engine) {
                return null;
            }
            return engine.remove(id);
        },
        [getEngineOrThrow],
    );

    const retry = useCallback(
        async (id?: string) => {
            const engine = getEngineOrThrow();
            if (!engine) {
                return EMPTY_FLUSH_RESULT;
            }
            return engine.retry(id);
        },
        [getEngineOrThrow],
    );

    const discard = useCallback(
        async (id: string) => {
            const engine = getEngineOrThrow();
            if (!engine) {
                return;
            }
            await engine.discard(id);
        },
        [getEngineOrThrow],
    );

    const dismissDropped = useCallback(async () => {
        const engine = getEngineOrThrow();
        if (!engine) {
            return;
        }
        await engine.dismissDropped();
    }, [getEngineOrThrow]);

    const flushNow = useCallback(
        async (flushOptions?: TodoSyncFlushNowOptions) => {
            const engine = getEngineOrThrow();
            if (!engine) {
                return EMPTY_FLUSH_RESULT;
            }
            return engine.flushNow(flushOptions);
        },
        [getEngineOrThrow],
    );

    return {
        items: useOutbox ? overlay?.items : baseItems,
        baseItems,
        isPending: todosQuery.isPending,
        isFetching: todosQuery.isFetching,
        isError: todosQuery.isError,
        error: todosQuery.error,
        status: todosQuery.status,
        fetchStatus: todosQuery.fetchStatus,
        dataUpdatedAt: todosQuery.dataUpdatedAt,
        refetch: todosQuery.refetch,
        sync,
        statusById: useOutbox
            ? (overlay?.statusById ?? sync.statusById)
            : EMPTY_TODO_SYNC_SNAPSHOT.statusById,
        errorById: useOutbox
            ? sync.errorById
            : EMPTY_TODO_SYNC_SNAPSHOT.errorById,
        hasUnsynced: useOutbox ? sync.hasUnsynced : false,
        unsyncedCount: useOutbox ? sync.unsyncedCount : 0,
        droppedCount: useOutbox
            ? (overlay?.droppedCount ?? sync.droppedCount)
            : 0,
        droppedNotice: useOutbox
            ? (overlay?.droppedNotice ?? sync.droppedNotice)
            : null,
        create,
        createMany,
        update,
        remove,
        retry,
        discard,
        dismissDropped,
        flushNow,
    };
}
