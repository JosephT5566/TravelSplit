import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { AddExpenseRequest, Expense, TodoItem } from "../src/types.ts";
import {
    classifySyncRequestError,
    type TodoSyncOp,
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

const { api, defaultTodoSyncTransport, TodoApiError } = await import(
    "../services/api.ts"
);
const {
    EXPENSES_KEY,
    SHEET_CONFIG_KEY,
    TODOS_KEY,
    USER_STORAGE_KEY,
} = await import("../services/cacheKeys.ts");
const {
    clearUserCachesIfSignedOut,
    clearUserQueryCaches,
} = await import("../services/queryClient.ts");
const { createTodosQueryOptions, getTodosQueryKey } = await import(
    "../services/todoCache.ts"
);
const {
    getActiveSheetIdOrNull,
    SHEET_ID_STORAGE_KEY,
} = await import("../src/utils/sheetSelection.ts");

const GCF_BASE = "https://gcf.example.test";
const AUTH_PROXY_BASE = "https://auth.example.test";
const USER_AN = "an@example.com";
const USER_BO = "bo@example.com";
const SHEET_A = "sheet-a";
const SHEET_B = "sheet-b";

type FetchCall = {
    url: string;
    init?: RequestInit;
};

const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
);
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
);
const originalEnv = {
    NEXT_PUBLIC_TRAVEL_SPLIT_GCF: process.env.NEXT_PUBLIC_TRAVEL_SPLIT_GCF,
    NEXT_PUBLIC_AUTH_PROXY: process.env.NEXT_PUBLIC_AUTH_PROXY,
    NEXT_PUBLIC_SHEET_ID: process.env.NEXT_PUBLIC_SHEET_ID,
};

let storageMap: Map<string, string>;
let mockLocation: { href: string };

function installBrowserStubs(initialHref = "https://app.example.test/todos") {
    storageMap = new Map<string, string>();
    mockLocation = { href: initialHref };

    const localStorageStub = {
        getItem(key: string) {
            return storageMap.has(key) ? storageMap.get(key)! : null;
        },
        setItem(key: string, value: string) {
            storageMap.set(key, String(value));
        },
        removeItem(key: string) {
            storageMap.delete(key);
        },
        clear() {
            storageMap.clear();
        },
    };

    Object.defineProperty(globalThis, "window", {
        value: {
            localStorage: localStorageStub,
            location: mockLocation,
            dispatchEvent: () => true,
        },
        configurable: true,
        writable: true,
    });
}

function setNavigatorOnline(onLine: boolean | undefined) {
    Object.defineProperty(globalThis, "navigator", {
        value: onLine === undefined ? {} : { onLine },
        configurable: true,
        writable: true,
    });
}

function restoreGlobals() {
    globalThis.fetch = originalFetch;

    if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
        delete (globalThis as { window?: unknown }).window;
    }

    if (originalNavigatorDescriptor) {
        Object.defineProperty(
            globalThis,
            "navigator",
            originalNavigatorDescriptor,
        );
    } else {
        delete (globalThis as { navigator?: unknown }).navigator;
    }

    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

function jsonResponse(body: unknown, status = 200, statusText = "OK") {
    return new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: { "Content-Type": "application/json" },
    });
}

function gcfOk<T>(data: T, status = 200) {
    return jsonResponse(
        {
            success: true,
            data,
            error: null,
            meta: { timestamp: "2026-11-28T00:00:00.000Z" },
        },
        status,
    );
}

function gcfError(
    status: number,
    code: string,
    message: string,
    statusText = "Error",
) {
    return jsonResponse(
        {
            success: false,
            data: null,
            error: { code, message },
            meta: { timestamp: "2026-11-28T00:00:00.000Z" },
        },
        status,
        statusText,
    );
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

function makeSyncCreateOp(overrides: Partial<TodoSyncOp> = {}): TodoSyncOp {
    return {
        opId: "op-1",
        type: "create",
        id: "1732780000000-00000000-0000-4000-8000-000000000001",
        text: "買車票",
        checked: false,
        category: "交通",
        ...overrides,
    } as TodoSyncOp;
}

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
}

