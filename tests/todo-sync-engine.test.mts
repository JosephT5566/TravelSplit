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
        },
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

test("scope isolation and sign-out plumbing: other scopes cleared and never sent; passive sign-out preserves outbox; explicit sign-out flushes then clears only after confirmation", async () => {
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

    // 6. Seed User A's entry on sheet-a, then sign in as User B on sheet-a (online):
    // User A's entry is cleared and NEVER sent!
    const engineA2 = (await manager.activateScope({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
    }))!;
    await engineA2.create("小安的機密待辦", "證件");
    assert.equal(
        (await store.loadScope({ sheetId: SHEET_A, ownerEmail: USER_AN }))
            .entries.length,
        1,
    );

    online = true;
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

    // 7. Switching sheet to sheet-b clears sheet-a entries and never sends them to sheet-b.
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
        0,
    );

    // 8. Explicit sign-out when online flushes pending changes automatically -> flushed: true, remainingCount: 0!
    await engineBSheetB.create("登出前自動送出", "行前");
    const onlineSignOut = await manager.attemptSignOutFlush({
        sheetId: SHEET_B,
        ownerEmail: USER_BO,
    });
    assert.deepEqual(onlineSignOut, { flushed: true, remainingCount: 0 });
    assert.equal(sentCalls.length, 1);
    assert.equal(sentCalls[0].sheetId, SHEET_B);
    manager.disposeActiveEngine();
});
