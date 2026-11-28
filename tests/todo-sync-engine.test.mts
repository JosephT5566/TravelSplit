import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import type { TodoItem } from "../src/types.ts";
import {
    overlayTodos,
    TODO_KEEPALIVE_MAX_BYTES,
    type TodoOutboxEntry,
    type TodoSyncOp,
    type TodoSyncOpResult,
    type TodoSyncResponse,
} from "../src/utils/todoOutbox.ts";

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
            const base = path.join(REPO_ROOT, specifier.slice(2));
            for (const candidate of [
                base,
                `${base}.ts`,
                `${base}.tsx`,
                path.join(base, "index.ts"),
            ]) {
                if (existsSync(candidate)) {
                    return {
                        url: pathToFileURL(candidate).href,
                        shortCircuit: true,
                    };
                }
            }
        }
        if (
            (specifier.startsWith("./") || specifier.startsWith("../")) &&
            context.parentURL?.startsWith("file://") &&
            !path.extname(specifier)
        ) {
            const parentDir = path.dirname(fileURLToPath(context.parentURL));
            const base = path.resolve(parentDir, specifier);
            for (const candidate of [
                `${base}.ts`,
                `${base}.tsx`,
                path.join(base, "index.ts"),
            ]) {
                if (existsSync(candidate)) {
                    return {
                        url: pathToFileURL(candidate).href,
                        shortCircuit: true,
                    };
                }
            }
        }
        return nextResolve(specifier, context);
    },
});

const { TodoApiError } = await import("../services/api.ts");
const { getTodosQueryKey } = await import("../services/todoCache.ts");
const {
    createIndexedDbTodoOutboxStore,
    createInMemoryTodoOutboxStore,
} = await import("../services/todoOutboxStore.ts");
const { TodoSyncEngine } = await import("../services/todoSyncEngine.ts");
const { createTodoSyncManager } = await import("../services/todoSyncManager.ts");

const SHEET_A = "sheet-a";
const SHEET_B = "sheet-b";
const USER_AN = "an@example.com";
const USER_BO = "bo@example.com";

type ScheduledTimer = {
    id: number;
    runAt: number;
    callback: () => void;
};

class FakeClock {
    nowMs: number;
    private nextTimerId = 1;
    private scheduled = new Map<number, ScheduledTimer>();

    constructor(initialMs = 1_732_780_000_000) {
        this.nowMs = initialMs;
    }

    now = (): number => this.nowMs;

    timers = {
        setTimeout: (callback: () => void, delayMs: number) => {
            const id = this.nextTimerId++;
            this.scheduled.set(id, {
                id,
                runAt: this.nowMs + Math.max(0, delayMs),
                callback,
            });
            return id;
        },
        clearTimeout: (handle: unknown) => {
            this.scheduled.delete(handle as number);
        },
    };

    get pendingTimerCount(): number {
        return this.scheduled.size;
    }

    async flushMicrotasks(turns = 50): Promise<void> {
        for (let i = 0; i < turns; i += 1) {
            await Promise.resolve();
        }
    }

    async advanceBy(ms: number): Promise<void> {
        const target = this.nowMs + ms;
        while (true) {
            let earliest: ScheduledTimer | null = null;
            for (const timer of this.scheduled.values()) {
                if (
                    timer.runAt <= target &&
                    (!earliest || timer.runAt < earliest.runAt)
                ) {
                    earliest = timer;
                }
            }
            if (!earliest) {
                break;
            }
            this.scheduled.delete(earliest.id);
            this.nowMs = Math.max(this.nowMs, earliest.runAt);
            earliest.callback();
            await this.flushMicrotasks();
        }
        this.nowMs = target;
        await this.flushMicrotasks();
    }
}

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
    return {
        id: "1732780000000-00000000-0000-4000-8000-000000000001",
        ownerEmail: USER_AN,
        text: "買車票",
        checked: false,
        category: "交通",
        createdAt: "2026-11-28T01:00:00.000Z",
        updatedAt: "2026-11-28T01:00:00.000Z",
        ...overrides,
    };
}

type SyncCall = {
    sheetId: string;
    ops: readonly TodoSyncOp[];
    keepalive: boolean;
};

/**
 * In-memory fake backend implementing the `POST /todos/sync` idempotent contract.
 */
function createFakeTodoServer(
    initialItems: readonly TodoItem[] = [],
    ownerEmail = USER_AN,
) {
    const items = new Map<string, TodoItem>();
    for (const item of initialItems) {
        items.set(item.id, { ...item });
    }
    let syncCounter = 0;

    return {
        items,
        applyOps(ops: readonly TodoSyncOp[]): TodoSyncResponse {
            syncCounter += 1;
            const syncedAt = new Date(
                1_732_780_100_000 + syncCounter * 1_000,
            ).toISOString();
            const results: TodoSyncOpResult[] = [];

            for (const op of ops) {
                if (op.type === "create") {
                    const existing = items.get(op.id);
                    if (existing) {
                        if (existing.ownerEmail !== ownerEmail) {
                            results.push({
                                opId: op.opId,
                                id: op.id,
                                status: "forbidden",
                            });
                        } else {
                            results.push({
                                opId: op.opId,
                                id: op.id,
                                status: "applied",
                                duplicate: true,
                                item: { ...existing },
                            });
                        }
                        continue;
                    }
                    const created: TodoItem = {
                        id: op.id,
                        ownerEmail,
                        text: op.text,
                        checked: op.checked,
                        category: op.category,
                        createdAt: syncedAt,
                        updatedAt: syncedAt,
                    };
                    items.set(created.id, created);
                    results.push({
                        opId: op.opId,
                        id: created.id,
                        status: "applied",
                        item: { ...created },
                    });
                    continue;
                }

                if (op.type === "update") {
                    const existing = items.get(op.id);
                    if (!existing) {
                        results.push({
                            opId: op.opId,
                            id: op.id,
                            status: "not_found",
                        });
                        continue;
                    }
                    const updated: TodoItem = {
                        ...existing,
                        ...(op.text !== undefined ? { text: op.text } : {}),
                        ...(op.checked !== undefined
                            ? { checked: op.checked }
                            : {}),
                        ...(op.category !== undefined
                            ? { category: op.category }
                            : {}),
                        updatedAt: syncedAt,
                    };
                    items.set(updated.id, updated);
                    results.push({
                        opId: op.opId,
                        id: updated.id,
                        status: "applied",
                        item: { ...updated },
                    });
                    continue;
                }

                // delete
                const existed = items.delete(op.id);
                results.push({
                    opId: op.opId,
                    id: op.id,
                    status: "applied",
                    deleted: true,
                    ...(existed ? {} : { alreadyGone: true }),
                });
            }

            return { results, syncedAt };
        },
        getItems(): TodoItem[] {
            return Array.from(items.values());
        },
    };
}