function mockFetch(
    handler: (
        url: string,
        init: RequestInit | undefined,
        calls: FetchCall[],
    ) => Response | Promise<Response>,
) {
    const calls: FetchCall[] = [];
    globalThis.fetch = (async (
        input: string | URL | Request,
        init?: RequestInit,
    ) => {
        const url =
            typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        calls.push({ url, init });
        return handler(url, init, calls);
    }) as typeof fetch;
    return calls;
}

beforeEach(() => {
    process.env.NEXT_PUBLIC_TRAVEL_SPLIT_GCF = GCF_BASE;
    process.env.NEXT_PUBLIC_AUTH_PROXY = AUTH_PROXY_BASE;
    process.env.NEXT_PUBLIC_SHEET_ID = JSON.stringify([SHEET_A, SHEET_B]);
    installBrowserStubs();
    window.localStorage.setItem(SHEET_ID_STORAGE_KEY, SHEET_A);
    setNavigatorOnline(true);
});

afterEach(() => {
    restoreGlobals();
});

test("AC1: GET /todos returns empty array when Todos tab is missing and sends no writes", async () => {
    const calls = mockFetch(() => gcfOk([], 200));
    const queryClient = createTestQueryClient();

    const disabledWhenSignedOut = createTodosQueryOptions({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
        isSignedIn: false,
    });
    assert.equal(disabledWhenSignedOut.enabled, false);

    const disabledWhenMissingParams = createTodosQueryOptions({
        sheetId: "",
        ownerEmail: USER_AN,
        isSignedIn: true,
    });
    assert.equal(disabledWhenMissingParams.enabled, false);

    const disabledWhenWhitespaceParams = createTodosQueryOptions({
        sheetId: "   ",
        ownerEmail: "  ",
        isSignedIn: true,
    });
    assert.equal(disabledWhenWhitespaceParams.enabled, false);

    const queryOptions = createTodosQueryOptions({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
        isSignedIn: true,
    });
    assert.equal(queryOptions.enabled, true);
    assert.deepEqual(queryOptions.queryKey, [TODOS_KEY, SHEET_A, USER_AN]);

    const result = await queryClient.fetchQuery(queryOptions);
    assert.deepEqual(result, []);
    assert.equal(calls.length, 1);

    const sentUrl = new URL(calls[0].url);
    assert.equal(sentUrl.pathname, "/todos");
    assert.equal(sentUrl.searchParams.get("sheetId"), SHEET_A);
    assert.equal(sentUrl.searchParams.get("ownerEmail"), USER_AN);
    assert.equal(calls[0].init?.method, "GET");
    assert.equal(calls[0].init?.credentials, "include");
});

test("AC2: query keys [TODOS_KEY, sheetId, ownerEmail] isolate caches across sheets and members", () => {
    const queryClient = createTestQueryClient();
    const keySheetAAn = getTodosQueryKey(SHEET_A, USER_AN);
    const keySheetABo = getTodosQueryKey(SHEET_A, USER_BO);
    const keySheetBAn = getTodosQueryKey(SHEET_B, USER_AN);

    assert.deepEqual(keySheetAAn, [TODOS_KEY, SHEET_A, USER_AN]);
    assert.deepEqual(keySheetABo, [TODOS_KEY, SHEET_A, USER_BO]);
    assert.deepEqual(keySheetBAn, [TODOS_KEY, SHEET_B, USER_AN]);

    const anItemA = makeTodo({ id: "a-an-1", ownerEmail: USER_AN, text: "A-安" });
    const boItemA = makeTodo({ id: "a-bo-1", ownerEmail: USER_BO, text: "A-博" });
    const anItemB = makeTodo({ id: "b-an-1", ownerEmail: USER_AN, text: "B-安" });

    queryClient.setQueryData(keySheetAAn, [anItemA]);
    queryClient.setQueryData(keySheetABo, [boItemA]);
    queryClient.setQueryData(keySheetBAn, [anItemB]);

    assert.deepEqual(queryClient.getQueryData(keySheetAAn), [anItemA]);
    assert.deepEqual(queryClient.getQueryData(keySheetABo), [boItemA]);
    assert.deepEqual(queryClient.getQueryData(keySheetBAn), [anItemB]);
});

