import {
    createStore,
    del,
    delMany,
    entries as idbEntries,
    keys as idbKeys,
    set,
    setMany,
    type UseStore,
} from "idb-keyval";
import logger from "@/src/utils/logger";
import {
    buildTodoOutboxKey,
    buildTodoOutboxMetaKey,
    buildTodoOutboxScopePrefix,
    parseTodoOutboxKey,
    TODO_OUTBOX_KEY_SEPARATOR,
    TODO_OUTBOX_META_PREFIX,
    type TodoOutboxEntry,
} from "@/src/utils/todoOutbox";

export const TODO_OUTBOX_DB_NAME = "tripsplit-todo-outbox";
export const TODO_OUTBOX_STORE_NAME = "entries";

export type TodoOutboxScope = {
    sheetId: string;
    ownerEmail: string;
};

export type TodoOutboxMeta = {
    lastSavedAt: number | null;
};

export type LoadedTodoOutboxScope = {
    entries: TodoOutboxEntry[];
    meta: TodoOutboxMeta;
    persistent: boolean;
};

export interface TodoOutboxStore {
    readonly persistent: boolean;
    loadScope(scope: TodoOutboxScope): Promise<LoadedTodoOutboxScope>;
    putEntry(scope: TodoOutboxScope, entry: TodoOutboxEntry): Promise<void>;
    putEntries(
        scope: TodoOutboxScope,
        entries: readonly TodoOutboxEntry[],
    ): Promise<void>;
    deleteEntry(scope: TodoOutboxScope, todoId: string): Promise<void>;
    deleteEntries(
        scope: TodoOutboxScope,
        todoIds: readonly string[],
    ): Promise<void>;
    setMeta(scope: TodoOutboxScope, meta: TodoOutboxMeta): Promise<void>;
    clearScope(scope: TodoOutboxScope): Promise<void>;
    clearOwnerScopes(ownerEmail: string): Promise<void>;
    clearOtherOwnerScopes(keepOwnerEmail: string): Promise<void>;
}

export type TodoOutboxKvBackend = {
    entries: () => Promise<[IDBValidKey, unknown][]>;
    keys: () => Promise<IDBValidKey[]>;
    set: (key: IDBValidKey, value: unknown) => Promise<void>;
    setMany: (pairs: [IDBValidKey, unknown][]) => Promise<void>;
    del: (key: IDBValidKey) => Promise<void>;
    delMany: (keys: IDBValidKey[]) => Promise<void>;
};

function cloneEntry(entry: TodoOutboxEntry): TodoOutboxEntry {
    const cloned: TodoOutboxEntry = {
        id: entry.id,
        kind: entry.kind,
        base: entry.base ? { ...entry.base } : null,
        patch: { ...entry.patch },
        rev: entry.rev,
        attempts: entry.attempts,
        status: entry.status,
        lastError: entry.lastError,
    };
    if (entry.opId !== undefined) {
        cloned.opId = entry.opId;
    }
    if (entry.nextAttemptAt !== undefined) {
        cloned.nextAttemptAt = entry.nextAttemptAt;
    }
    if (entry.createdAt !== undefined) {
        cloned.createdAt = entry.createdAt;
    }
    return cloned;
}

function isStoredOutboxEntry(value: unknown): value is TodoOutboxEntry {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.id === "string" &&
        candidate.id.length > 0 &&
        (candidate.kind === "create" ||
            candidate.kind === "patch" ||
            candidate.kind === "delete") &&
        typeof candidate.rev === "number" &&
        typeof candidate.attempts === "number" &&
        (candidate.status === "pending" ||
            candidate.status === "inflight" ||
            candidate.status === "failed" ||
            candidate.status === "dropped") &&
        typeof candidate.patch === "object" &&
        candidate.patch !== null
    );
}

function parseStoredMeta(value: unknown): TodoOutboxMeta {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return { lastSavedAt: value };
    }
    if (typeof value === "object" && value !== null) {
        const lastSavedAt = (value as { lastSavedAt?: unknown }).lastSavedAt;
        if (
            typeof lastSavedAt === "number" &&
            Number.isFinite(lastSavedAt) &&
            lastSavedAt > 0
        ) {
            return { lastSavedAt };
        }
    }
    return { lastSavedAt: null };
}

function parseMetaKey(
    key: string,
): { sheetId: string; ownerEmail: string } | null {
    if (!key.startsWith(TODO_OUTBOX_META_PREFIX)) {
        return null;
    }
    const rest = key.slice(TODO_OUTBOX_META_PREFIX.length);
    const parts = rest.split(TODO_OUTBOX_KEY_SEPARATOR);
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return null;
    }
    return { sheetId: parts[0], ownerEmail: parts[1] };
}