function createHarness(options: {
    initialBase?: TodoItem[];
    store?: ReturnType<typeof createInMemoryTodoOutboxStore>;
    onSync?: (
        call: SyncCall,
        server: ReturnType<typeof createFakeTodoServer>,
    ) => Promise<TodoSyncResponse> | TodoSyncResponse;
    cancelBaseQuery?: () => Promise<void>;
    onSetBaseItems?: (items: TodoItem[]) => void;
    initialOnline?: boolean;
    clock?: FakeClock;
    locks?: {
        request: <T>(name: string, cb: () => Promise<T> | T) => Promise<T>;
    } | null;
} = {}) {
    const clock = options.clock ?? new FakeClock();
    const store = options.store ?? createInMemoryTodoOutboxStore();
    let baseItems: TodoItem[] | undefined = options.initialBase
        ? options.initialBase.map((item) => ({ ...item }))
        : [];
    const server = createFakeTodoServer(baseItems ?? [], USER_AN);
    let online = options.initialOnline ?? true;
    const calls: SyncCall[] = [];
    let todoCounter = 0;
    let opCounter = 0;

    const transport = {
        async syncTodos(
            sheetId: string,
            ops: readonly TodoSyncOp[],
            syncOptions?: { keepalive?: boolean },
        ): Promise<TodoSyncResponse> {
            const call: SyncCall = {
                sheetId,
                ops: ops.map((op) => ({ ...op })),
                keepalive: Boolean(syncOptions?.keepalive),
            };
            calls.push(call);
            if (options.onSync) {
                return options.onSync(call, server);
            }
            return server.applyOps(ops);
        },
    };

    const engine = new TodoSyncEngine({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
        store,
        transport,
        getBaseItems: () => baseItems,
        setBaseItems: (items) => {
            baseItems = items;
            options.onSetBaseItems?.(items);
        },
        cancelBaseQuery: options.cancelBaseQuery,
        isOnline: () => online,
        now: clock.now,
        random: () => 0.5, // zero jitter (multiplier = 1.0)
        timers: clock.timers,
        locks: options.locks ?? null,
        generateTodoId: (ms) => {
            todoCounter += 1;
            return `${String(ms).padStart(13, "0")}-0000-4000-8000-${String(todoCounter).padStart(12, "0")}`;
        },
        generateOpId: () => {
            opCounter += 1;
            return `op-${opCounter}`;
        },
    });

    return {
        clock,
        store,
        server,
        calls,
        engine,
        getBase: () => baseItems,
        setBase: (next: TodoItem[]) => {
            baseItems = next;
        },
        setOnline: (value: boolean) => {
            online = value;
        },
    };
}