test("AC3: pinned sheetId is always sent for GET /todos and POST /todos/sync, including across sheet switch and refresh retry", async () => {
    // 1. Clear selected sheet so getSelectedSheetId() would throw if called.
    window.localStorage.removeItem(SHEET_ID_STORAGE_KEY);

    const getCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            window.localStorage.setItem(SHEET_ID_STORAGE_KEY, SHEET_B);
            return jsonResponse({ ok: true }, 200);
        }
        if (getCalls.length === 1) {
            return gcfError(401, "UNAUTHORIZED", "Token expired");
        }
        return gcfOk([makeTodo()], 200);
    });

    const queryClient = createTestQueryClient();
    const todos = await queryClient.fetchQuery(
        createTodosQueryOptions({
            sheetId: SHEET_A,
            ownerEmail: USER_AN,
            isSignedIn: true,
        }),
    );
    assert.equal(todos.length, 1);
    assert.equal(getCalls.length, 3);
    assert.equal(new URL(getCalls[0].url).searchParams.get("sheetId"), SHEET_A);
    assert.equal(
        getCalls[1].url,
        `${AUTH_PROXY_BASE}/auth/travel-split/refresh`,
    );
    assert.equal(new URL(getCalls[2].url).searchParams.get("sheetId"), SHEET_A);

    // 2. POST /todos/sync with pinned sheet-a still sends sheet-a after refresh retry.
    const item = makeTodo();
    const syncCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            window.localStorage.setItem(SHEET_ID_STORAGE_KEY, SHEET_B);
            return jsonResponse({ ok: true }, 200);
        }
        if (syncCalls.length === 1) {
            return gcfError(401, "UNAUTHORIZED", "Token expired");
        }
        return gcfOk(
            {
                results: [{ opId: "op-1", id: item.id, status: "applied", item }],
                syncedAt: "2026-11-28T02:00:00.000Z",
            },
            200,
        );
    });

    const syncRes = await defaultTodoSyncTransport.syncTodos(
        SHEET_A,
        [makeSyncCreateOp()],
        { canReplayWrite: () => true },
    );
    assert.equal(syncRes.syncedAt, "2026-11-28T02:00:00.000Z");
    assert.equal(syncRes.results.length, 1);
    assert.equal(syncCalls.length, 3);
    assert.equal(new URL(syncCalls[0].url).pathname, "/todos/sync");
    assert.equal(new URL(syncCalls[0].url).searchParams.get("sheetId"), SHEET_A);
    assert.equal(new URL(syncCalls[2].url).searchParams.get("sheetId"), SHEET_A);

    // 3. With canReplayWrite guard, switching active sheet to sheet-b during refresh blocks replay.
    window.localStorage.setItem(SHEET_ID_STORAGE_KEY, SHEET_A);
    let isActive = true;
    const guardedCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            window.localStorage.setItem(SHEET_ID_STORAGE_KEY, SHEET_B);
            return jsonResponse({ ok: true }, 200);
        }
        return gcfError(401, "UNAUTHORIZED", "Token expired");
    });

    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()], {
            canReplayWrite: () =>
                isActive && getActiveSheetIdOrNull() === SHEET_A,
        }),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "UNAUTHORIZED" &&
            err.status === 401,
    );
    assert.equal(guardedCalls.length, 2);
    assert.equal(
        new URL(guardedCalls[0].url).searchParams.get("sheetId"),
        SHEET_A,
    );

    // 4. Unmounting / disposing (isActive = false) during refresh also blocks replay.
    window.localStorage.setItem(SHEET_ID_STORAGE_KEY, SHEET_A);
    isActive = true;
    const unmountCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            isActive = false;
            return jsonResponse({ ok: true }, 200);
        }
        return gcfError(401, "UNAUTHORIZED", "Token expired");
    });

    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()], {
            canReplayWrite: () =>
                isActive && getActiveSheetIdOrNull() === SHEET_A,
        }),
        (err: unknown) =>
            err instanceof TodoApiError && err.code === "UNAUTHORIZED",
    );
    assert.equal(unmountCalls.length, 2);

    // 5. Empty pinned sheetId rejects immediately without reading getSelectedSheetId or calling fetch.
    const emptyCalls = mockFetch(() => gcfOk([], 200));
    await assert.rejects(
        api.getTodos("", USER_AN),
        (err: unknown) =>
            err instanceof TodoApiError && err.code === "INVALID_PARAMS",
    );
    await assert.rejects(
        api.syncTodos("   ", [makeSyncCreateOp()]),
        (err: unknown) =>
            err instanceof TodoApiError && err.code === "INVALID_PARAMS",
    );
    assert.equal(emptyCalls.length, 0);
});

