import type { QueryClient } from "@tanstack/react-query";
import type { TodoItem } from "../src/types";
import { getActiveSheetIdOrNull } from "@/src/utils/sheetSelection";
import { USER_STORAGE_KEY } from "./cacheKeys";
import { defaultTodoSyncTransport, type TodoSyncTransport } from "./api";
import { queryClient as defaultQueryClient } from "./queryClient";
import { getTodosQueryKey } from "./todoCache";
import {
    todoOutboxStore as defaultTodoOutboxStore,
    type TodoOutboxScope,
    type TodoOutboxStore,
} from "./todoOutboxStore";
import {
    TodoSyncEngine,
    type TodoSyncLocks,
    type TodoSyncTimers,
} from "./todoSyncEngine";

export type SignOutFlushResult = {
    flushed: boolean;
    remainingCount: number;
};

export type TodoSyncManagerDeps = {
    store?: TodoOutboxStore;
    transport?: TodoSyncTransport;
    queryClient?: QueryClient;
    getActiveSheetId?: () => string | null;
    getStoredUserEmail?: () => string | null;
    isOnline?: () => boolean;
    now?: () => number;
    random?: () => number;
    timers?: TodoSyncTimers;
    locks?: TodoSyncLocks | null;
    attachBrowserEvents?: boolean;
};

function readStoredUserEmail(): string | null {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(USER_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as { email?: unknown } | null;
        return typeof parsed?.email === "string" && parsed.email.trim()
            ? parsed.email.trim()
            : null;
    } catch {
        return null;
    }
}

function normalizeScope(
    scope: TodoOutboxScope | null | undefined,
): TodoOutboxScope | null {
    if (!scope) {
        return null;
    }
    const sheetId = scope.sheetId.trim();
    const ownerEmail = scope.ownerEmail.trim();
    if (!sheetId || !ownerEmail) {
        return null;
    }
    return { sheetId, ownerEmail };
}

function scopeMatches(
    a: TodoOutboxScope | null,
    b: TodoOutboxScope | null,
): boolean {
    return (
        a !== null &&
        b !== null &&
        a.sheetId === b.sheetId &&
        a.ownerEmail === b.ownerEmail
    );
}

/**
 * Manages the single active `TodoSyncEngine` for the signed-in user and selected sheet,
 * handling scope switching (clearing other scopes), passive sign-out (keeping outbox),
 * and explicit sign-out flush + post-confirmation clearing.
 */