test("10 changes in one debounce window produce exactly 1 sync request and leave 0 pending timers", async () => {
    const initial = Array.from({ length: 10 }, (_, i) =>
        makeTodo({
            id: `173278000000${i}-0000-4000-8000-000000000001`,
            text: `項目 ${i + 1}`,
            checked: false,
        }),
    );
    const h = createHarness({ initialBase: initial });
    await h.engine.init();

    for (let i = 0; i < 10; i += 1) {
        await h.engine.update(initial[i].id, { checked: true });
        await h.clock.advanceBy(100);
    }

    // Still inside debounce window (last change was 100ms ago); base cache untouched (no optimistic write)
    assert.equal(h.calls.length, 0);
    assert.equal(h.getBase()?.every((item) => item.checked === false), true);
    assert.equal(h.engine.getSnapshot().unsyncedCount, 10);

    // Advance past 1.5s idle debounce
    await h.clock.advanceBy(1_500);

    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].ops.length, 10);
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.engine.getSnapshot().hasUnsynced, false);
    assert.equal(h.getBase()?.every((item) => item.checked === true), true);
    assert.ok((h.engine.getSnapshot().lastSavedAt ?? 0) > 0);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("check + uncheck cancels out with 0 requests and 0 pending timers", async () => {
    const item = makeTodo({ checked: false });
    const h = createHarness({ initialBase: [item] });
    await h.engine.init();

    await h.engine.update(item.id, { checked: true });
    assert.equal(h.engine.getSnapshot().unsyncedCount, 1);
    assert.equal(h.clock.pendingTimerCount, 1);

    await h.clock.advanceBy(500);
    await h.engine.update(item.id, { checked: false });

    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);

    await h.clock.advanceBy(30_000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("create + delete before sync cancels out with 0 requests and 0 pending timers", async () => {
    const h = createHarness({ initialBase: [] });
    await h.engine.init();

    const created = await h.engine.create("臨時提醒", "行李");
    assert.equal(h.engine.getSnapshot().unsyncedCount, 1);
    assert.equal(h.clock.pendingTimerCount, 1);

    await h.clock.advanceBy(300);
    await h.engine.remove(created.id);

    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);

    await h.clock.advanceBy(30_000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("maxWait (10s) forces a send under continuous edits every 1s", async () => {
    const item = makeTodo({ text: "草稿 0" });
    const h = createHarness({ initialBase: [item] });
    await h.engine.init();

    // Edit every 1000ms (always less than 1500ms debounce).
    for (let step = 1; step <= 10; step += 1) {
        await h.engine.update(item.id, { text: `草稿 ${step}` });
        if (step < 10) {
            await h.clock.advanceBy(1_000);
            assert.equal(
                h.calls.length,
                0,
                `should not send before maxWait at step ${step}`,
            );
        }
    }

    // At t = 9000ms, next change schedules 1000ms remaining until maxWait (10000ms).
    await h.clock.advanceBy(1_000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].ops[0].type, "update");
    assert.equal(
        (h.calls[0].ops[0] as { text?: string }).text,
        "草稿 10",
    );
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("transient failure backs off (5/15/45s) with the SAME opId and client id, fails on 4th strike, and manual retry succeeds", async () => {
    let failCount = 0;
    const h = createHarness({
        initialBase: [],
        onSync: (call, server) => {
            if (failCount < 4) {
                failCount += 1;
                throw new TodoApiError(
                    "Rate limited",
                    "RATE_LIMITED",
                    429,
                );
            }
            return server.applyOps(call.ops);
        },
    });
    await h.engine.init();

    const created = await h.engine.create("防曬乳", "行李");
    await h.clock.advanceBy(1_500);

    // Attempt 1 failed -> pending with 5s backoff
    assert.equal(h.calls.length, 1);
    const firstOpId = h.calls[0].ops[0].opId;
    const firstId = h.calls[0].ops[0].id;
    assert.equal(firstId, created.id);
    assert.equal(h.engine.getSnapshot().entries[0].status, "pending");
    assert.equal(h.engine.getSnapshot().entries[0].attempts, 1);
    assert.equal(h.engine.getSnapshot().nextRetryAt, h.clock.nowMs + 5_000);

    // Attempt 2 at +5s -> 15s backoff, SAME opId & id
    await h.clock.advanceBy(5_000);
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[1].ops[0].opId, firstOpId);
    assert.equal(h.calls[1].ops[0].id, firstId);
    assert.equal(h.engine.getSnapshot().entries[0].attempts, 2);

    // Attempt 3 at +15s -> 45s backoff, SAME opId & id
    await h.clock.advanceBy(15_000);
    assert.equal(h.calls.length, 3);
    assert.equal(h.calls[2].ops[0].opId, firstOpId);
    assert.equal(h.engine.getSnapshot().entries[0].attempts, 3);

    // Attempt 4 at +45s -> 4th strike transitions to failed and stops all timers
    await h.clock.advanceBy(45_000);
    assert.equal(h.calls.length, 4);
    assert.equal(h.calls[3].ops[0].opId, firstOpId);
    assert.equal(h.engine.getSnapshot().entries[0].status, "failed");
    assert.equal(h.engine.getSnapshot().lastErrorKind, "failed");
    assert.equal(h.clock.pendingTimerCount, 0);

    // Manual retry resets backoff and resends with SAME opId & id -> succeeds
    const retryResult = await h.engine.retry(created.id);
    assert.equal(retryResult.appliedCount, 1);
    assert.equal(h.calls.length, 5);
    assert.equal(h.calls[4].ops[0].opId, firstOpId);
    assert.equal(h.calls[4].ops[0].id, firstId);
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.getBase()?.length, 1);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("lost response (server applied then transport throws TIMEOUT) resends with same id/opId and produces NO duplicate", async () => {
    let simulateTimeout = true;
    const h = createHarness({
        initialBase: [],
        onSync: (call, server) => {
            // Server actually applies the create on attempt 1, then response is lost!
            const applied = server.applyOps(call.ops);
            if (simulateTimeout) {
                simulateTimeout = false;
                throw new TodoApiError("Timed out", "TIMEOUT");
            }
            return applied;
        },
    });
    await h.engine.init();

    const created = await h.engine.create("護照影本", "證件");
    await h.clock.advanceBy(1_500);

    assert.equal(h.calls.length, 1);
    assert.equal(h.server.getItems().length, 1); // server saved it
    assert.equal(h.getBase()?.length, 0); // client never got confirmation
    assert.equal(h.engine.getSnapshot().entries.length, 1);

    // Advance 5s backoff -> client resends exact same id & opId -> server returns duplicate:true
    await h.clock.advanceBy(5_000);

    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[1].ops[0].id, created.id);
    assert.equal(h.calls[1].ops[0].opId, h.calls[0].ops[0].opId);
    assert.equal(h.server.getItems().length, 1); // NO duplicate on server
    assert.equal(h.getBase()?.length, 1); // NO duplicate in base cache
    assert.equal(h.getBase()?.[0].id, created.id);
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("in-flight edit (rev) keeps the newer change for the next batch and converges base", async () => {
    const item = makeTodo({ text: "v0" });
    let resolveFirst!: (res: TodoSyncResponse) => void;
    let callNumber = 0;

    const h = createHarness({
        initialBase: [item],
        onSync: (call, server) => {
            callNumber += 1;
            const res = server.applyOps(call.ops);
            if (callNumber === 1) {
                return new Promise<TodoSyncResponse>((resolve) => {
                    resolveFirst = () => resolve(res);
                });
            }
            return res;
        },
    });
    await h.engine.init();

    // Edit v1 and trigger debounce so v1 is in-flight.
    await h.engine.update(item.id, { text: "v1" });
    await h.clock.advanceBy(1_500);
    assert.equal(h.calls.length, 1);
    assert.equal(h.engine.getSnapshot().inflight, true);
    assert.equal(h.engine.getSnapshot().statusById[item.id], "inflight");

    // Edit v2 while v1 is still in flight!
    await h.engine.update(item.id, { text: "v2" });
    assert.equal(h.engine.getSnapshot().entries[0].rev, 2);

    // Resolve v1 response: base converges to v1, outbox retains rebased patch for v2.
    resolveFirst({} as TodoSyncResponse);
    await h.clock.flushMicrotasks();

    assert.equal(h.getBase()?.[0].text, "v1");
    assert.equal(h.engine.getSnapshot().entries.length, 1);
    assert.equal(h.engine.getSnapshot().entries[0].status, "pending");
    assert.equal(h.engine.getSnapshot().entries[0].patch.text, "v2");
    assert.equal(h.calls.length, 1);

    // Overlay shows v2 immediately.
    const overlaid = overlayTodos(h.getBase()!, h.engine.getSnapshot().entries);
    assert.equal(overlaid.items[0].text, "v2");

    // Next debounce sends v2 with a fresh opId -> base converges to v2, outbox clears.
    await h.clock.advanceBy(1_500);
    assert.equal(h.calls.length, 2);
    assert.notEqual(h.calls[1].ops[0].opId, h.calls[0].ops[0].opId);
    assert.equal((h.calls[1].ops[0] as { text?: string }).text, "v2");
    assert.equal(h.getBase()?.[0].text, "v2");
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("per-op forbidden/invalid become failed (with discard) and not_found becomes dropped (with dismissDropped)", async () => {
    const itemA = makeTodo({ id: "todo-a", text: "A" });
    const itemB = makeTodo({ id: "todo-b", text: "B" });
    const itemC = makeTodo({ id: "todo-c", text: "C" });

    const h = createHarness({
        initialBase: [itemA, itemB, itemC],
        onSync: (call) => ({
            syncedAt: "2026-11-28T03:00:00.000Z",
            results: call.ops.map((op) => {
                if (op.id === "todo-a") {
                    return { opId: op.opId, id: op.id, status: "forbidden" };
                }
                if (op.id === "todo-b") {
                    return {
                        opId: op.opId,
                        id: op.id,
                        status: "invalid",
                        message: "文字格式無效",
                    };
                }
                return { opId: op.opId, id: op.id, status: "not_found" };
            }),
        }),
    });
    await h.engine.init();

    await h.engine.update("todo-a", { checked: true });
    await h.engine.update("todo-b", { text: "bad" });
    await h.engine.update("todo-c", { checked: true });
    await h.clock.advanceBy(1_500);

    const snap = h.engine.getSnapshot();
    assert.equal(snap.statusById["todo-a"], "failed");
    assert.equal(snap.statusById["todo-b"], "failed");
    assert.equal(snap.errorById["todo-b"], "文字格式無效");
    assert.equal(snap.lastErrorKind, "failed");
    assert.equal(snap.droppedCount, 1);
    assert.equal(snap.droppedNotice, "1 項已在其他裝置刪除，已移除你的變更");
    assert.equal(snap.unsyncedCount, 2); // dropped is excluded
    assert.equal(h.clock.pendingTimerCount, 0);
    // not_found also removed todo-c from base
    assert.deepEqual(
        h.getBase()?.map((t) => t.id),
        ["todo-a", "todo-b"],
    );

    await h.engine.dismissDropped();
    assert.equal(h.engine.getSnapshot().droppedCount, 0);
    assert.equal(h.engine.getSnapshot().droppedNotice, null);

    await h.engine.discard("todo-a");
    await h.engine.discard("todo-b");
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.engine.getSnapshot().hasUnsynced, false);
});

test("401 enters authExpired state without burning attempts or scheduling retries, and resumes on flushNow", async () => {
    let return401 = true;
    const h = createHarness({
        initialBase: [],
        onSync: (call, server) => {
            if (return401) {
                throw new TodoApiError("Token expired", "UNAUTHORIZED", 401);
            }
            return server.applyOps(call.ops);
        },
    });
    await h.engine.init();

    await h.engine.create("行動電源", "行李");
    await h.clock.advanceBy(1_500);

    const authSnap = h.engine.getSnapshot();
    assert.equal(authSnap.authExpired, true);
    assert.equal(authSnap.lastErrorKind, "auth");
    assert.equal(authSnap.entries.length, 1);
    assert.equal(authSnap.entries[0].status, "pending");
    assert.equal(authSnap.entries[0].attempts, 0);
    assert.equal(h.clock.pendingTimerCount, 0);

    // No retries while authExpired
    await h.clock.advanceBy(60_000);
    assert.equal(h.calls.length, 1);

    // Re-authenticated -> flushNow resumes and clears authExpired
    return401 = false;
    const res = await h.engine.flushNow();
    assert.equal(res.appliedCount, 1);
    assert.equal(h.engine.getSnapshot().authExpired, false);
    assert.equal(h.engine.getSnapshot().lastErrorKind, null);
    assert.equal(h.engine.getSnapshot().entries.length, 0);
});

test("persistence round-trip preserves entries, lastSavedAt, and normalizes recovered inflight entries on reload", async () => {
    const sharedStore = createInMemoryTodoOutboxStore();
    const h1 = createHarness({
        store: sharedStore,
        initialBase: [],
        initialOnline: false,
    });
    await h1.engine.init();

    const created = await h1.engine.create("離線新增項目", "行前");
    assert.equal(h1.calls.length, 0);
    assert.equal(h1.clock.pendingTimerCount, 0);

    // Also simulate a crash-left inflight entry in storage for a second item.
    const crashedEntry: TodoOutboxEntry = {
        id: "1732780000999-0000-4000-8000-000000000099",
        kind: "create",
        base: null,
        patch: { text: "崩潰前未確認", checked: false, category: "行前" },
        rev: 1,
        attempts: 0,
        status: "inflight",
        lastError: null,
        opId: "crashed-op-id",
        createdAt: "2024-11-28T07:46:40.999Z",
    };
    await sharedStore.putEntry(
        { sheetId: SHEET_A, ownerEmail: USER_AN },
        crashedEntry,
    );
    await sharedStore.setMeta(
        { sheetId: SHEET_A, ownerEmail: USER_AN },
        { lastSavedAt: 1_732_770_000_000 },
    );
    h1.engine.dispose();

    // Reload a brand-new engine from the same store while online.
    const h2 = createHarness({
        store: sharedStore,
        initialBase: [],
        initialOnline: true,
    });
    await h2.engine.init();

    const reloaded = h2.engine.getSnapshot();
    assert.equal(reloaded.hydrated, true);
    assert.equal(reloaded.entries.length, 2);
    assert.equal(reloaded.lastSavedAt, 1_732_770_000_000);
    assert.equal(
        reloaded.entries.every((entry) => entry.status === "pending"),
        true,
    );
    const recoveredCrash = reloaded.entries.find(
        (entry) => entry.id === crashedEntry.id,
    );
    assert.equal(recoveredCrash?.opId, "crashed-op-id");

    // Scheduled 0ms recovery timer flushes both items automatically!
    await h2.clock.advanceBy(0);
    assert.equal(h2.calls.length, 1);
    assert.equal(h2.calls[0].ops.length, 2);
    assert.equal(
        h2.calls[0].ops.some((op) => op.id === created.id),
        true,
    );
    assert.equal(
        h2.calls[0].ops.some((op) => op.opId === "crashed-op-id"),
        true,
    );
    assert.equal(h2.engine.getSnapshot().entries.length, 0);
    assert.equal(h2.clock.pendingTimerCount, 0);
});

test("copy createMany of 150 items sends 2 requests (100 + 50) in order", async () => {
    const h = createHarness({ initialBase: [] });
    await h.engine.init();

    const copyInputs = Array.from({ length: 150 }, (_, i) => ({
        text: `旅伴待辦 ${i + 1}`,
        checked: false as const,
        category: i < 50 ? "行李" : "交通",
    }));
    const entries = await h.engine.createMany(copyInputs);
    assert.equal(entries.length, 150);

    // CreatedAt timestamps are strictly monotonic
    for (let i = 1; i < entries.length; i += 1) {
        assert.ok(
            Date.parse(entries[i].createdAt!) >
                Date.parse(entries[i - 1].createdAt!),
        );
    }

    await h.clock.advanceBy(1_500);
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0].ops.length, 100);
    assert.equal(h.calls[1].ops.length, 50);
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.getBase()?.length, 150);
    assert.equal(h.clock.pendingTimerCount, 0);
});

test("online, visibilitychange visible/hidden, pagehide keepalive (<=64KB), and navigator.locks single-flight work correctly", async () => {
    const lockEvents: string[] = [];
    const locks = {
        async request<T>(name: string, cb: () => Promise<T> | T): Promise<T> {
            lockEvents.push(`acquire:${name}`);
            try {
                return await cb();
            } finally {
                lockEvents.push(`release:${name}`);
            }
        },
    };

    const h = createHarness({
        initialBase: [],
        initialOnline: false,
        locks,
    });
    await h.engine.init();

    // Queue offline changes -> 0 calls, 0 timers
    await h.engine.create("離線項目 1", "行李");
    assert.equal(h.calls.length, 0);
    assert.equal(h.clock.pendingTimerCount, 0);

    // Come online -> immediately flushes using navigator.locks
    h.setOnline(true);
    h.engine.handleOnline();
    await h.clock.flushMicrotasks();

    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].keepalive, false);
    assert.deepEqual(lockEvents, [
        `acquire:tripsplit-todo-outbox::${SHEET_A}::${USER_AN}`,
        `release:tripsplit-todo-outbox::${SHEET_A}::${USER_AN}`,
    ]);
    assert.equal(h.engine.getSnapshot().entries.length, 0);

    // Queue large CJK items exceeding 64KB total -> pagehide/hidden dispatches ONE keepalive batch <= 64KB
    const longText = "旅".repeat(400); // 1200 UTF-8 bytes each
    await h.engine.createMany(
        Array.from({ length: 70 }, (_, i) => ({
            text: `${i}-${longText}`,
            category: "行前",
        })),
    );
    const sentKeepalive = h.engine.flushKeepalive();
    assert.equal(sentKeepalive, true);

    // Immediately firing pagehide while keepalive is in flight does NOT double-send
    h.engine.handlePageHide();
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[1].keepalive, true);
    const keepaliveBodyBytes = Buffer.byteLength(
        JSON.stringify({ ops: h.calls[1].ops }),
        "utf8",
    );
    assert.ok(keepaliveBodyBytes <= TODO_KEEPALIVE_MAX_BYTES);
    assert.ok(h.calls[1].ops.length < 70);

    await h.clock.flushMicrotasks();
    // Remaining items stay in outbox and flush when page returns visible
    assert.ok(h.engine.getSnapshot().entries.length > 0);
    h.engine.handleVisibilityChange("visible");
    await h.clock.flushMicrotasks();
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.getBase()?.length, 71);
});

