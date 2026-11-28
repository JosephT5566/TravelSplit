import type { TodoItem } from "../src/types";
import {
    applyLocalChange,
    buildKeepaliveSyncBatch,
    buildSyncBatches,
    discardOutboxEntry,
    dismissDroppedEntries,
    formatDroppedTodosNotice,
    generateClientTodoId,
    generateUuidV4,
    nextFlushDelay,
    overlayTodos,
    reconcileSyncFailure,
    reconcileSyncResponse,
    resetEntriesForRetry,
    TODO_OUTBOX_DEBOUNCE_MS,
    TODO_OUTBOX_MAX_TRANSIENT_ATTEMPTS,
    TODO_OUTBOX_MAX_WAIT_MS,
    TODO_SYNC_MAX_OPS,
    type TodoOutboxEntry,
    type TodoOutboxPatch,
    type TodoOverlayItemStatus,
    type TodoSyncBatch,
    type TodoSyncResponse,
} from "@/src/utils/todoOutbox";
import type { TodoSyncTransport } from "./api";
import type { TodoOutboxScope, TodoOutboxStore } from "./todoOutboxStore";

export type TodoSyncTimers = {
    setTimeout: (callback: () => void, delayMs: number) => unknown;
    clearTimeout: (handle: unknown) => void;
};

export type TodoSyncLocks = {
    request: <T>(
        name: string,
        callback: () => Promise<T> | T,
    ) => Promise<T>;
};

export type TodoSyncLastErrorKind = "auth" | "failed" | null;

export type TodoSyncSnapshot = {
    hydrated: boolean;
    entries: readonly TodoOutboxEntry[];
    statusById: Readonly<Record<string, TodoOverlayItemStatus>>;
    errorById: Readonly<Record<string, string>>;
    inflight: boolean;
    lastSavedAt: number | null;
    authExpired: boolean;
    lastErrorKind: TodoSyncLastErrorKind;
    droppedCount: number;
    droppedNotice: string | null;
    persistent: boolean;
    nextRetryAt: number | null;
    hasUnsynced: boolean;
    unsyncedCount: number;
};

export type TodoSyncFlushResult = {
    sentBatches: number;
    appliedCount: number;
    remainingCount: number;
    authExpired: boolean;
    offline: boolean;
};

export type TodoSyncFlushNowOptions = {
    includeFailed?: boolean;
};

export type TodoSyncCreateInput = {
    text: string;
    checked?: boolean;
    category?: string;
};

export type TodoSyncEngineOptions = {
    sheetId: string;
    ownerEmail: string;
    store: TodoOutboxStore;
    transport: TodoSyncTransport;
    getBaseItems: () => readonly TodoItem[] | undefined;
    setBaseItems: (items: TodoItem[]) => void;
    onBaseCacheMissing?: () => void;
    canReplayWrite?: () => boolean;
    isOnline?: () => boolean;
    now?: () => number;
    random?: () => number;
    timers?: TodoSyncTimers;
    locks?: TodoSyncLocks | null;
    generateTodoId?: (timestampMs: number) => string;
    generateOpId?: () => string;
    debounceMs?: number;
    maxWaitMs?: number;
    maxTransientAttempts?: number;
    clearOtherScopesOnInit?: boolean;
};

const EMPTY_STATUS_BY_ID: Readonly<Record<string, TodoOverlayItemStatus>> =
    Object.freeze({});
const EMPTY_ERROR_BY_ID: Readonly<Record<string, string>> = Object.freeze({});
const EMPTY_ENTRIES: readonly TodoOutboxEntry[] = Object.freeze([]);

export const EMPTY_TODO_SYNC_SNAPSHOT: TodoSyncSnapshot = Object.freeze({
    hydrated: true,
    entries: EMPTY_ENTRIES,
    statusById: EMPTY_STATUS_BY_ID,
    errorById: EMPTY_ERROR_BY_ID,
    inflight: false,
    lastSavedAt: null,
    authExpired: false,
    lastErrorKind: null,
    droppedCount: 0,
    droppedNotice: null,
    persistent: true,
    nextRetryAt: null,
    hasUnsynced: false,
    unsyncedCount: 0,
});

function isPatchEmpty(patch: TodoOutboxPatch): boolean {
    return (
        patch.text === undefined &&
        patch.checked === undefined &&
        patch.category === undefined
    );
}

function toPersistedEntry(entry: TodoOutboxEntry): TodoOutboxEntry {
    if (entry.status !== "inflight") {
        return entry;
    }
    const persisted: TodoOutboxEntry = {
        id: entry.id,
        kind: entry.kind,
        base: entry.base ? { ...entry.base } : null,
        patch: { ...entry.patch },
        rev: entry.rev,
        attempts: entry.attempts,
        status: "pending",
        lastError: entry.lastError,
    };
    if (entry.opId !== undefined) {
        persisted.opId = entry.opId;
    }
    if (entry.nextAttemptAt !== undefined) {
        persisted.nextAttemptAt = entry.nextAttemptAt;
    }
    if (entry.createdAt !== undefined) {
        persisted.createdAt = entry.createdAt;
    }
    return persisted;
}