function readScopeFromRecords(
    records: Iterable<[unknown, unknown]>,
    scope: TodoOutboxScope,
): { entries: TodoOutboxEntry[]; meta: TodoOutboxMeta } {
    const scopePrefix = buildTodoOutboxScopePrefix(
        scope.sheetId,
        scope.ownerEmail,
    );
    const metaKey = buildTodoOutboxMetaKey(scope.sheetId, scope.ownerEmail);
    const loadedEntries: TodoOutboxEntry[] = [];
    let meta: TodoOutboxMeta = { lastSavedAt: null };

    for (const [rawKey, rawValue] of records) {
        if (typeof rawKey !== "string") {
            continue;
        }
        if (rawKey === metaKey) {
            meta = parseStoredMeta(rawValue);
            continue;
        }
        if (!rawKey.startsWith(scopePrefix)) {
            continue;
        }
        const parsedKey = parseTodoOutboxKey(rawKey);
        if (
            !parsedKey ||
            parsedKey.sheetId !== scope.sheetId.trim() ||
            parsedKey.ownerEmail !== scope.ownerEmail.trim()
        ) {
            continue;
        }
        if (isStoredOutboxEntry(rawValue)) {
            loadedEntries.push(cloneEntry(rawValue));
        }
    }

    return { entries: loadedEntries, meta };
}

function collectOtherOwnerKeys(
    allKeys: Iterable<unknown>,
    keepOwnerEmail: string,
): IDBValidKey[] {
    const trimmedOwner = keepOwnerEmail.trim();
    if (!trimmedOwner) {
        return [];
    }
    const toDelete: IDBValidKey[] = [];

    for (const rawKey of allKeys) {
        if (typeof rawKey !== "string") {
            toDelete.push(rawKey as IDBValidKey);
            continue;
        }
        const entryParts = parseTodoOutboxKey(rawKey);
        if (entryParts) {
            if (entryParts.ownerEmail !== trimmedOwner) {
                toDelete.push(rawKey);
            }
            continue;
        }
        const metaParts = parseMetaKey(rawKey);
        if (metaParts) {
            if (metaParts.ownerEmail !== trimmedOwner) {
                toDelete.push(rawKey);
            }
            continue;
        }
        toDelete.push(rawKey);
    }

    return toDelete;
}

function collectScopeKeys(
    allKeys: Iterable<unknown>,
    scope: TodoOutboxScope,
): IDBValidKey[] {
    const scopePrefix = buildTodoOutboxScopePrefix(
        scope.sheetId,
        scope.ownerEmail,
    );
    const metaKey = buildTodoOutboxMetaKey(scope.sheetId, scope.ownerEmail);
    const toDelete: IDBValidKey[] = [];

    for (const rawKey of allKeys) {
        if (typeof rawKey !== "string") {
            continue;
        }
        if (rawKey === metaKey || rawKey.startsWith(scopePrefix)) {
            toDelete.push(rawKey);
        }
    }

    return toDelete;
}

function collectOwnerKeys(
    allKeys: Iterable<unknown>,
    ownerEmail: string,
): IDBValidKey[] {
    const trimmedOwner = ownerEmail.trim();
    if (!trimmedOwner) {
        return [];
    }
    const toDelete: IDBValidKey[] = [];

    for (const rawKey of allKeys) {
        if (typeof rawKey !== "string") {
            continue;
        }
        const entryParts = parseTodoOutboxKey(rawKey);
        if (entryParts && entryParts.ownerEmail === trimmedOwner) {
            toDelete.push(rawKey);
            continue;
        }
        const metaParts = parseMetaKey(rawKey);
        if (metaParts && metaParts.ownerEmail === trimmedOwner) {
            toDelete.push(rawKey);
        }
    }

    return toDelete;
}

function createIdbKeyvalBackend(): TodoOutboxKvBackend | null {
    if (typeof indexedDB === "undefined") {
        return null;
    }
    let store: UseStore;
    try {
        store = createStore(TODO_OUTBOX_DB_NAME, TODO_OUTBOX_STORE_NAME);
    } catch (error) {
        logger.error("Could not initialize todo outbox IndexedDB store.", error);
        return null;
    }

    return {
        entries: () => idbEntries(store),
        keys: () => idbKeys(store),
        set: (key, value) => set(key, value, store),
        setMany: (pairs) => setMany(pairs, store),
        del: (key) => del(key, store),
        delMany: (keys) => delMany(keys, store),
    };
}