test("refetch replacing base preserves unsynced overlay and reconcileWithBase marks vanished patches dropped", async () => {
    const keepItem = makeTodo({ id: "todo-keep", text: "原文字", checked: false });
    const vanishItem = makeTodo({ id: "todo-vanish", text: "別處已刪", checked: false });
    const h = createHarness({
        initialBase: [keepItem, vanishItem],
        initialOnline: false,
    });
    await h.engine.init();

    await h.engine.update("todo-keep", { checked: true });
    await h.engine.update("todo-vanish", { text: "我的修改" });
    const localNew = await h.engine.create("本地新增", "交通");

    // Simulate a refetch replacing base with updated server state (vanishItem deleted elsewhere, keepItem text updated elsewhere).
    const refetchedBase: TodoItem[] = [
        { ...keepItem, text: "他機改的文字", updatedAt: "2026-11-28T05:00:00.000Z" },
    ];
    h.setBase(refetchedBase);
    await h.engine.reconcileWithBase(refetchedBase);

    const overlaid = overlayTodos(refetchedBase, h.engine.getSnapshot().entries, {
        ownerEmail: USER_AN,
    });
    // keepItem keeps server's new text AND overlays our unsynced checked:true!
    assert.equal(overlaid.items.length, 2);
    assert.equal(overlaid.items[0].id, "todo-keep");
    assert.equal(overlaid.items[0].text, "他機改的文字");
    assert.equal(overlaid.items[0].checked, true);
    // localNew is still overlaid!
    assert.equal(overlaid.items[1].id, localNew.id);
    // vanishItem became dropped with one-time notice
    assert.equal(h.engine.getSnapshot().droppedCount, 1);
    assert.equal(
        h.engine.getSnapshot().droppedNotice,
        "1 項已在其他裝置刪除，已移除你的變更",
    );
});

test("IndexedDB store failover flips persistent to false without losing queued entries", async () => {
    const backing = new Map<string, unknown>();
    let failWrites = false;

    const fakeBackend = {
        async entries(): Promise<[IDBValidKey, unknown][]> {
            return Array.from(backing.entries());
        },
        async keys(): Promise<IDBValidKey[]> {
            return Array.from(backing.keys());
        },
        async set(key: IDBValidKey, value: unknown): Promise<void> {
            if (failWrites) {
                throw new Error("QuotaExceededError");
            }
            backing.set(String(key), value);
        },
        async setMany(pairs: [IDBValidKey, unknown][]): Promise<void> {
            if (failWrites) {
                throw new Error("QuotaExceededError");
            }
            for (const [k, v] of pairs) {
                backing.set(String(k), v);
            }
        },
        async del(key: IDBValidKey): Promise<void> {
            backing.delete(String(key));
        },
        async delMany(keys: IDBValidKey[]): Promise<void> {
            for (const k of keys) {
                backing.delete(String(k));
            }
        },
    };

    const store = createIndexedDbTodoOutboxStore(fakeBackend);
    const clock = new FakeClock();
    const server = createFakeTodoServer([], USER_AN);
    let base: TodoItem[] = [];
    const engine = new TodoSyncEngine({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
        store,
        transport: { syncTodos: async (_s, ops) => server.applyOps(ops) },
        getBaseItems: () => base,
        setBaseItems: (items) => {
            base = items;
        },
        isOnline: () => false,
        now: clock.now,
        timers: clock.timers,
        locks: null,
    });

    await engine.init();
    assert.equal(engine.getSnapshot().persistent, true);

    await engine.create("寫入成功", "行前");
    assert.equal(engine.getSnapshot().persistent, true);
    assert.equal(engine.getSnapshot().entries.length, 1);

    // Mid-session IDB quota failure -> flips persistent=false but keeps both entries in memory
    failWrites = true;
    await engine.create("記憶體退回", "行前");
    assert.equal(engine.getSnapshot().persistent, false);
    assert.equal(engine.getSnapshot().entries.length, 2);
});