function entriesEqual(a: TodoOutboxEntry, b: TodoOutboxEntry): boolean {
    return (
        a.id === b.id &&
        a.kind === b.kind &&
        a.rev === b.rev &&
        a.attempts === b.attempts &&
        a.status === b.status &&
        a.lastError === b.lastError &&
        a.opId === b.opId &&
        a.nextAttemptAt === b.nextAttemptAt &&
        a.createdAt === b.createdAt &&
        a.patch.text === b.patch.text &&
        a.patch.checked === b.patch.checked &&
        a.patch.category === b.patch.category &&
        a.base?.text === b.base?.text &&
        a.base?.checked === b.base?.checked &&
        a.base?.category === b.base?.category
    );
}

function resolveDefaultLocks(): TodoSyncLocks | null {
    if (
        typeof navigator !== "undefined" &&
        navigator.locks &&
        typeof navigator.locks.request === "function"
    ) {
        return {
            request: <T,>(name: string, callback: () => Promise<T> | T) =>
                navigator.locks.request(name, async () => callback()) as Promise<T>,
        };
    }
    return null;
}

const DEFAULT_TIMERS: TodoSyncTimers = {
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle) =>
        globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function defaultIsOnline(): boolean {
    return typeof navigator === "undefined" || navigator.onLine !== false;
}

function buildSnapshot(state: {
    hydrated: boolean;
    entries: readonly TodoOutboxEntry[];
    inflight: boolean;
    lastSavedAt: number | null;
    authExpired: boolean;
    persistent: boolean;
}): TodoSyncSnapshot {
    const statusById: Record<string, TodoOverlayItemStatus> = {};
    const errorById: Record<string, string> = {};
    let droppedCount = 0;
    let failedCount = 0;
    let unsyncedCount = 0;
    let earliestNextRetryAt: number | null = null;

    for (const entry of state.entries) {
        if (entry.status === "dropped") {
            droppedCount += 1;
            continue;
        }
        statusById[entry.id] = entry.status;
        unsyncedCount += 1;
        if (entry.status === "failed") {
            failedCount += 1;
            if (entry.lastError) {
                errorById[entry.id] = entry.lastError;
            }
        } else if (
            entry.status === "pending" &&
            typeof entry.nextAttemptAt === "number" &&
            Number.isFinite(entry.nextAttemptAt)
        ) {
            if (
                earliestNextRetryAt === null ||
                entry.nextAttemptAt < earliestNextRetryAt
            ) {
                earliestNextRetryAt = entry.nextAttemptAt;
            }
        }
    }

    const lastErrorKind: TodoSyncLastErrorKind =
        failedCount > 0 ? "failed" : state.authExpired ? "auth" : null;

    return {
        hydrated: state.hydrated,
        entries: state.entries,
        statusById,
        errorById,
        inflight: state.inflight,
        lastSavedAt: state.lastSavedAt,
        authExpired: state.authExpired,
        lastErrorKind,
        droppedCount,
        droppedNotice:
            droppedCount > 0 ? formatDroppedTodosNotice(droppedCount) : null,
        persistent: state.persistent,
        nextRetryAt: earliestNextRetryAt,
        hasUnsynced: unsyncedCount > 0,
        unsyncedCount,
    };
}

/**
 * React-free, single-scope outbox sync engine.
 * Coordinates immediate IDB persistence, debounce/maxWait/backoff scheduling,
 * single-flight batched `POST /todos/sync` flushing, keepalive flushes,
 * and TanStack base cache convergence without writing optimistic state into base cache.
 */
export class TodoSyncEngine {
    readonly scope: TodoOutboxScope;
    private readonly lockName: string;
    private readonly store: TodoOutboxStore;
    private readonly transport: TodoSyncTransport;
    private readonly getBaseItems: () => readonly TodoItem[] | undefined;
    private readonly setBaseItems: (items: TodoItem[]) => void;
    private readonly onBaseCacheMissing?: () => void;
    private readonly canReplayWrite: () => boolean;
    private readonly isOnline: () => boolean;
    private readonly now: () => number;
    private readonly random: () => number;
    private readonly timers: TodoSyncTimers;
    private readonly locks: TodoSyncLocks | null;
    private readonly generateTodoId: (timestampMs: number) => string;
    private readonly generateOpId: () => string;
    private readonly debounceMs: number;
    private readonly maxWaitMs: number;
    private readonly maxTransientAttempts: number;
    private readonly clearOtherScopesOnInit: boolean;

    private entries: TodoOutboxEntry[] = [];
    private hydrated = false;
    private persistent: boolean;
    private lastSavedAt: number | null = null;
    private authExpired = false;
    private isFlushing = false;
    private disposed = false;

    private firstChangeAt: number | null = null;
    private lastChangeAt: number | null = null;
    private hasRecoveredPending = false;
    private lastCreatedMs = 0;

    private timerHandle: unknown = null;
    private initPromise: Promise<void> | null = null;
    private writeChain: Promise<void> = Promise.resolve();
    private inflightPromise: Promise<TodoSyncFlushResult> | null = null;
    private detachBrowserEvents: (() => void) | null = null;

    private readonly listeners = new Set<() => void>();
    private snapshot: TodoSyncSnapshot;