test("AC6: Todo 403 FORBIDDEN on GET and POST /todos/sync does not refresh, does not redirect, preserves auth & expense cache, and exposes FORBIDDEN", async () => {
    const queryClient = createTestQueryClient();
    const expenseKey = [EXPENSES_KEY, SHEET_A, USER_AN];
    const sampleExpense: Expense = {
        timestamp: "2026-11-27T00:00:00Z",
        date: "2026-11-27",
        itemName: "拉麵",
        category: "餐飲",
        payer: "小安",
        amount: 1200,
        currency: "JPY",
        splitsJson: { [USER_AN]: 260 },
        exchangeRate: 0.217,
    };
    queryClient.setQueryData(expenseKey, [sampleExpense]);
    window.localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({ email: USER_AN, name: "小安" }),
    );
    const initialHref = "https://app.example.test/todos";
    mockLocation.href = initialHref;

    // POST /todos/sync 403
    const syncCalls = mockFetch(() =>
        gcfError(403, "FORBIDDEN", "User is not in the allowed list"),
    );
    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()]),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "FORBIDDEN" &&
            err.status === 403 &&
            classifySyncRequestError(err) === "permanent",
    );
    assert.equal(syncCalls.length, 1);
    assert.equal(
        syncCalls.some((c) => c.url.includes("/auth/travel-split/refresh")),
        false,
    );
    assert.equal(mockLocation.href, initialHref);
    assert.equal(
        window.localStorage.getItem(USER_STORAGE_KEY),
        JSON.stringify({ email: USER_AN, name: "小安" }),
    );
    assert.deepEqual(queryClient.getQueryData(expenseKey), [sampleExpense]);

    // GET /todos 403
    const getCalls = mockFetch(() =>
        gcfError(403, "FORBIDDEN", "User is not in the allowed list"),
    );
    await assert.rejects(
        api.getTodos(SHEET_A, USER_AN),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "FORBIDDEN" &&
            err.status === 403,
    );
    assert.equal(getCalls.length, 1);
    assert.equal(mockLocation.href, initialHref);
    assert.deepEqual(queryClient.getQueryData(expenseKey), [sampleExpense]);
});