test("scope isolation and sign-out plumbing: other owners cleared and never sent; same owner's other-sheet outbox preserved; passive sign-out preserves outbox; explicit sign-out flushes then clears only after confirmation", async () => {
    const store = createInMemoryTodoOutboxStore();
    const queryClient = new QueryClient();
    const clock = new FakeClock();
    let activeSheet: string | null = SHEET_A;
    let activeEmail: string | null = USER_AN;
    let online = false;

    const sentCalls: Array<{ sheetId: string; ops: readonly TodoSyncOp[] }> = [];
    const server = createFakeTodoServer([], USER_AN);

    const manager = createTodoSyncManager({
        store,
        queryClient,
        transport: {
            async syncTodos(sheetId, ops) {
                sentCalls.push({ sheetId, ops });
                return server.applyOps(ops);
            },
        },
        getActiveSheetId: () => activeSheet,
        getStoredUserEmail: () => activeEmail,
        isOnline: () => online,
        now: clock.now,
        random: () => 0.5,
        timers: clock.timers,
        locks: null,
        attachBrowserEvents: false,
    });

    // 1. User A creates an offline entry on sheet-a.
    queryClient.setQueryData(getTodosQueryKey(SHEET_A, USER_AN), []);
    const engineA = (await manager.activateScope({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
    }))!;
    await engineA.create("小安的待辦", "行前");
    assert.equal(engineA.getUnsyncedCount(), 1);

    // 2. Passive sign-out (token expiry): disposes engine but MUST NOT clear outbox!
    activeEmail = null;
    await manager.activateScope(null);
    assert.equal(manager.getActiveEngine(), null);
    const afterPassive = await store.loadScope({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
    });
    assert.equal(afterPassive.entries.length, 1);

    // 3. Same user signs back in on same sheet -> entry is STILL there!
    activeEmail = USER_AN;
    const engineARestored = (await manager.activateScope({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
    }))!;
    assert.equal(engineARestored.getUnsyncedCount(), 1);

    // 4. Explicit sign-out attempt while offline -> does NOT clear outbox, reports remainingCount = 1.
    const offlineSignOut = await manager.attemptSignOutFlush({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
    });
    assert.deepEqual(offlineSignOut, { flushed: false, remainingCount: 1 });
    assert.equal(sentCalls.length, 0);
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_AN }))
            .entries.length,
        1,
    );

    // 5. Explicit sign-out confirmed -> clears User A's outbox!
    await manager.clearOutboxAfterConfirmedSignOut(USER_AN);
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_AN }))
            .entries.length,
        0,
    );

    // 6. Seed User A's entries across sheet-a and sheet-b, then sign in as User B on sheet-a (online):
    // User A's entries on ALL sheets are cleared and NEVER sent!
    const engineA2 = (await manager.activateScope({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
    }))!;
    await engineA2.create("小安在 A 的機密待辦", "證件");
    activeSheet = SHEET_B;
    queryClient.setQueryData(getTodosQueryKey(SHEET_B, USER_AN), []);
    const engineASheetB = (await manager.activateScope({
        sheetId: SHEET_B,
        ownerEmail: USER_AN,
    }))!;
    await engineASheetB.create("小安在 B 的機密待辦", "證件");
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_AN }))
            .entries.length,
        1,
    );
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_B, ownerEmail: USER_AN }))
            .entries.length,
        1,
    );

    online = true;
    activeSheet = SHEET_A;
    activeEmail = USER_BO;
    queryClient.setQueryData(getTodosQueryKey(SHEET_A, USER_BO), []);
    const engineB = (await manager.activateScope({
        sheetId: SHEET_A,
        ownerEmail: USER_BO,
    }))!;
    await clock.advanceBy(10_000);

    assert.equal(sentCalls.length, 0);
    assert.equal(engineB.getUnsyncedCount(), 0);
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_AN }))
            .entries.length,
        0,
    );
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_B, ownerEmail: USER_AN }))
            .entries.length,
        0,
    );

    // 7. Switching sheet to sheet-b preserves User B's unsynced sheet-a entries without sending them to sheet-b;
    // switching back to sheet-a flushes them to sheet-a.
    online = false;
    await engineB.create("小博在 A 的待辦", "行李");
    online = true;
    activeSheet = SHEET_B;
    queryClient.setQueryData(getTodosQueryKey(SHEET_B, USER_BO), []);
    const engineBSheetB = (await manager.activateScope({
        sheetId: SHEET_B,
        ownerEmail: USER_BO,
    }))!;
    await clock.advanceBy(10_000);

    assert.equal(sentCalls.length, 0);
    assert.equal(engineBSheetB.getUnsyncedCount(), 0);
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_BO }))
            .entries.length,
        1,
    );

    // Returning to sheet-a recovers and flushes User B's preserved sheet-a outbox.
    activeSheet = SHEET_A;
    const engineBBackOnA = (await manager.activateScope({
        sheetId: SHEET_A,
        ownerEmail: USER_BO,
    }))!;
    await clock.advanceBy(0);

    assert.equal(sentCalls.length, 1);
    assert.equal(sentCalls[0].sheetId, SHEET_A);
    assert.equal(engineBBackOnA.getUnsyncedCount(), 0);
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_BO }))
            .entries.length,
        0,
    );

    // 8. Explicit sign-out when online flushes pending changes automatically -> flushed: true, remainingCount: 0!
    activeSheet = SHEET_B;
    const engineBSheetB2 = (await manager.activateScope({
        sheetId: SHEET_B,
        ownerEmail: USER_BO,
    }))!;
    await engineBSheetB2.create("登出前自動送出", "行前");
    const onlineSignOut = await manager.attemptSignOutFlush({
        sheetId: SHEET_B,
        ownerEmail: USER_BO,
    });
    assert.deepEqual(onlineSignOut, { flushed: true, remainingCount: 0 });
    assert.equal(sentCalls.length, 2);
    assert.equal(sentCalls[1].sheetId, SHEET_B);
    manager.disposeActiveEngine();
});

test("clearOtherOwnerScopes removes only other owners' entries and meta keys while preserving all sheets of keepOwnerEmail", async () => {
    const backing = new Map<string, unknown>();
    const fakeBackend = {
        async entries(): Promise<[IDBValidKey, unknown][]> {
            return Array.from(backing.entries());
        },
        async keys(): Promise<IDBValidKey[]> {
            return Array.from(backing.keys());
        },
        async set(key: IDBValidKey, value: unknown): Promise<void> {
            backing.set(String(key), value);
        },
        async setMany(pairs: [IDBValidKey, unknown][]): Promise<void> {
            for (const [k, v] of pairs) {
                backing.set(String(k), v);
            }
        },
        async del(key: IDBValidKey): Promise<void> {
            backing.delete(String(key));
        },
        async delMany(keys: IDBValidKey[]): Promise<void> {
            for (const k of keys) {
                backing.delete(String(k));
            }
        },
    };
    const store = createIndexedDbTodoOutboxStore(fakeBackend);
    const makeEntry = (id: string, text: string): TodoOutboxEntry => ({
        id,
        kind: "create",
        base: null,
        patch: { text, checked: false, category: "行前" },
        rev: 1,
        attempts: 0,
        status: "pending",
        lastError: null,
        createdAt: "2026-11-28T01:00:00.000Z",
    });

    await store.putEntry({ sheetId: SHEET_A, ownerEmail: USER_AN }, makeEntry("t-an-a", "安 A"));
    await store.setMeta({ sheetId: SHEET_A, ownerEmail: USER_AN }, { lastSavedAt: 1001 });
    await store.putEntry({ sheetId: SHEET_B, ownerEmail: USER_AN }, makeEntry("t-an-b", "安 B"));
    await store.setMeta({ sheetId: SHEET_B, ownerEmail: USER_AN }, { lastSavedAt: 1002 });
    await store.putEntry({ sheetId: SHEET_A, ownerEmail: USER_BO }, makeEntry("t-bo-a", "博 A"));
    await store.setMeta({ sheetId: SHEET_A, ownerEmail: USER_BO }, { lastSavedAt: 2001 });
    await store.putEntry({ sheetId: SHEET_B, ownerEmail: USER_BO }, makeEntry("t-bo-b", "博 B"));
    await store.setMeta({ sheetId: SHEET_B, ownerEmail: USER_BO }, { lastSavedAt: 2002 });
    backing.set("corrupt-stray-key", { junk: true });

    await store.clearOtherOwnerScopes(USER_AN);

    const anA = await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_AN });
    const anB = await store.loadScope({ sheetId: SHEET_B, ownerEmail: USER_AN });
    const boA = await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_BO });
    const boB = await store.loadScope({ sheetId: SHEET_B, ownerEmail: USER_BO });

    assert.deepEqual(anA.entries.map((e) => e.id), ["t-an-a"]);
    assert.equal(anA.meta.lastSavedAt, 1001);
    assert.deepEqual(anB.entries.map((e) => e.id), ["t-an-b"]);
    assert.equal(anB.meta.lastSavedAt, 1002);
    assert.equal(boA.entries.length, 0);
    assert.equal(boA.meta.lastSavedAt, null);
    assert.equal(boB.entries.length, 0);
    assert.equal(boB.meta.lastSavedAt, null);
    assert.equal(backing.has("corrupt-stray-key"), false);
});