/**
 * Pure in-memory outbox store for unit tests or explicit non-IDB fallback.
 */
export function createInMemoryTodoOutboxStore({
    persistent = true,
}: { persistent?: boolean } = {}): TodoOutboxStore & {
    getRawKeys(): string[];
} {
    const records = new Map<string, unknown>();

    return {
        get persistent() {
            return persistent;
        },

        getRawKeys() {
            return Array.from(records.keys());
        },

        async loadScope(scope) {
            const { entries, meta } = readScopeFromRecords(
                records.entries(),
                scope,
            );
            return { entries, meta, persistent };
        },

        async putEntry(scope, entry) {
            const key = buildTodoOutboxKey(
                scope.sheetId,
                scope.ownerEmail,
                entry.id,
            );
            records.set(key, cloneEntry(entry));
        },

        async putEntries(scope, entries) {
            for (const entry of entries) {
                const key = buildTodoOutboxKey(
                    scope.sheetId,
                    scope.ownerEmail,
                    entry.id,
                );
                records.set(key, cloneEntry(entry));
            }
        },

        async deleteEntry(scope, todoId) {
            const key = buildTodoOutboxKey(
                scope.sheetId,
                scope.ownerEmail,
                todoId,
            );
            records.delete(key);
        },

        async deleteEntries(scope, todoIds) {
            for (const todoId of todoIds) {
                const key = buildTodoOutboxKey(
                    scope.sheetId,
                    scope.ownerEmail,
                    todoId,
                );
                records.delete(key);
            }
        },

        async setMeta(scope, meta) {
            const key = buildTodoOutboxMetaKey(scope.sheetId, scope.ownerEmail);
            records.set(key, { lastSavedAt: meta.lastSavedAt });
        },

        async clearScope(scope) {
            for (const key of collectScopeKeys(records.keys(), scope)) {
                records.delete(String(key));
            }
        },

        async clearOwnerScopes(ownerEmail) {
            for (const key of collectOwnerKeys(records.keys(), ownerEmail)) {
                records.delete(String(key));
            }
        },

        async clearOtherOwnerScopes(keepOwnerEmail) {
            for (const key of collectOtherOwnerKeys(
                records.keys(),
                keepOwnerEmail,
            )) {
                records.delete(String(key));
            }
        },
    };
}

/**
 * Persistent IndexedDB outbox store backed by `idb-keyval`
 * `createStore("tripsplit-todo-outbox", "entries")`.
 * Automatically falls back to an in-memory mirror (`persistent: false`)
 * if IndexedDB is unavailable or throws (e.g., private browsing or quota errors).
 */