test("AC7: expense regression — /data, /delete, and /add still treat HTTP 403 as unauthorized with refresh, TOKEN_EXPIRED, and canReplayWrite", async () => {
    const dataCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ ok: true }, 200);
        }
        return gcfError(403, "FORBIDDEN", "Not allowed");
    });

    const controller = new AbortController();
    await assert.rejects(
        api.getExpenses(USER_AN, { [USER_AN]: "小安" }, SHEET_A, controller.signal),
        (err: unknown) =>
            err instanceof Error &&
            !(err instanceof TodoApiError) &&
            err.message === "TOKEN_EXPIRED",
    );
    assert.equal(dataCalls.length, 3);
    assert.equal(
        dataCalls[1].url,
        `${AUTH_PROXY_BASE}/auth/travel-split/refresh`,
    );

    const deleteCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ ok: true }, 200);
        }
        return gcfError(403, "FORBIDDEN", "Not allowed");
    });

    await assert.rejects(
        api.deleteExpenses("2026-11-27T00:00:00Z"),
        (err: unknown) =>
            err instanceof Error &&
            !(err instanceof TodoApiError) &&
            err.message === "TOKEN_EXPIRED",
    );
    assert.equal(deleteCalls.length, 3);
    assert.equal(
        deleteCalls[1].url,
        `${AUTH_PROXY_BASE}/auth/travel-split/refresh`,
    );

    const expensePayload: AddExpenseRequest = {
        date: "2026-11-27",
        itemName: "拉麵",
        category: "餐飲",
        payer: USER_AN,
        amount: 1000,
        currency: "JPY",
        exchangeRate: 0.22,
        splitsJson: { [USER_AN]: 220 },
        calculation: {
            amount: "1000",
            exchangeRate: "0.22",
            method: { kind: "single", email: USER_AN },
        },
    };

    for (const status of [401, 403] as const) {
        const replayCalls = mockFetch((url) => {
            if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
                return jsonResponse({ ok: true }, 200);
            }
            if (replayCalls.length === 1) {
                return gcfError(
                    status,
                    status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
                    "denied",
                );
            }
            return gcfOk({ timestamp: "ts-1" }, 201);
        });
        const saved = await api.addExpense(expensePayload, SHEET_A, () => true);
        assert.equal(saved, "saved");
        assert.equal(replayCalls.length, 3);

        const blockedCalls = mockFetch((url) => {
            if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
                return jsonResponse({ ok: true }, 200);
            }
            return gcfError(
                status,
                status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
                "denied",
            );
        });
        const rejected = await api.addExpense(
            expensePayload,
            SHEET_A,
            () => false,
        );
        assert.equal(rejected, "rejected");
        assert.equal(blockedCalls.length, 2);
    }
});

test("AC8: Todo GET 401 redirects on refresh failure, whereas POST /todos/sync 401 refresh failure rejects with UNAUTHORIZED without redirecting", async () => {
    // 1. GET single refresh + retry succeeds.
    const successCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ ok: true }, 200);
        }
        if (successCalls.length === 1) {
            return gcfError(401, "UNAUTHORIZED", "Token has expired");
        }
        return gcfOk([makeTodo()], 200);
    });

    const items = await api.getTodos(SHEET_A, USER_AN);
    assert.equal(items.length, 1);
    assert.equal(successCalls.length, 3);

    // 2. GET refresh failure redirects to "/" and rejects.
    mockLocation.href = "https://app.example.test/todos";
    const getRefreshFailCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ error: "refresh failed" }, 401);
        }
        return gcfError(401, "UNAUTHORIZED", "Token has expired");
    });

    await assert.rejects(api.getTodos(SHEET_A, USER_AN), /Failed to refresh/);
    assert.equal(getRefreshFailCalls.length, 2);
    assert.equal(mockLocation.href, "/");

    // 3. POST /todos/sync refresh failure does NOT redirect and surfaces 401 UNAUTHORIZED for reconciler.
    mockLocation.href = "https://app.example.test/todos";
    const syncRefreshFailCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ error: "refresh failed" }, 401);
        }
        return gcfError(401, "UNAUTHORIZED", "Token has expired");
    });

    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()]),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "UNAUTHORIZED" &&
            err.status === 401 &&
            classifySyncRequestError(err) === "auth",
    );
    assert.equal(syncRefreshFailCalls.length, 2);
    assert.equal(mockLocation.href, "https://app.example.test/todos");
});

test("AC8 (F4): createTodosQueryOptions does not retry 4xx TodoApiError through default QueryClient", async () => {
    const queryClient = new QueryClient();
    const persistent401Calls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ ok: true }, 200);
        }
        return gcfError(401, "UNAUTHORIZED", "Still unauthorized");
    });

    const queryOptions = createTodosQueryOptions({
        sheetId: SHEET_A,
        ownerEmail: USER_AN,
        isSignedIn: true,
    });

    await assert.rejects(
        queryClient.fetchQuery(queryOptions),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "UNAUTHORIZED" &&
            err.status === 401,
    );
    assert.equal(
        persistent401Calls.filter((c) =>
            c.url.includes("/auth/travel-split/refresh"),
        ).length,
        1,
    );
    assert.equal(persistent401Calls.length, 3);

    const queryClient403 = new QueryClient();
    const persistent403Calls = mockFetch(() =>
        gcfError(403, "FORBIDDEN", "Not in sheet users"),
    );

    await assert.rejects(
        queryClient403.fetchQuery(queryOptions),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "FORBIDDEN" &&
            err.status === 403,
    );
    assert.equal(persistent403Calls.length, 1);

    assert.equal(
        queryOptions.retry(
            0,
            new TodoApiError("Server error", "INTERNAL_SERVER_ERROR", 500),
        ),
        true,
    );
    assert.equal(
        queryOptions.retry(
            3,
            new TodoApiError("Server error", "INTERNAL_SERVER_ERROR", 500),
        ),
        false,
    );
});