test("TodoSyncEngine and TodoSyncManager cancel in-flight GET /todos before sending and before setBaseItems on commit", async () => {
    // Part A: verify exact ordering of cancelBaseQuery before send and before setBaseItems.
    const item = makeTodo({ id: "t-cancel-order", checked: false });
    const events: string[] = [];
    let releaseFirstCancel!: () => void;
    let releaseSecondCancel!: () => void;
    let cancelCount = 0;

    const h = createHarness({
        initialBase: [item],
        cancelBaseQuery: () => {
            cancelCount += 1;
            const seq = cancelCount;
            events.push(`cancel:start:${seq}`);
            return new Promise<void>((resolve) => {
                const finish = () => {
                    events.push(`cancel:end:${seq}`);
                    resolve();
                };
                if (seq === 1) {
                    releaseFirstCancel = finish;
                } else {
                    releaseSecondCancel = finish;
                }
            });
        },
        onSync: (call, server) => {
            events.push("sync:send");
            return server.applyOps(call.ops);
        },
        onSetBaseItems: () => {
            events.push("base:set");
        },
    });
    await h.engine.init();

    await h.engine.update(item.id, { checked: true });
    const flushPromise = h.engine.flushNow();
    await h.clock.flushMicrotasks();

    // Sync must NOT be sent until pre-send cancelBaseQuery settles.
    assert.deepEqual(events, ["cancel:start:1"]);
    assert.equal(h.calls.length, 0);

    releaseFirstCancel();
    await h.clock.flushMicrotasks();

    // setBaseItems must NOT be called until commit cancelBaseQuery settles.
    assert.deepEqual(events, [
        "cancel:start:1",
        "cancel:end:1",
        "sync:send",
        "cancel:start:2",
    ]);

    releaseSecondCancel();
    await flushPromise;

    assert.deepEqual(events, [
        "cancel:start:1",
        "cancel:end:1",
        "sync:send",
        "cancel:start:2",
        "cancel:end:2",
        "base:set",
    ]);

    // Part B: real QueryClient + TodoSyncManager cancels stale GET /todos on reconnect
    // and preserves dataUpdatedAt on setBaseItems.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const clock = new FakeClock(1_732_780_500_000);
    const store = createInMemoryTodoOutboxStore();
    const queryKey = getTodosQueryKey(SHEET_A, USER_AN);
    const initialUpdatedAt = 1_732_780_400_000;
    const staleItem = makeTodo({ id: "t-race-get", checked: false });
    const server = createFakeTodoServer([staleItem], USER_AN);
    queryClient.setQueryData<TodoItem[]>(queryKey, [staleItem], {
        updatedAt: initialUpdatedAt,
    });

    let online = false;
    const manager = createTodoSyncManager({
        store,
        queryClient,
        transport: {
            async syncTodos(_sheetId, ops) {
                return server.applyOps(ops);
            },
        },
        getActiveSheetId: () => SHEET_A,
        getStoredUserEmail: () => USER_AN,
        isOnline: () => online,
        now: clock.now,
        random: () => 0.5,
        timers: clock.timers,
        locks: null,
        attachBrowserEvents: false,
    });

    const engine = (await manager.activateScope({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
    }))!;
    await engine.update(staleItem.id, { checked: true });

    // Start an in-flight GET /todos (simulating refetchOnReconnect) that would return stale data.
    let resolveStaleGet!: (items: TodoItem[]) => void;
    let getAborted = false;
    const staleGetPromise = queryClient
        .fetchQuery({
            queryKey,
            queryFn: ({ signal }) =>
                new Promise<TodoItem[]>((resolve) => {
                    signal.addEventListener("abort", () => {
                        getAborted = true;
                    });
                    resolveStaleGet = resolve;
                }),
        })
        .catch(() => null);

    // Come online: handleOnline flushes POST /todos/sync and cancels the stale GET /todos.
    online = true;
    engine.handleOnline();
    await clock.flushMicrotasks();

    assert.equal(getAborted, true);
    // Even if the stale network response resolves after sync committed, cache must NOT revert.
    resolveStaleGet([{ ...staleItem, checked: false }]);
    await staleGetPromise;
    await clock.flushMicrotasks();

    const cached = queryClient.getQueryData<TodoItem[]>(queryKey);
    assert.equal(cached?.[0].checked, true);
    assert.equal(
        queryClient.getQueryState(queryKey)?.dataUpdatedAt,
        initialUpdatedAt,
    );
    manager.disposeActiveEngine();
});

test("flushKeepalive 401 does not set authExpired and returns entries to pending without burning attempts", async () => {
    let keepaliveCalls = 0;
    let foregroundCalls = 0;

    const h = createHarness({
        initialBase: [],
        onSync: (call, server) => {
            if (call.keepalive) {
                keepaliveCalls += 1;
                throw new TodoApiError("Token expired", "UNAUTHORIZED", 401);
            }
            foregroundCalls += 1;
            return server.applyOps(call.ops);
        },
    });
    await h.engine.init();

    await h.engine.create("背景編輯項目", "行李");
    h.engine.handleVisibilityChange("hidden");
    await h.clock.flushMicrotasks();

    assert.equal(keepaliveCalls, 1);
    const afterKeepalive401 = h.engine.getSnapshot();
    assert.equal(afterKeepalive401.authExpired, false);
    assert.equal(afterKeepalive401.lastErrorKind, null);
    assert.equal(afterKeepalive401.entries.length, 1);
    assert.equal(afterKeepalive401.entries[0].status, "pending");
    assert.equal(afterKeepalive401.entries[0].attempts, 0);

    // Returning to foreground triggers normal sync (which runs apiFetch token refresh) and succeeds.
    h.engine.handleVisibilityChange("visible");
    await h.clock.flushMicrotasks();

    assert.equal(foregroundCalls, 1);
    assert.equal(h.engine.getSnapshot().entries.length, 0);
    assert.equal(h.engine.getSnapshot().authExpired, false);
    assert.equal(h.getBase()?.length, 1);
});