export function createIndexedDbTodoOutboxStore(
    customBackend?: TodoOutboxKvBackend | null,
): TodoOutboxStore {
    const memory = new Map<string, unknown>();
    let backend: TodoOutboxKvBackend | null | undefined = customBackend;
    let isPersistent = customBackend !== null;

    const getBackend = (): TodoOutboxKvBackend | null => {
        if (!isPersistent) {
            return null;
        }
        if (backend === undefined) {
            backend = createIdbKeyvalBackend();
            if (!backend) {
                isPersistent = false;
            }
        }
        return backend;
    };

    const failOverToMemory = (operation: string, error: unknown) => {
        if (isPersistent) {
            logger.error(
                `Todo outbox IndexedDB ${operation} failed; falling back to in-memory store.`,
                error,
            );
        }
        isPersistent = false;
        backend = null;
    };

    return {
        get persistent() {
            getBackend();
            return isPersistent;
        },

        async loadScope(scope) {
            const kv = getBackend();
            if (kv) {
                try {
                    const all = await kv.entries();
                    const { entries, meta } = readScopeFromRecords(all, scope);
                    // Sync loaded scope into the shadow map so a mid-session
                    // failover retains everything already loaded.
                    for (const key of collectScopeKeys(memory.keys(), scope)) {
                        memory.delete(String(key));
                    }
                    for (const entry of entries) {
                        memory.set(
                            buildTodoOutboxKey(
                                scope.sheetId,
                                scope.ownerEmail,
                                entry.id,
                            ),
                            cloneEntry(entry),
                        );
                    }
                    if (meta.lastSavedAt !== null) {
                        memory.set(
                            buildTodoOutboxMetaKey(
                                scope.sheetId,
                                scope.ownerEmail,
                            ),
                            { lastSavedAt: meta.lastSavedAt },
                        );
                    }
                    return { entries, meta, persistent: true };
                } catch (error) {
                    failOverToMemory("loadScope", error);
                }
            }

            const { entries, meta } = readScopeFromRecords(
                memory.entries(),
                scope,
            );
            return { entries, meta, persistent: false };
        },

        async putEntry(scope, entry) {
            const key = buildTodoOutboxKey(
                scope.sheetId,
                scope.ownerEmail,
                entry.id,
            );
            const cloned = cloneEntry(entry);
            memory.set(key, cloned);

            const kv = getBackend();
            if (kv) {
                try {
                    await kv.set(key, cloned);
                } catch (error) {
                    failOverToMemory("putEntry", error);
                }
            }
        },

        async putEntries(scope, entries) {
            if (entries.length === 0) {
                return;
            }
            const pairs: [string, TodoOutboxEntry][] = entries.map((entry) => {
                const key = buildTodoOutboxKey(
                    scope.sheetId,
                    scope.ownerEmail,
                    entry.id,
                );
                const cloned = cloneEntry(entry);
                memory.set(key, cloned);
                return [key, cloned];
            });

            const kv = getBackend();
            if (kv) {
                try {
                    await kv.setMany(pairs);
                } catch (error) {
                    failOverToMemory("putEntries", error);
                }
            }
        },

        async deleteEntry(scope, todoId) {
            const key = buildTodoOutboxKey(
                scope.sheetId,
                scope.ownerEmail,
                todoId,
            );
            memory.delete(key);

            const kv = getBackend();
            if (kv) {
                try {
                    await kv.del(key);
                } catch (error) {
                    failOverToMemory("deleteEntry", error);
                }
            }
        },

        async deleteEntries(scope, todoIds) {
            if (todoIds.length === 0) {
                return;
            }
            const keys = todoIds.map((todoId) => {
                const key = buildTodoOutboxKey(
                    scope.sheetId,
                    scope.ownerEmail,
                    todoId,
                );
                memory.delete(key);
                return key;
            });

            const kv = getBackend();
            if (kv) {
                try {
                    await kv.delMany(keys);
                } catch (error) {
                    failOverToMemory("deleteEntries", error);
                }
            }
        },

        async setMeta(scope, meta) {
            const key = buildTodoOutboxMetaKey(scope.sheetId, scope.ownerEmail);
            const value: TodoOutboxMeta = { lastSavedAt: meta.lastSavedAt };
            memory.set(key, value);

            const kv = getBackend();
            if (kv) {
                try {
                    await kv.set(key, value);
                } catch (error) {
                    failOverToMemory("setMeta", error);
                }
            }
        },

        async clearScope(scope) {
            for (const key of collectScopeKeys(memory.keys(), scope)) {
                memory.delete(String(key));
            }

            const kv = getBackend();
            if (kv) {
                try {
                    const allKeys = await kv.keys();
                    const toDelete = collectScopeKeys(allKeys, scope);
                    if (toDelete.length > 0) {
                        await kv.delMany(toDelete);
                    }
                } catch (error) {
                    failOverToMemory("clearScope", error);
                }
            }
        },

        async clearOwnerScopes(ownerEmail) {
            for (const key of collectOwnerKeys(memory.keys(), ownerEmail)) {
                memory.delete(String(key));
            }

            const kv = getBackend();
            if (kv) {
                try {
                    const allKeys = await kv.keys();
                    const toDelete = collectOwnerKeys(allKeys, ownerEmail);
                    if (toDelete.length > 0) {
                        await kv.delMany(toDelete);
                    }
                } catch (error) {
                    failOverToMemory("clearOwnerScopes", error);
                }
            }
        },

        async clearOtherOwnerScopes(keepOwnerEmail) {
            for (const key of collectOtherOwnerKeys(
                memory.keys(),
                keepOwnerEmail,
            )) {
                memory.delete(String(key));
            }

            const kv = getBackend();
            if (kv) {
                try {
                    const allKeys = await kv.keys();
                    const toDelete = collectOtherOwnerKeys(
                        allKeys,
                        keepOwnerEmail,
                    );
                    if (toDelete.length > 0) {
                        await kv.delMany(toDelete);
                    }
                } catch (error) {
                    failOverToMemory("clearOtherOwnerScopes", error);
                }
            }
        },
    };
}

export const todoOutboxStore: TodoOutboxStore =
    createIndexedDbTodoOutboxStore();