    constructor(options: TodoSyncEngineOptions) {
        this.scope = {
            sheetId: options.sheetId.trim(),
            ownerEmail: options.ownerEmail.trim(),
        };
        this.lockName = `tripsplit-todo-outbox::${this.scope.sheetId}::${this.scope.ownerEmail}`;
        this.store = options.store;
        this.transport = options.transport;
        this.getBaseItems = options.getBaseItems;
        this.setBaseItems = options.setBaseItems;
        this.onBaseCacheMissing = options.onBaseCacheMissing;
        this.canReplayWrite = options.canReplayWrite ?? (() => !this.disposed);
        this.isOnline = options.isOnline ?? defaultIsOnline;
        this.now = options.now ?? Date.now;
        this.random = options.random ?? Math.random;
        this.timers = options.timers ?? DEFAULT_TIMERS;
        this.locks =
            options.locks !== undefined ? options.locks : resolveDefaultLocks();
        this.generateTodoId =
            options.generateTodoId ??
            ((timestampMs) => generateClientTodoId({ now: () => timestampMs }));
        this.generateOpId = options.generateOpId ?? (() => generateUuidV4());
        this.debounceMs = options.debounceMs ?? TODO_OUTBOX_DEBOUNCE_MS;
        this.maxWaitMs = options.maxWaitMs ?? TODO_OUTBOX_MAX_WAIT_MS;
        this.maxTransientAttempts =
            options.maxTransientAttempts ?? TODO_OUTBOX_MAX_TRANSIENT_ATTEMPTS;
        this.clearOtherScopesOnInit = Boolean(options.clearOtherScopesOnInit);
        this.persistent = this.store.persistent;

        this.snapshot = buildSnapshot({
            hydrated: this.hydrated,
            entries: this.entries,
            inflight: this.isFlushing,
            lastSavedAt: this.lastSavedAt,
            authExpired: this.authExpired,
            persistent: this.persistent,
        });
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): TodoSyncSnapshot => {
        return this.snapshot;
    };

    getUnsyncedCount(): number {
        return this.snapshot.unsyncedCount;
    }

    hasUnsynced(): boolean {
        return this.snapshot.hasUnsynced;
    }

    isDisposed(): boolean {
        return this.disposed;
    }