test("flushKeepalive skips persistence after dispose or rev change and preserves inflight state across concurrent local edits", async () => {
    const scope = { sheetId: SHEET_A, ownerEmail: USER_AN };

    // Sub-case A: update reverts entry to null (awaiting deleteEntry) while flushKeepalive runs synchronously.
    {
        const backing = createInMemoryTodoOutboxStore();
        let holdNextDelete = false;
        let releaseDelete!: () => void;
        const wrappedStore: ReturnType<typeof createInMemoryTodoOutboxStore> = {
            ...backing,
            get persistent() {
                return backing.persistent;
            },
            deleteEntry: async (s, id) => {
                if (holdNextDelete) {
                    holdNextDelete = false;
                    await new Promise<void>((resolve) => {
                        releaseDelete = resolve;
                    });
                }
                return backing.deleteEntry(s, id);
            },
        };

        const item = makeTodo({ id: "t-ka-revert", checked: false });
        let resolveKeepalive!: () => void;
        const h = createHarness({
            store: wrappedStore,
            initialBase: [item],
            onSync: (call, server) => {
                const res = server.applyOps(call.ops);
                if (call.keepalive) {
                    return new Promise<TodoSyncResponse>((resolve) => {
                        resolveKeepalive = () => resolve(res);
                    });
                }
                return res;
            },
        });
        await h.engine.init();

        await h.engine.update(item.id, { checked: true });
        holdNextDelete = true;
        const revertPromise = h.engine.update(item.id, { checked: false });
        await h.clock.flushMicrotasks(5);

        // Fire keepalive while update(checked: false) is suspended awaiting deleteEntry.
        assert.equal(h.engine.flushKeepalive(), true);
        assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0].keepalive, true);

        // Resume deleteEntry: update must see inflight state and retain rev:2 inflight empty-patch entry.
        releaseDelete();
        const revertResult = await revertPromise;
        await h.clock.flushMicrotasks();

        assert.ok(revertResult);
        assert.equal(revertResult.rev, 2);
        assert.equal(revertResult.status, "inflight");
        assert.deepEqual(revertResult.patch, {});

        // flushKeepalive's queued putEntries must NOT have overwritten rev:2 in IDB with stale rev:1.
        const storedBeforeCommit = await backing.loadScope(scope);
        assert.equal(storedBeforeCommit.entries.length, 1);
        assert.equal(storedBeforeCommit.entries[0].rev, 2);

        // When keepalive response arrives (server applied checked:true), engine rebases to send checked:false.
        resolveKeepalive();
        await h.clock.flushMicrotasks();

        const snapAfterCommit = h.engine.getSnapshot();
        assert.equal(snapAfterCommit.entries.length, 1);
        assert.equal(snapAfterCommit.entries[0].status, "pending");
        assert.deepEqual(snapAfterCommit.entries[0].patch, { checked: false });

        // Next debounce converges server and base back to checked:false.
        await h.clock.advanceBy(1_500);
        assert.equal(h.server.getItems()[0].checked, false);
        assert.equal(h.getBase()?.[0].checked, false);
        assert.equal(h.engine.getSnapshot().entries.length, 0);
    }

    // Sub-case B: update writes rev:2 (awaiting putEntry) while flushKeepalive sends rev:1.
    {
        const backing = createInMemoryTodoOutboxStore();
        let holdNextPut = false;
        let releasePut!: () => void;
        const wrappedStore: ReturnType<typeof createInMemoryTodoOutboxStore> = {
            ...backing,
            get persistent() {
                return backing.persistent;
            },
            putEntry: async (s, entry) => {
                if (holdNextPut) {
                    holdNextPut = false;
                    await new Promise<void>((resolve) => {
                        releasePut = resolve;
                    });
                }
                return backing.putEntry(s, entry);
            },
        };

        const item = makeTodo({ id: "t-ka-edit", text: "v0" });
        let resolveKeepalive!: () => void;
        const h = createHarness({
            store: wrappedStore,
            initialBase: [item],
            onSync: (call, server) => {
                const res = server.applyOps(call.ops);
                if (call.keepalive) {
                    return new Promise<TodoSyncResponse>((resolve) => {
                        resolveKeepalive = () => resolve(res);
                    });
                }
                return res;
            },
        });
        await h.engine.init();

        await h.engine.update(item.id, { text: "v1" });
        holdNextPut = true;
        const editV2Promise = h.engine.update(item.id, { text: "v2" });
        await h.clock.flushMicrotasks(5);

        assert.equal(h.engine.flushKeepalive(), true);
        releasePut();
        const editV2 = await editV2Promise;
        await h.clock.flushMicrotasks();

        // In-memory entry stays inflight at rev:2, and IDB retains rev:2 (not clobbered by rev:1).
        assert.equal(editV2?.rev, 2);
        assert.equal(editV2?.status, "inflight");
        assert.equal(h.engine.getSnapshot().entries[0].status, "inflight");
        assert.equal(h.engine.getSnapshot().entries[0].rev, 2);
        const stored = await backing.loadScope(scope);
        assert.equal(stored.entries[0].rev, 2);
        assert.equal(stored.entries[0].patch.text, "v2");

        resolveKeepalive();
        await h.clock.flushMicrotasks();
        assert.equal(h.engine.getSnapshot().entries[0].patch.text, "v2");
    }

    // Sub-case C: dispose + sign-out clear before flushKeepalive's queued putEntries runs must not resurrect IDB entries.
    {
        const backing = createInMemoryTodoOutboxStore();
        let holdNextPut = false;
        let releasePut!: () => void;
        const wrappedStore: ReturnType<typeof createInMemoryTodoOutboxStore> = {
            ...backing,
            get persistent() {
                return backing.persistent;
            },
            putEntry: async (s, entry) => {
                if (holdNextPut) {
                    holdNextPut = false;
                    await new Promise<void>((resolve) => {
                        releasePut = resolve;
                    });
                }
                return backing.putEntry(s, entry);
            },
        };

        const item = makeTodo({ id: "t-ka-dispose", text: "v0" });
        const h = createHarness({
            store: wrappedStore,
            initialBase: [item],
            onSync: () => new Promise<TodoSyncResponse>(() => {}),
        });
        await h.engine.init();

        await h.engine.update(item.id, { text: "v1" });
        // Block writeChain with a second pending write.
        holdNextPut = true;
        const blockedCreate = h.engine.create("第二筆", "行李");
        await h.clock.flushMicrotasks(5);

        // Queue flushKeepalive's opId persistence behind the blocked write, then dispose and clear store.
        assert.equal(h.engine.flushKeepalive(), true);
        h.engine.dispose();
        await backing.clearOwnerScopes(USER_AN);
        releasePut();
        await blockedCreate;
        await h.clock.flushMicrotasks();

        // Only the already-in-flight putEntry could have touched backing before dispose check;
        // verify t-ka-dispose (rev:1 from flushKeepalive) was NEVER resurrected into backing.
        const storedAfterDispose = await backing.loadScope(scope);
        assert.equal(
            storedAfterDispose.entries.some((e) => e.id === item.id),
            false,
        );
    }
});

test("flushNow and handleOnline respect backoff after a transient per-op result instead of bursting 4 attempts", async () => {
    const item = makeTodo({ id: "t-missing-op", checked: false });
    const h = createHarness({
        initialBase: [item],
        onSync: () => ({
            syncedAt: "2026-11-28T06:00:00.000Z",
            results: [], // omit op -> per-op transient failure
        }),
    });
    await h.engine.init();

    await h.engine.update(item.id, { checked: true });
    const first = await h.engine.flushNow();

    assert.equal(first.sentBatches, 1);
    assert.equal(h.calls.length, 1);
    assert.equal(h.engine.getSnapshot().entries[0].status, "pending");
    assert.equal(h.engine.getSnapshot().entries[0].attempts, 1);
    assert.equal(
        h.engine.getSnapshot().entries[0].nextAttemptAt,
        h.clock.nowMs + 5_000,
    );

    // Coming online while backing off sends at most 1 attempt (not a 4-attempt burst).
    h.engine.handleOnline();
    await h.clock.flushMicrotasks();

    assert.equal(h.calls.length, 2);
    assert.equal(h.engine.getSnapshot().entries[0].status, "pending");
    assert.equal(h.engine.getSnapshot().entries[0].attempts, 2);
    assert.equal(
        h.engine.getSnapshot().entries[0].nextAttemptAt,
        h.clock.nowMs + 15_000,
    );
});