test("AC9: POST /todos/sync validates ops/response shape, maps error codes/statuses, handles timeout & keepalive, and classifies errors accurately", async () => {
    // 1. Error status mapping + reconciler classification
    const cases: Array<[number, string, string, "permanent" | "transient"]> = [
        [400, "INVALID_PARAMS", "ops must be a non-empty array", "permanent"],
        [422, "INVALID_SHEET_LAYOUT", "Missing required headers", "permanent"],
        [429, "RATE_LIMITED", "Quota exceeded", "transient"],
        [500, "INTERNAL_SERVER_ERROR", "Unexpected failure", "transient"],
        [503, "INTERNAL_SERVER_ERROR", "Service unavailable", "transient"],
    ];

    for (const [status, code, message, expectedKind] of cases) {
        mockFetch(() => gcfError(status, code, message));
        await assert.rejects(
            api.syncTodos(SHEET_A, [makeSyncCreateOp()]),
            (err: unknown) =>
                err instanceof TodoApiError &&
                err.code === code &&
                err.status === status &&
                err.message === message &&
                classifySyncRequestError(err) === expectedKind,
        );
    }

    // 2. Unreadable non-JSON 502 body -> transient TodoApiError
    mockFetch(
        () =>
            new Response("<html>502 Bad Gateway</html>", {
                status: 502,
                statusText: "Bad Gateway",
            }),
    );
    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()]),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "INTERNAL_SERVER_ERROR" &&
            err.status === 502 &&
            classifySyncRequestError(err) === "transient",
    );

    // 3. Invalid sync response shape (missing syncedAt or invalid op status) -> INVALID_RESPONSE (transient)
    mockFetch(() => gcfOk({ results: [], syncedAt: "" }, 200));
    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()]),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "INVALID_RESPONSE" &&
            classifySyncRequestError(err) === "transient",
    );

    mockFetch(() =>
        gcfOk(
            {
                results: [{ opId: "op-1", status: "weird_status" }],
                syncedAt: "2026-11-28T02:00:00.000Z",
            },
            200,
        ),
    );
    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()]),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "INVALID_RESPONSE" &&
            classifySyncRequestError(err) === "transient",
    );

    // 4. Empty or >100 ops rejected client-side with INVALID_PARAMS without fetch
    const emptyOpCalls = mockFetch(() => gcfOk({ results: [], syncedAt: "2026-11-28T02:00:00.000Z" }));
    await assert.rejects(
        api.syncTodos(SHEET_A, []),
        (err: unknown) =>
            err instanceof TodoApiError && err.code === "INVALID_PARAMS",
    );
    await assert.rejects(
        api.syncTodos(
            SHEET_A,
            Array.from({ length: 101 }, (_, i) =>
                makeSyncCreateOp({ opId: `op-${i}` }),
            ),
        ),
        (err: unknown) =>
            err instanceof TodoApiError && err.code === "INVALID_PARAMS",
    );
    assert.equal(emptyOpCalls.length, 0);

    // 5. Timeout (AbortSignal) rejects with TodoApiError("TIMEOUT") classified transient
    let aborted = false;
    mockFetch((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
                aborted = true;
                reject(new DOMException("Aborted", "AbortError"));
            });
        });
    });
    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()], { timeoutMs: 15 }),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "TIMEOUT" &&
            classifySyncRequestError(err) === "transient",
    );
    assert.equal(aborted, true);

    // 6. Keepalive passes keepalive:true to fetch and does NOT trigger refresh on 401
    const keepaliveCalls = mockFetch(() =>
        gcfError(401, "UNAUTHORIZED", "Token expired"),
    );
    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()], { keepalive: true }),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "UNAUTHORIZED" &&
            err.status === 401,
    );
    assert.equal(keepaliveCalls.length, 1);
    assert.equal(keepaliveCalls[0].init?.keepalive, true);

    // 7. Offline rejects immediately with OFFLINE (transient) without calling fetch
    setNavigatorOnline(false);
    const offlineCalls = mockFetch(() => {
        throw new Error("fetch must not be called while offline");
    });
    await assert.rejects(
        api.syncTodos(SHEET_A, [makeSyncCreateOp()]),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "OFFLINE" &&
            classifySyncRequestError(err) === "transient",
    );
    assert.equal(offlineCalls.length, 0);
});