export function createTodoSyncManager(deps: TodoSyncManagerDeps = {}) {
    const store = deps.store ?? defaultTodoOutboxStore;
    const transport = deps.transport ?? defaultTodoSyncTransport;
    const defaultClient = deps.queryClient ?? defaultQueryClient;
    const getActiveSheetId = deps.getActiveSheetId ?? getActiveSheetIdOrNull;
    const getStoredUserEmail = deps.getStoredUserEmail ?? readStoredUserEmail;
    const shouldAttachBrowserEvents = deps.attachBrowserEvents ?? true;

    let activeEngine: TodoSyncEngine | null = null;
    let activeScope: TodoOutboxScope | null = null;
    const managerListeners = new Set<() => void>();

    const notifyManagerListeners = () => {
        for (const listener of managerListeners) {
            listener();
        }
    };

    const subscribeActiveEngine = (listener: () => void): (() => void) => {
        managerListeners.add(listener);
        return () => {
            managerListeners.delete(listener);
        };
    };

    const peekEngine = (
        rawScope: TodoOutboxScope | null | undefined,
    ): TodoSyncEngine | null => {
        const scope = normalizeScope(rawScope);
        if (!scope || !activeEngine || activeEngine.isDisposed()) {
            return null;
        }
        return scopeMatches(activeScope, scope) ? activeEngine : null;
    };

    const createEngineForScope = (
        scope: TodoOutboxScope,
        client: QueryClient,
    ): TodoSyncEngine => {
        const queryKey = getTodosQueryKey(scope.sheetId, scope.ownerEmail);
        const engine = new TodoSyncEngine({
            sheetId: scope.sheetId,
            ownerEmail: scope.ownerEmail,
            store,
            transport,
            getBaseItems: () => client.getQueryData<TodoItem[]>(queryKey),
            setBaseItems: (items) => {
                // Keep the last fetch time: a sync write-back is not a refetch, and
                // bumping dataUpdatedAt would make the status line show 已更新
                // instead of 已儲存 (spec §4 rows 7/8).
                const previousUpdatedAt =
                    client.getQueryState(queryKey)?.dataUpdatedAt;
                client.setQueryData<TodoItem[]>(
                    queryKey,
                    items,
                    previousUpdatedAt ? { updatedAt: previousUpdatedAt } : undefined,
                );
            },
            cancelBaseQuery: () =>
                client.cancelQueries({ queryKey, exact: true }),
            onBaseCacheMissing: () => {
                void client.invalidateQueries({ queryKey, exact: true });
            },
            canReplayWrite: () => {
                const currentSheet = getActiveSheetId();
                const currentEmail = getStoredUserEmail();
                return (
                    currentSheet === scope.sheetId &&
                    currentEmail === scope.ownerEmail
                );
            },
            isOnline: deps.isOnline,
            now: deps.now,
            random: deps.random,
            timers: deps.timers,
            locks: deps.locks,
            clearOtherScopesOnInit: true,
        });
        if (shouldAttachBrowserEvents) {
            engine.attachBrowserEvents();
        }
        return engine;
    };

    const disposeActiveEngine = (): void => {
        const hadEngine = activeEngine !== null || activeScope !== null;
        if (activeEngine) {
            activeEngine.dispose();
            activeEngine = null;
        }
        activeScope = null;
        if (hadEngine) {
            notifyManagerListeners();
        }
    };

    const getOrCreateEngine = (
        rawScope: TodoOutboxScope,
        client: QueryClient = defaultClient,
    ): TodoSyncEngine => {
        const scope = normalizeScope(rawScope);
        if (!scope) {
            throw new Error(
                "TodoSyncManager requires non-empty sheetId and ownerEmail.",
            );
        }
        if (activeEngine && !activeEngine.isDisposed() && scopeMatches(activeScope, scope)) {
            return activeEngine;
        }
        if (activeEngine) {
            activeEngine.dispose();
        }
        activeScope = scope;
        activeEngine = createEngineForScope(scope, client);
        void activeEngine.init();
        notifyManagerListeners();
        return activeEngine;
    };

    const activateScope = async (
        rawScope: TodoOutboxScope | null,
        client: QueryClient = defaultClient,
    ): Promise<TodoSyncEngine | null> => {
        const scope = normalizeScope(rawScope);
        if (!scope) {
            // Passive sign-out or sheet deselection: stop timers/listeners, NEVER clear IDB.
            disposeActiveEngine();
            return null;
        }
        const engine = getOrCreateEngine(scope, client);
        await engine.init();
        return engine;
    };

    const getActiveEngine = (): TodoSyncEngine | null => {
        if (activeEngine && activeEngine.isDisposed()) {
            activeEngine = null;
            activeScope = null;
        }
        return activeEngine;
    };

    /**
     * Explicit sign-out step 1: if the current user's outbox has unsynced entries,
     * attempt one final flush without clearing the outbox.
     */
    const attemptSignOutFlush = async (
        rawScope?: TodoOutboxScope | null,
        client: QueryClient = defaultClient,
    ): Promise<SignOutFlushResult> => {
        const resolvedScope = normalizeScope(rawScope) ?? activeScope;
        if (!resolvedScope) {
            return { flushed: true, remainingCount: 0 };
        }

        const engine =
            activeEngine &&
            !activeEngine.isDisposed() &&
            scopeMatches(activeScope, resolvedScope)
                ? activeEngine
                : getOrCreateEngine(resolvedScope, client);

        await engine.init();
        if (!engine.hasUnsynced()) {
            return { flushed: true, remainingCount: 0 };
        }

        await engine.flushNow({ includeFailed: true });
        const remainingCount = engine.getUnsyncedCount();
        return {
            flushed: remainingCount === 0,
            remainingCount,
        };
    };

    /**
     * Explicit sign-out step 2: called ONLY after the outbox is empty or the user
     * confirmed discarding unsynced changes. Disposes the active engine and clears
     * that owner's outbox entries from storage.
     */
    const clearOutboxAfterConfirmedSignOut = async (
        ownerEmail: string,
    ): Promise<void> => {
        disposeActiveEngine();
        const trimmedOwner = ownerEmail.trim();
        if (trimmedOwner) {
            await store.clearOwnerScopes(trimmedOwner);
        }
    };

    return {
        getOrCreateEngine,
        peekEngine,
        subscribeActiveEngine,
        activateScope,
        getActiveEngine,
        disposeActiveEngine,
        attemptSignOutFlush,
        clearOutboxAfterConfirmedSignOut,
    };
}

export const todoSyncManager = createTodoSyncManager();