    init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.performInit();
        }
        return this.initPromise;
    }

    attachBrowserEvents(): void {
        if (this.detachBrowserEvents || this.disposed) {
            return;
        }
        if (typeof window === "undefined") {
            return;
        }

        const onOnline = () => {
            this.handleOnline();
        };
        const onOffline = () => {
            this.handleOffline();
        };
        const onPageHide = () => {
            this.handlePageHide();
        };
        const onVisibilityChange = () => {
            if (typeof document === "undefined") {
                return;
            }
            this.handleVisibilityChange(
                document.visibilityState === "hidden" ? "hidden" : "visible",
            );
        };

        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        window.addEventListener("pagehide", onPageHide);
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", onVisibilityChange);
        }

        this.detachBrowserEvents = () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("pagehide", onPageHide);
            if (typeof document !== "undefined") {
                document.removeEventListener(
                    "visibilitychange",
                    onVisibilityChange,
                );
            }
        };
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.clearTimer();
        if (this.detachBrowserEvents) {
            this.detachBrowserEvents();
            this.detachBrowserEvents = null;
        }
        this.listeners.clear();
    }

    private emit(): void {
        this.persistent = this.store.persistent;
        this.snapshot = buildSnapshot({
            hydrated: this.hydrated,
            entries: this.entries,
            inflight: this.isFlushing,
            lastSavedAt: this.lastSavedAt,
            authExpired: this.authExpired,
            persistent: this.persistent,
        });
        for (const listener of this.listeners) {
            listener();
        }
    }

    private clearTimer(): void {
        if (this.timerHandle !== null) {
            this.timers.clearTimeout(this.timerHandle);
            this.timerHandle = null;
        }
    }

    private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
        const next = this.writeChain.then(task, task);
        this.writeChain = next.then(
            () => undefined,
            () => undefined,
        );
        return next;
    }

    private async performInit(): Promise<void> {
        if (this.clearOtherScopesOnInit) {
            await this.store.clearOtherScopes(this.scope);
        }
        const loaded = await this.store.loadScope(this.scope);
        if (this.disposed) {
            return;
        }

        const normalized: TodoOutboxEntry[] = [];
        const idsToDelete: string[] = [];
        const entriesToNormalize: TodoOutboxEntry[] = [];

        for (const entry of loaded.entries) {
            if (entry.kind === "patch" && isPatchEmpty(entry.patch)) {
                idsToDelete.push(entry.id);
                continue;
            }
            if (entry.status === "inflight") {
                const pending = toPersistedEntry(entry);
                normalized.push(pending);
                entriesToNormalize.push(pending);
                continue;
            }
            normalized.push(entry);
        }

        if (idsToDelete.length > 0) {
            await this.store.deleteEntries(this.scope, idsToDelete);
        }
        if (entriesToNormalize.length > 0) {
            await this.store.putEntries(this.scope, entriesToNormalize);
        }
        if (this.disposed) {
            return;
        }

        this.entries = normalized;
        this.lastSavedAt = loaded.meta.lastSavedAt;
        this.persistent = loaded.persistent && this.store.persistent;
        this.hydrated = true;

        const now = this.now();
        this.hasRecoveredPending = this.entries.some(
            (entry) =>
                entry.status === "pending" &&
                (entry.nextAttemptAt === undefined ||
                    entry.nextAttemptAt <= now),
        );

        this.emit();
        this.scheduleNextFlush();
    }

    private allocateMonotonicTimestamp(): number {
        const current = Math.floor(this.now());
        const next =
            this.lastCreatedMs >= current ? this.lastCreatedMs + 1 : current;
        this.lastCreatedMs = next;
        return next;
    }

    private markLocalChangeTimestamp(): void {
        const current = this.now();
        if (this.firstChangeAt === null) {
            this.firstChangeAt = current;
        }
        this.lastChangeAt = current;
    }

    private findBaseItem(id: string): TodoItem | undefined {
        return this.getBaseItems()?.find((item) => item.id === id);
    }

    private hasPendingEntriesWithoutBackoff(): boolean {
        return this.entries.some(
            (entry) =>
                entry.status === "pending" &&
                entry.nextAttemptAt === undefined &&
                !(entry.kind === "patch" && isPatchEmpty(entry.patch)),
        );
    }

    private scheduleNextFlush(): void {
        this.clearTimer();

        if (
            this.disposed ||
            this.isFlushing ||
            this.authExpired ||
            !this.isOnline()
        ) {
            return;
        }

        const currentNow = this.now();
        let hasReadyPending = false;
        let hasFreshPending = false;
        let earliestBackoffAt: number | null = null;

        for (const entry of this.entries) {
            if (entry.status !== "pending") {
                continue;
            }
            if (entry.kind === "patch" && isPatchEmpty(entry.patch)) {
                continue;
            }
            if (
                typeof entry.nextAttemptAt === "number" &&
                Number.isFinite(entry.nextAttemptAt)
            ) {
                if (entry.nextAttemptAt <= currentNow) {
                    hasReadyPending = true;
                } else if (
                    earliestBackoffAt === null ||
                    entry.nextAttemptAt < earliestBackoffAt
                ) {
                    earliestBackoffAt = entry.nextAttemptAt;
                }
            } else {
                hasFreshPending = true;
            }
        }

        if (!hasFreshPending) {
            this.firstChangeAt = null;
            this.lastChangeAt = null;
        }

        if (!hasFreshPending && !hasReadyPending && earliestBackoffAt === null) {
            this.hasRecoveredPending = false;
            return;
        }

        let delay: number | null = null;

        if (hasReadyPending || (hasFreshPending && this.hasRecoveredPending && this.firstChangeAt === null)) {
            delay = 0;
        } else if (hasFreshPending) {
            const first = this.firstChangeAt ?? currentNow;
            const last = this.lastChangeAt ?? currentNow;
            delay = nextFlushDelay({
                now: currentNow,
                firstChangeAt: first,
                lastChangeAt: last,
                debounceMs: this.debounceMs,
                maxWaitMs: this.maxWaitMs,
            });
        }

        if (earliestBackoffAt !== null) {
            const backoffWait = Math.max(0, earliestBackoffAt - currentNow);
            delay = delay === null ? backoffWait : Math.min(delay, backoffWait);
        }

        if (delay === null) {
            return;
        }

        this.timerHandle = this.timers.setTimeout(() => {
            this.timerHandle = null;
            void this.flushInternal({
                ignoreBackoff: false,
                drainNewEdits: false,
            });
        }, delay);
    }

    async create(
        text: string,
        category?: string,
        checked = false,
    ): Promise<TodoOutboxEntry> {
        return this.enqueueWrite(async () => {
            await this.init();
            const timestampMs = this.allocateMonotonicTimestamp();
            const id = this.generateTodoId(timestampMs);
            const createdAt = new Date(timestampMs).toISOString();
            const next = applyLocalChange(undefined, {
                type: "create",
                id,
                text,
                checked,
                category,
                createdAt,
            });
            if (!next) {
                throw new Error("Failed to create todo outbox entry.");
            }
            await this.store.putEntry(this.scope, toPersistedEntry(next));
            if (this.disposed) {
                return next;
            }
            this.entries = [...this.entries, next];
            this.markLocalChangeTimestamp();
            this.emit();
            this.scheduleNextFlush();
            return next;
        });
    }

    async createMany(
        items: readonly TodoSyncCreateInput[],
    ): Promise<TodoOutboxEntry[]> {
        if (items.length === 0) {
            return [];
        }
        return this.enqueueWrite(async () => {
            await this.init();
            const created: TodoOutboxEntry[] = [];
            for (const item of items) {
                const timestampMs = this.allocateMonotonicTimestamp();
                const id = this.generateTodoId(timestampMs);
                const createdAt = new Date(timestampMs).toISOString();
                const entry = applyLocalChange(undefined, {
                    type: "create",
                    id,
                    text: item.text,
                    checked: item.checked ?? false,
                    category: item.category,
                    createdAt,
                });
                if (entry) {
                    created.push(entry);
                }
            }
            if (created.length === 0) {
                return [];
            }
            await this.store.putEntries(
                this.scope,
                created.map(toPersistedEntry),
            );
            if (this.disposed) {
                return created;
            }
            this.entries = [...this.entries, ...created];
            this.markLocalChangeTimestamp();
            this.emit();
            this.scheduleNextFlush();
            return created;
        });
    }

    async update(
        id: string,
        patch: TodoOutboxPatch,
        baseItemOverride?: TodoItem | null,
    ): Promise<TodoOutboxEntry | null> {
        return this.enqueueWrite(async () => {
            await this.init();
            const existingIndex = this.entries.findIndex(
                (entry) => entry.id === id,
            );
            const existing =
                existingIndex >= 0 ? this.entries[existingIndex] : undefined;
            const baseItem =
                baseItemOverride !== undefined
                    ? baseItemOverride
                    : this.findBaseItem(id);

            const next = applyLocalChange(
                existing,
                { type: "patch", id, patch },
                baseItem,
            );

            if (next === existing) {
                return existing ?? null;
            }

            if (next === null) {
                await this.store.deleteEntry(this.scope, id);
                if (this.disposed) {
                    return null;
                }
                if (existingIndex >= 0) {
                    this.entries = this.entries.filter(
                        (entry) => entry.id !== id,
                    );
                }
                if (!this.hasPendingEntriesWithoutBackoff()) {
                    this.firstChangeAt = null;
                    this.lastChangeAt = null;
                }
                this.emit();
                this.scheduleNextFlush();
                return null;
            }

            await this.store.putEntry(this.scope, toPersistedEntry(next));
            if (this.disposed) {
                return next;
            }
            if (existingIndex >= 0) {
                const updated = [...this.entries];
                updated[existingIndex] = next;
                this.entries = updated;
            } else {
                this.entries = [...this.entries, next];
            }
            this.markLocalChangeTimestamp();
            this.emit();
            this.scheduleNextFlush();
            return next;
        });
    }

    async remove(
        id: string,
        baseItemOverride?: TodoItem | null,
    ): Promise<TodoOutboxEntry | null> {
        return this.enqueueWrite(async () => {
            await this.init();
            const existingIndex = this.entries.findIndex(
                (entry) => entry.id === id,
            );
            const existing =
                existingIndex >= 0 ? this.entries[existingIndex] : undefined;
            const baseItem =
                baseItemOverride !== undefined
                    ? baseItemOverride
                    : this.findBaseItem(id);

            const next = applyLocalChange(
                existing,
                { type: "delete", id },
                baseItem,
            );

            if (next === existing) {
                return existing ?? null;
            }

            if (next === null) {
                await this.store.deleteEntry(this.scope, id);
                if (this.disposed) {
                    return null;
                }
                if (existingIndex >= 0) {
                    this.entries = this.entries.filter(
                        (entry) => entry.id !== id,
                    );
                }
                if (!this.hasPendingEntriesWithoutBackoff()) {
                    this.firstChangeAt = null;
                    this.lastChangeAt = null;
                }
                this.emit();
                this.scheduleNextFlush();
                return null;
            }

            await this.store.putEntry(this.scope, toPersistedEntry(next));
            if (this.disposed) {
                return next;
            }
            if (existingIndex >= 0) {
                const updated = [...this.entries];
                updated[existingIndex] = next;
                this.entries = updated;
            } else {
                this.entries = [...this.entries, next];
            }
            this.markLocalChangeTimestamp();
            this.emit();
            this.scheduleNextFlush();
            return next;
        });
    }

    async discard(id: string): Promise<void> {
        await this.enqueueWrite(async () => {
            await this.init();
            const nextEntries = discardOutboxEntry(this.entries, id);
            if (nextEntries.length === this.entries.length) {
                return;
            }
            await this.store.deleteEntry(this.scope, id);
            if (this.disposed) {
                return;
            }
            this.entries = nextEntries;
            if (!this.hasPendingEntriesWithoutBackoff()) {
                this.firstChangeAt = null;
                this.lastChangeAt = null;
            }
            this.emit();
            this.scheduleNextFlush();
        });
    }

    async dismissDropped(): Promise<void> {
        await this.enqueueWrite(async () => {
            await this.init();
            const droppedIds = this.entries
                .filter((entry) => entry.status === "dropped")
                .map((entry) => entry.id);
            if (droppedIds.length === 0) {
                return;
            }
            await this.store.deleteEntries(this.scope, droppedIds);
            if (this.disposed) {
                return;
            }
            this.entries = dismissDroppedEntries(this.entries);
            this.emit();
        });
    }

    async reconcileWithBase(baseItems: readonly TodoItem[]): Promise<void> {
        await this.enqueueWrite(async () => {
            await this.init();
            if (this.disposed || this.entries.length === 0) {
                return;
            }

            // Leave inflight entries untouched until their sync response reconciles them.
            const inflightById = new Map<string, TodoOutboxEntry>();
            const nonInflight: TodoOutboxEntry[] = [];
            for (const entry of this.entries) {
                if (entry.status === "inflight") {
                    inflightById.set(entry.id, entry);
                } else {
                    nonInflight.push(entry);
                }
            }
            if (nonInflight.length === 0) {
                return;
            }

            const overlaid = overlayTodos(baseItems, nonInflight, {
                ownerEmail: this.scope.ownerEmail,
            });
            const reconciledById = new Map<string, TodoOutboxEntry>();
            for (const entry of overlaid.reconciledEntries) {
                reconciledById.set(entry.id, entry);
            }

            const nextEntries: TodoOutboxEntry[] = [];
            const toDelete: string[] = [];
            const toPut: TodoOutboxEntry[] = [];
            let changed = false;

            for (const original of this.entries) {
                const inflight = inflightById.get(original.id);
                if (inflight) {
                    nextEntries.push(inflight);
                    continue;
                }
                const updated = reconciledById.get(original.id);
                if (!updated) {
                    toDelete.push(original.id);
                    changed = true;
                } else {
                    nextEntries.push(updated);
                    if (!entriesEqual(original, updated)) {
                        toPut.push(updated);
                        changed = true;
                    }
                }
            }

            if (!changed) {
                return;
            }

            if (toDelete.length > 0) {
                await this.store.deleteEntries(this.scope, toDelete);
            }
            if (toPut.length > 0) {
                await this.store.putEntries(
                    this.scope,
                    toPut.map(toPersistedEntry),
                );
            }
            if (this.disposed) {
                return;
            }

            this.entries = nextEntries;
            this.emit();
            this.scheduleNextFlush();
        });
    }

    async retry(id?: string): Promise<TodoSyncFlushResult> {
        await this.enqueueWrite(async () => {
            await this.init();
            if (this.disposed) {
                return;
            }
            const nextEntries = resetEntriesForRetry(
                this.entries,
                id !== undefined ? [id] : undefined,
            );
            const changed: TodoOutboxEntry[] = [];
            for (let index = 0; index < nextEntries.length; index += 1) {
                if (!entriesEqual(this.entries[index], nextEntries[index])) {
                    changed.push(nextEntries[index]);
                }
            }
            if (changed.length > 0) {
                await this.store.putEntries(
                    this.scope,
                    changed.map(toPersistedEntry),
                );
            }
            if (this.disposed) {
                return;
            }
            this.entries = nextEntries;
            this.authExpired = false;
            this.emit();
        });

        return this.flushNowInternal({
            ignoreBackoff: id === undefined,
            resetPendingBackoff: false,
            includeFailed: false,
        });
    }

    async flushNow(
        options: TodoSyncFlushNowOptions = {},
    ): Promise<TodoSyncFlushResult> {
        return this.flushNowInternal({
            ignoreBackoff: true,
            resetPendingBackoff: true,
            includeFailed: Boolean(options.includeFailed),
        });
    }

    private async flushNowInternal({
        ignoreBackoff,
        resetPendingBackoff,
        includeFailed,
    }: {
        ignoreBackoff: boolean;
        resetPendingBackoff: boolean;
        includeFailed: boolean;
    }): Promise<TodoSyncFlushResult> {
        await this.init();
        if (this.disposed) {
            return {
                sentBatches: 0,
                appliedCount: 0,
                remainingCount: this.getUnsyncedCount(),
                authExpired: this.authExpired,
                offline: !this.isOnline(),
            };
        }

        if (resetPendingBackoff || includeFailed) {
            await this.enqueueWrite(async () => {
                if (this.disposed) {
                    return;
                }
                const targetIds = includeFailed
                    ? undefined
                    : this.entries
                          .filter((entry) => entry.status === "pending")
                          .map((entry) => entry.id);
                const nextEntries = resetEntriesForRetry(
                    this.entries,
                    targetIds,
                );
                const changed: TodoOutboxEntry[] = [];
                for (let index = 0; index < nextEntries.length; index += 1) {
                    if (
                        !entriesEqual(this.entries[index], nextEntries[index])
                    ) {
                        changed.push(nextEntries[index]);
                    }
                }
                if (changed.length > 0) {
                    await this.store.putEntries(
                        this.scope,
                        changed.map(toPersistedEntry),
                    );
                }
                if (this.disposed) {
                    return;
                }
                this.entries = nextEntries;
                this.authExpired = false;
                this.emit();
            });
        } else if (this.authExpired) {
            this.authExpired = false;
            this.emit();
        }

        if (!this.isOnline()) {
            this.scheduleNextFlush();
            return {
                sentBatches: 0,
                appliedCount: 0,
                remainingCount: this.getUnsyncedCount(),
                authExpired: this.authExpired,
                offline: true,
            };
        }

        let totalSentBatches = 0;
        let totalAppliedCount = 0;

        if (this.inflightPromise) {
            const first = await this.inflightPromise;
            totalSentBatches += first.sentBatches;
            totalAppliedCount += first.appliedCount;
            if (this.disposed || this.authExpired || !this.isOnline()) {
                return {
                    sentBatches: totalSentBatches,
                    appliedCount: totalAppliedCount,
                    remainingCount: this.getUnsyncedCount(),
                    authExpired: this.authExpired,
                    offline: !this.isOnline(),
                };
            }
        }

        const second = await this.flushInternal({
            ignoreBackoff,
            drainNewEdits: true,
        });
        return {
            sentBatches: totalSentBatches + second.sentBatches,
            appliedCount: totalAppliedCount + second.appliedCount,
            remainingCount: second.remainingCount,
            authExpired: second.authExpired,
            offline: second.offline,
        };
    }

    handleOnline(): void {
        if (this.disposed || this.authExpired || !this.isOnline()) {
            return;
        }
        const hasPending = this.entries.some(
            (entry) =>
                entry.status === "pending" &&
                !(entry.kind === "patch" && isPatchEmpty(entry.patch)),
        );
        if (!hasPending) {
            this.scheduleNextFlush();
            return;
        }
        void this.flushInternal({
            ignoreBackoff: true,
            drainNewEdits: false,
        });
    }

    handleOffline(): void {
        this.clearTimer();
        this.emit();
    }

    handleVisibilityChange(state: "visible" | "hidden"): void {
        if (this.disposed) {
            return;
        }
        if (state === "hidden") {
            this.flushKeepalive();
            return;
        }
        if (this.authExpired || !this.isOnline()) {
            return;
        }
        const hasPending = this.entries.some(
            (entry) =>
                entry.status === "pending" &&
                !(entry.kind === "patch" && isPatchEmpty(entry.patch)),
        );
        if (hasPending) {
            void this.flushInternal({
                ignoreBackoff: true,
                drainNewEdits: false,
            });
        }
    }

    handlePageHide(): void {
        this.flushKeepalive();
    }

    /**
     * Dispatches one synchronous keepalive flush (<=100 ops, <=64KB UTF-8 body)
     * for `pagehide` / `visibilitychange: hidden`.
     */
    flushKeepalive(): boolean {
        if (
            this.disposed ||
            this.isFlushing ||
            this.authExpired ||
            !this.isOnline()
        ) {
            return false;
        }

        const built = buildKeepaliveSyncBatch(this.entries, {
            now: this.now(),
            ignoreBackoff: true,
            generateOpId: this.generateOpId,
        });
        if (!built.batch) {
            return false;
        }

        const batch = built.batch;
        const sentIds = new Set(batch.sent.map((sent) => sent.id));
        const opIdUpdates: TodoOutboxEntry[] = [];
        this.entries = built.entriesWithOpIds.map((entry) => {
            if (!sentIds.has(entry.id)) {
                return entry;
            }
            opIdUpdates.push(toPersistedEntry(entry));
            return { ...entry, status: "inflight" };
        });

        this.firstChangeAt = null;
        this.lastChangeAt = null;
        this.hasRecoveredPending = false;
        this.isFlushing = true;
        this.clearTimer();
        this.emit();

        // Persist opIds best-effort without delaying the synchronous keepalive fetch.
        if (opIdUpdates.length > 0) {
            void this.enqueueWrite(() =>
                this.store.putEntries(this.scope, opIdUpdates),
            );
        }

        let requestPromise: Promise<TodoSyncResponse>;
        try {
            requestPromise = this.transport.syncTodos(
                this.scope.sheetId,
                batch.ops,
                {
                    keepalive: true,
                    canReplayWrite: () => false,
                },
            );
        } catch (error) {
            requestPromise = Promise.reject(error);
        }

        const flushPromise = (async (): Promise<TodoSyncFlushResult> => {
            let appliedCount = 0;
            try {
                const response = await requestPromise;
                appliedCount = await this.commitBatchResponse(batch, response);
            } catch (error) {
                await this.commitBatchFailure(batch, error);
            } finally {
                this.isFlushing = false;
                this.inflightPromise = null;
                this.emit();
                this.scheduleNextFlush();
            }
            return {
                sentBatches: 1,
                appliedCount,
                remainingCount: this.getUnsyncedCount(),
                authExpired: this.authExpired,
                offline: !this.isOnline(),
            };
        })();

        this.inflightPromise = flushPromise;
        return true;
    }

    private async runWithLock<T>(callback: () => Promise<T>): Promise<T> {
        if (!this.locks) {
            return callback();
        }
        let entered = false;
        try {
            return await this.locks.request(this.lockName, async () => {
                entered = true;
                return callback();
            });
        } catch (error) {
            if (entered) {
                throw error;
            }
            return callback();
        }
    }

    private flushInternal({
        ignoreBackoff,
        drainNewEdits,
    }: {
        ignoreBackoff: boolean;
        drainNewEdits: boolean;
    }): Promise<TodoSyncFlushResult> {
        if (this.inflightPromise) {
            return this.inflightPromise;
        }
        if (this.disposed || this.authExpired || !this.isOnline()) {
            this.scheduleNextFlush();
            return Promise.resolve({
                sentBatches: 0,
                appliedCount: 0,
                remainingCount: this.getUnsyncedCount(),
                authExpired: this.authExpired,
                offline: !this.isOnline(),
            });
        }

        this.clearTimer();
        this.isFlushing = true;
        this.emit();

        const runPromise = (async (): Promise<TodoSyncFlushResult> => {
            let sentBatches = 0;
            let appliedCount = 0;

            try {
                await this.init();
                await this.runWithLock(async () => {
                    while (!this.disposed && !this.authExpired && this.isOnline()) {
                        const prepared = await this.prepareNextBatch(
                            ignoreBackoff,
                        );
                        if (!prepared) {
                            break;
                        }

                        const { batch, hasMoreChunks } = prepared;
                        sentBatches += 1;

                        let response: TodoSyncResponse;
                        try {
                            response = await this.transport.syncTodos(
                                this.scope.sheetId,
                                batch.ops,
                                {
                                    canReplayWrite: () =>
                                        !this.disposed && this.canReplayWrite(),
                                },
                            );
                        } catch (error) {
                            await this.commitBatchFailure(batch, error);
                            break;
                        }

                        appliedCount += await this.commitBatchResponse(
                            batch,
                            response,
                        );

                        if (
                            !hasMoreChunks &&
                            !drainNewEdits &&
                            this.lastChangeAt !== null
                        ) {
                            // A newer edit arrived while this batch was in flight;
                            // let the normal debounce window batch any follow-up edits.
                            break;
                        }
                    }
                });
            } finally {
                this.isFlushing = false;
                this.inflightPromise = null;
                this.emit();
                this.scheduleNextFlush();
            }

            return {
                sentBatches,
                appliedCount,
                remainingCount: this.getUnsyncedCount(),
                authExpired: this.authExpired,
                offline: !this.isOnline(),
            };
        })();

        this.inflightPromise = runPromise;
        return runPromise;
    }

    private prepareNextBatch(
        ignoreBackoff: boolean,
    ): Promise<{ batch: TodoSyncBatch; hasMoreChunks: boolean } | null> {
        return this.enqueueWrite(async () => {
            if (this.disposed || this.authExpired || !this.isOnline()) {
                return null;
            }
            const built = buildSyncBatches(this.entries, {
                maxOps: TODO_SYNC_MAX_OPS,
                maxBatches: 1,
                now: this.now(),
                ignoreBackoff,
                generateOpId: this.generateOpId,
            });
            const batch = built.batches[0];
            if (!batch) {
                return null;
            }

            const sentIds = new Set(batch.sent.map((sent) => sent.id));
            const opIdUpdates: TodoOutboxEntry[] = [];
            const nextEntries = built.entriesWithOpIds.map((entry, index) => {
                if (!sentIds.has(entry.id)) {
                    return entry;
                }
                const prev = this.entries[index];
                if (!prev || prev.opId !== entry.opId) {
                    opIdUpdates.push(toPersistedEntry(entry));
                }
                return { ...entry, status: "inflight" as const };
            });

            if (opIdUpdates.length > 0) {
                await this.store.putEntries(this.scope, opIdUpdates);
            }
            if (this.disposed) {
                return null;
            }

            this.entries = nextEntries;
            this.firstChangeAt = null;
            this.lastChangeAt = null;
            this.hasRecoveredPending = false;
            this.emit();

            return {
                batch,
                hasMoreChunks: built.remainingEntries.length > 0,
            };
        });
    }

    private commitBatchResponse(
        batch: TodoSyncBatch,
        response: TodoSyncResponse,
    ): Promise<number> {
        return this.enqueueWrite(async () => {
            if (this.disposed) {
                return 0;
            }
            const currentBase = this.getBaseItems();
            const reconciled = reconcileSyncResponse(
                currentBase ?? [],
                this.entries,
                batch.sent,
                response,
                {
                    now: this.now(),
                    random: this.random,
                    maxTransientAttempts: this.maxTransientAttempts,
                },
            );

            await this.persistReconciledEntries(this.entries, reconciled.entries);
            if (this.disposed) {
                return 0;
            }

            this.entries = reconciled.entries;
            this.authExpired = false;

            if (reconciled.appliedIds.length > 0) {
                const parsedSyncedAt = Date.parse(reconciled.syncedAt);
                this.lastSavedAt =
                    Number.isFinite(parsedSyncedAt) && parsedSyncedAt > 0
                        ? parsedSyncedAt
                        : this.now();
                await this.store.setMeta(this.scope, {
                    lastSavedAt: this.lastSavedAt,
                });
            }

            const hasNotFound = response.results.some(
                (result) => result.status === "not_found",
            );
            if (
                currentBase !== undefined &&
                (reconciled.appliedIds.length > 0 ||
                    reconciled.droppedIds.length > 0 ||
                    hasNotFound)
            ) {
                this.setBaseItems(reconciled.baseItems);
            } else if (
                currentBase === undefined &&
                reconciled.appliedIds.length > 0
            ) {
                this.onBaseCacheMissing?.();
            }

            this.emit();
            return reconciled.appliedIds.length;
        });
    }

    private commitBatchFailure(
        batch: TodoSyncBatch,
        error: unknown,
    ): Promise<void> {
        return this.enqueueWrite(async () => {
            if (this.disposed) {
                return;
            }
            const reconciled = reconcileSyncFailure(
                this.entries,
                batch.sent,
                error,
                {
                    now: this.now(),
                    random: this.random,
                    maxTransientAttempts: this.maxTransientAttempts,
                },
            );

            await this.persistReconciledEntries(this.entries, reconciled.entries);
            if (this.disposed) {
                return;
            }

            this.entries = reconciled.entries;
            if (reconciled.authExpired) {
                this.authExpired = true;
            }
            this.emit();
        });
    }

    private async persistReconciledEntries(
        previousEntries: readonly TodoOutboxEntry[],
        nextEntries: readonly TodoOutboxEntry[],
    ): Promise<void> {
        const prevById = new Map<string, TodoOutboxEntry>();
        for (const entry of previousEntries) {
            prevById.set(entry.id, entry);
        }
        const nextById = new Map<string, TodoOutboxEntry>();
        const toPut: TodoOutboxEntry[] = [];

        for (const entry of nextEntries) {
            nextById.set(entry.id, entry);
            const prev = prevById.get(entry.id);
            const persisted = toPersistedEntry(entry);
            if (!prev || !entriesEqual(toPersistedEntry(prev), persisted)) {
                toPut.push(persisted);
            }
        }

        const toDelete: string[] = [];
        for (const prev of previousEntries) {
            if (!nextById.has(prev.id)) {
                toDelete.push(prev.id);
            }
        }

        if (toDelete.length > 0) {
            await this.store.deleteEntries(this.scope, toDelete);
        }
        if (toPut.length > 0) {
            await this.store.putEntries(this.scope, toPut);
        }
    }
}