test("AC10: auth-clear removes all todos and expenses queries so dehydrated/restored cache contains none", () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData([EXPENSES_KEY, SHEET_A, USER_AN], [
        { itemName: "拉麵" },
    ]);
    queryClient.setQueryData([TODOS_KEY, SHEET_A, USER_AN], [
        makeTodo({ id: "an-1", ownerEmail: USER_AN }),
    ]);
    queryClient.setQueryData([TODOS_KEY, SHEET_A, USER_BO], [
        makeTodo({ id: "bo-1", ownerEmail: USER_BO }),
    ]);
    queryClient.setQueryData([TODOS_KEY, SHEET_B, USER_AN], [
        makeTodo({ id: "b-1", ownerEmail: USER_AN }),
    ]);
    queryClient.setQueryData([SHEET_CONFIG_KEY, SHEET_A], {
        tripName: "Hokkaido",
    });

    clearUserQueryCaches(queryClient);

    assert.equal(
        queryClient.getQueryData([EXPENSES_KEY, SHEET_A, USER_AN]),
        undefined,
    );
    assert.equal(
        queryClient.getQueryData([TODOS_KEY, SHEET_A, USER_AN]),
        undefined,
    );
    assert.equal(
        queryClient.getQueryData([TODOS_KEY, SHEET_A, USER_BO]),
        undefined,
    );
    assert.equal(
        queryClient.getQueryData([TODOS_KEY, SHEET_B, USER_AN]),
        undefined,
    );

    const dehydrated = dehydrate(queryClient);
    const remainingKeys = dehydrated.queries.map((q) => q.queryKey);
    assert.equal(
        remainingKeys.some((key) => key[0] === TODOS_KEY),
        false,
    );
    assert.equal(
        remainingKeys.some((key) => key[0] === EXPENSES_KEY),
        false,
    );

    const restoredClient = createTestQueryClient();
    hydrate(restoredClient, dehydrated);
    assert.deepEqual(
        restoredClient.getQueryData([SHEET_CONFIG_KEY, SHEET_A]),
        { tripName: "Hokkaido" },
    );

    const expensesStoreSrc = readFileSync(
        path.join(REPO_ROOT, "src/stores/ExpensesStore.tsx"),
        "utf8",
    );
    assert.match(
        expensesStoreSrc,
        /export function clearExpensesCache\(\)\s*\{\s*clearUserQueryCaches\(queryClient\);\s*\}/,
    );
    assert.equal(expensesStoreSrc.includes("todoCache"), false);

    const authStoreSrc = readFileSync(
        path.join(REPO_ROOT, "src/stores/AuthStore.tsx"),
        "utf8",
    );
    const clearCalls = authStoreSrc.match(/clearExpensesCache\(\)/g) ?? [];
    assert.equal(clearCalls.length, 5);

    const providersSrc = readFileSync(
        path.join(REPO_ROOT, "components/Providers.tsx"),
        "utf8",
    );
    assert.match(providersSrc, /onSuccess=/);
    assert.match(providersSrc, /clearUserCachesIfSignedOut/);
});