test("reconcileWithBase rebases non-inflight patches onto refetched base, persists to store, and allows subsequent uncheck/revert", async () => {
    const scope = { sheetId: SHEET_A, ownerEmail: USER_AN };
    const item1 = makeTodo({ id: "t-rebase-1", text: "一號", checked: false });
    const item2 = makeTodo({ id: "t-rebase-2", text: "A", checked: false });
    const h = createHarness({
        initialBase: [item1, item2],
        initialOnline: false,
    });
    await h.engine.init();

    await h.engine.update(item1.id, { checked: true });
    await h.engine.update(item2.id, { checked: true });

    // Refetch shows Device 2 already checked item1, and renamed item2 from "A" -> "B".
    const refetchedBase: TodoItem[] = [
        { ...item1, checked: true, updatedAt: "2026-11-28T06:00:00.000Z" },
        { ...item2, text: "B", checked: false, updatedAt: "2026-11-28T06:00:00.000Z" },
    ];
    h.setBase(refetchedBase);
    await h.engine.reconcileWithBase(refetchedBase);

    // item1 became empty and was dropped from snapshot + store; item2 rebased base.text to "B" in snapshot + store.
    assert.deepEqual(
        h.engine.getSnapshot().entries.map((e) => e.id),
        [item2.id],
    );
    assert.equal(h.engine.getSnapshot().entries[0].base?.text, "B");

    const stored = await h.store.loadScope(scope);
    assert.deepEqual(
        stored.entries.map((e) => e.id),
        [item2.id],
    );
    assert.equal(stored.entries[0].base?.text, "B");

    // Subsequent local edits work against the rebased base instead of snapping back:
    const unchecked1 = await h.engine.update(item1.id, { checked: false });
    assert.ok(unchecked1);
    assert.deepEqual(unchecked1.patch, { checked: false });
    assert.equal(unchecked1.base?.checked, true);

    const edited2 = await h.engine.update(item2.id, { text: "A" });
    assert.ok(edited2);
    assert.deepEqual(edited2.patch, { text: "A", checked: true });
    assert.equal(edited2.base?.text, "B");
});

test("commitBatchResponse records lastSavedAt from client clock rather than server syncedAt under clock skew", async () => {
    const clock = new FakeClock(1_732_780_000_000);
    let serverSyncedAt = new Date(clock.nowMs - 3_600_000).toISOString(); // server 1h behind client
    const h = createHarness({
        clock,
        initialBase: [],
        onSync: (call, server) => ({
            ...server.applyOps(call.ops),
            syncedAt: serverSyncedAt,
        }),
    });
    await h.engine.init();

    await h.engine.create("時鐘偏移測試 1", "行前");
    await h.clock.advanceBy(1_500);
    assert.equal(h.engine.getSnapshot().lastSavedAt, clock.nowMs);
    assert.equal(
        (await h.store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_AN })).meta
            .lastSavedAt,
        clock.nowMs,
    );

    // Server 1h ahead of client -> still uses client clock.
    serverSyncedAt = new Date(clock.nowMs + 3_600_000).toISOString();
    await h.engine.create("時鐘偏移測試 2", "行前");
    await h.clock.advanceBy(1_500);
    assert.equal(h.engine.getSnapshot().lastSavedAt, clock.nowMs);
});

test("flushNow and retry preserve failed and authExpired state when offline", async () => {
    const scope = { sheetId: SHEET_A, ownerEmail: USER_AN };

    // 1. Permanently failed entry (403) must stay failed across offline flushNow/retry and not auto-retry on reconnect.
    const item = makeTodo({ id: "t-perm-offline", checked: false });
    const hFailed = createHarness({
        initialBase: [item],
        onSync: () => {
            throw new TodoApiError("Forbidden", "FORBIDDEN", 403);
        },
    });
    await hFailed.engine.init();

    await hFailed.engine.update(item.id, { checked: true });
    await hFailed.clock.advanceBy(1_500);
    assert.equal(hFailed.calls.length, 1);
    assert.equal(hFailed.engine.getSnapshot().entries[0].status, "failed");
    assert.equal(
        hFailed.engine.getSnapshot().entries[0].lastError,
        "沒有權限修改這個待辦",
    );

    // Go offline and invoke sign-out flushNow({ includeFailed: true }) and retry(id).
    hFailed.setOnline(false);
    const offlineFlush = await hFailed.engine.flushNow({ includeFailed: true });
    assert.equal(offlineFlush.offline, true);
    assert.equal(hFailed.engine.getSnapshot().entries[0].status, "failed");
    assert.equal(
        hFailed.engine.getSnapshot().entries[0].lastError,
        "沒有權限修改這個待辦",
    );

    const offlineRetry = await hFailed.engine.retry(item.id);
    assert.equal(offlineRetry.offline, true);
    assert.equal(hFailed.engine.getSnapshot().entries[0].status, "failed");
    assert.equal(
        (await hFailed.store.loadScope(scope)).entries[0].status,
        "failed",
    );

    // Coming back online must NOT auto-retry the permanently failed entry.
    hFailed.setOnline(true);
    hFailed.engine.handleOnline();
    await hFailed.clock.flushMicrotasks();
    assert.equal(hFailed.calls.length, 1);
    assert.equal(hFailed.engine.getSnapshot().entries[0].status, "failed");

    // 2. authExpired must remain true across offline flushNow / retry.
    const hAuth = createHarness({
        initialBase: [],
        onSync: () => {
            throw new TodoApiError("Expired", "UNAUTHORIZED", 401);
        },
    });
    await hAuth.engine.init();

    const created = await hAuth.engine.create("驗證過期項目", "證件");
    await hAuth.clock.advanceBy(1_500);
    assert.equal(hAuth.engine.getSnapshot().authExpired, true);

    hAuth.setOnline(false);
    const offlineAuthFlush = await hAuth.engine.flushNow({
        includeFailed: true,
    });
    assert.equal(offlineAuthFlush.offline, true);
    assert.equal(offlineAuthFlush.authExpired, true);
    assert.equal(hAuth.engine.getSnapshot().authExpired, true);

    const offlineAuthRetry = await hAuth.engine.retry(created.id);
    assert.equal(offlineAuthRetry.offline, true);
    assert.equal(offlineAuthRetry.authExpired, true);
    assert.equal(hAuth.engine.getSnapshot().authExpired, true);
});

test("transient timeout after an in-flight revert sends an explicit patch back to base so server converges", async () => {
    const item = makeTodo({ id: "t-timeout-revert-e2e", checked: false });
    let rejectFirst!: (err: unknown) => void;
    let callNumber = 0;

    const h = createHarness({
        initialBase: [item],
        onSync: (call, server) => {
            callNumber += 1;
            const res = server.applyOps(call.ops);
            if (callNumber === 1) {
                // Server applied checked:true, then response times out.
                return new Promise<TodoSyncResponse>((_resolve, reject) => {
                    rejectFirst = reject;
                });
            }
            return res;
        },
    });
    await h.engine.init();

    await h.engine.update(item.id, { checked: true });
    await h.clock.advanceBy(1_500);
    assert.equal(h.calls.length, 1);
    assert.equal(h.server.getItems()[0].checked, true);

    // User unchecks while first sync is still in flight -> rev:2, patch:{}
    await h.engine.update(item.id, { checked: false });
    assert.deepEqual(h.engine.getSnapshot().entries[0].patch, {});

    // First sync times out -> must keep an explicit { checked: false } patch instead of dropping!
    rejectFirst(new TodoApiError("Timed out", "TIMEOUT"));
    await h.clock.flushMicrotasks();

    const afterTimeout = h.engine.getSnapshot();
    assert.equal(afterTimeout.entries.length, 1);
    assert.equal(afterTimeout.entries[0].status, "pending");
    assert.equal(afterTimeout.entries[0].attempts, 1);
    assert.deepEqual(afterTimeout.entries[0].patch, { checked: false });

    // Advance 5s backoff -> engine sends { checked: false }, server & base converge to checked:false.
    await h.clock.advanceBy(5_000);
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.calls[1].ops[0], {
        opId: h.calls[1].ops[0].opId,
        type: "update",
        id: item.id,
        checked: false,
    });
    assert.equal(h.server.getItems()[0].checked, false);
    assert.equal(h.getBase()?.[0].checked, false);
    assert.equal(h.engine.getSnapshot().entries.length, 0);
});