test("AC10 (F1): clearUserQueryCaches persists cleaned client state without todos or expenses to persister", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData([EXPENSES_KEY, SHEET_A, USER_AN], [
        { itemName: "拉麵" },
    ]);
    queryClient.setQueryData([TODOS_KEY, SHEET_A, USER_AN], [
        makeTodo({ id: "an-1", ownerEmail: USER_AN }),
    ]);
    queryClient.setQueryData([TODOS_KEY, SHEET_A, USER_BO], [
        makeTodo({ id: "bo-1", ownerEmail: USER_BO }),
    ]);
    queryClient.setQueryData([SHEET_CONFIG_KEY, SHEET_A], {
        tripName: "Hokkaido",
    });

    const persisted: PersistedClient[] = [];
    const fakePersister: Persister = {
        persistClient: async (client) => {
            persisted.push(client);
        },
        restoreClient: async () => persisted[persisted.length - 1],
        removeClient: async () => {
            persisted.length = 0;
        },
    };

    clearUserQueryCaches(queryClient, fakePersister);
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(persisted.length, 1);
    const savedKeys = persisted[0].clientState.queries.map((q) => q.queryKey);
    assert.equal(
        savedKeys.some((key) => key[0] === TODOS_KEY),
        false,
    );
    assert.equal(
        savedKeys.some((key) => key[0] === EXPENSES_KEY),
        false,
    );
    assert.equal(
        savedKeys.some((key) => key[0] === SHEET_CONFIG_KEY),
        true,
    );
});

test("AC10 (F1): restore-then-signed-out clears hydrated todos and expenses while signed-in keeps them", async () => {
    const sourceClient = createTestQueryClient();
    sourceClient.setQueryData([EXPENSES_KEY, SHEET_A, USER_AN], [
        { itemName: "拉麵" },
    ]);
    sourceClient.setQueryData([TODOS_KEY, SHEET_A, USER_AN], [
        makeTodo({ id: "an-1", ownerEmail: USER_AN }),
    ]);
    sourceClient.setQueryData([TODOS_KEY, SHEET_A, USER_BO], [
        makeTodo({ id: "bo-1", ownerEmail: USER_BO }),
    ]);
    sourceClient.setQueryData([SHEET_CONFIG_KEY, SHEET_A], {
        tripName: "Hokkaido",
    });
    const dehydratedSnapshot = dehydrate(sourceClient);

    const signedOutClient = createTestQueryClient();
    hydrate(signedOutClient, dehydratedSnapshot);
    const persistedSignedOut: PersistedClient[] = [];
    const signedOutPersister: Persister = {
        persistClient: async (client) => {
            persistedSignedOut.push(client);
        },
        restoreClient: async () => undefined,
        removeClient: async () => undefined,
    };

    const didClearSignedOut = clearUserCachesIfSignedOut(
        signedOutClient,
        { getItem: () => null },
        signedOutPersister,
    );
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(didClearSignedOut, true);
    assert.equal(
        signedOutClient.getQueryData([EXPENSES_KEY, SHEET_A, USER_AN]),
        undefined,
    );
    assert.equal(
        signedOutClient.getQueryData([TODOS_KEY, SHEET_A, USER_AN]),
        undefined,
    );
    assert.equal(
        signedOutClient.getQueryData([TODOS_KEY, SHEET_A, USER_BO]),
        undefined,
    );
    assert.deepEqual(
        signedOutClient.getQueryData([SHEET_CONFIG_KEY, SHEET_A]),
        { tripName: "Hokkaido" },
    );
    assert.equal(persistedSignedOut.length, 1);

    const signedInClient = createTestQueryClient();
    hydrate(signedInClient, dehydratedSnapshot);
    const persistedSignedIn: PersistedClient[] = [];
    const signedInPersister: Persister = {
        persistClient: async (client) => {
            persistedSignedIn.push(client);
        },
        restoreClient: async () => undefined,
        removeClient: async () => undefined,
    };

    const didClearSignedIn = clearUserCachesIfSignedOut(
        signedInClient,
        {
            getItem: (key) =>
                key === USER_STORAGE_KEY
                    ? JSON.stringify({ email: USER_AN, name: "小安" })
                    : null,
        },
        signedInPersister,
    );
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(didClearSignedIn, false);
    assert.deepEqual(
        signedInClient.getQueryData([TODOS_KEY, SHEET_A, USER_AN]),
        [makeTodo({ id: "an-1", ownerEmail: USER_AN })],
    );
    assert.equal(persistedSignedIn.length, 0);
});
