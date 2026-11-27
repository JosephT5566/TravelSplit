import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import type {
    AddExpenseRequest,
    CreateTodoItemInput,
    Expense,
    TodoItem,
} from "../src/types.ts";

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

const { api, TodoApiError } = await import("../services/api.ts");
const {
    EXPENSES_KEY,
    SHEET_CONFIG_KEY,
    TODOS_KEY,
    USER_STORAGE_KEY,
} = await import("../services/cacheKeys.ts");
const {
    clearUserQueryCaches,
    createCreateTodosMutationOptions,
    createDeleteTodoMutationOptions,
    createTodosQueryOptions,
    createUpdateTodoMutationOptions,
    getTodosQueryKey,
} = await import("../services/todoCache.ts");
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
            meta: { timestamp: "2026-11-27T00:00:00.000Z" },
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
            meta: { timestamp: "2026-11-27T00:00:00.000Z" },
        },
        status,
        statusText,
    );
}

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
    return {
        id: "todo-1",
        ownerEmail: USER_AN,
        text: "買車票",
        checked: false,
        createdAt: "2026-11-27T01:00:00.000Z",
        updatedAt: "2026-11-27T01:00:00.000Z",
        ...overrides,
    };
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

function executeMutation<TData, TError, TVariables, TContext>(
    queryClient: QueryClient,
    options: Parameters<
        ReturnType<QueryClient["getMutationCache"]>["build"]
    >[1],
    variables: TVariables,
): Promise<TData> {
    const mutation = queryClient
        .getMutationCache()
        .build<TData, TError, TVariables, TContext>(
            queryClient,
            options as never,
        );
    return mutation.execute(variables);
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

test("AC2: query keys [TODOS_KEY, sheetId, ownerEmail] isolate caches across sheets and members", async () => {
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

    const createdItem = makeTodo({
        id: "a-an-2",
        ownerEmail: USER_AN,
        text: "新項目",
    });
    const updatedItem = {
        ...anItemA,
        checked: true,
        updatedAt: "2026-11-27T02:00:00.000Z",
    };

    mockFetch((_url, init) => {
        if (init?.method === "POST") {
            return gcfOk({ items: [createdItem] }, 201);
        }
        if (init?.method === "PATCH") {
            return gcfOk({ item: updatedItem }, 200);
        }
        if (init?.method === "DELETE") {
            return gcfOk(
                { deletedId: "a-an-2", deletedItem: createdItem },
                200,
            );
        }
        throw new Error(`Unexpected method ${init?.method}`);
    });

    await executeMutation(
        queryClient,
        createCreateTodosMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        [{ text: "新項目" }],
    );

    await executeMutation(
        queryClient,
        createUpdateTodoMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        { id: "a-an-1", checked: true },
    );

    await executeMutation(
        queryClient,
        createDeleteTodoMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        "a-an-2",
    );

    assert.deepEqual(queryClient.getQueryData(keySheetAAn), [updatedItem]);
    assert.deepEqual(queryClient.getQueryData(keySheetABo), [boItemA]);
    assert.deepEqual(queryClient.getQueryData(keySheetBAn), [anItemB]);
});

test("AC3: pinned sheetId is always sent (never getSelectedSheetId), including across sheet switch and refresh retry", async () => {
    // 1. Clear selected sheet so getSelectedSheetId() would throw if called.
    window.localStorage.removeItem(SHEET_ID_STORAGE_KEY);

    const getCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            // Switch active sheet to sheet-b during refresh before GET retries.
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

    // 2. Mutation created with pinned sheet-a still sends sheet-a even though active sheet is sheet-b.
    const postCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            window.localStorage.setItem(SHEET_ID_STORAGE_KEY, SHEET_B);
            return jsonResponse({ ok: true }, 200);
        }
        if (postCalls.length === 1) {
            return gcfError(401, "UNAUTHORIZED", "Token expired");
        }
        return gcfOk({ items: [makeTodo({ id: "created-1" })] }, 201);
    });

    await executeMutation(
        queryClient,
        createCreateTodosMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        [{ text: "確認訂房" }],
    );

    assert.equal(postCalls.length, 3);
    assert.equal(
        new URL(postCalls[0].url).searchParams.get("sheetId"),
        SHEET_A,
    );
    assert.equal(
        new URL(postCalls[2].url).searchParams.get("sheetId"),
        SHEET_A,
    );

    // 3. With hook-style canReplayWrite guard, switching active sheet to sheet-b during refresh prevents replay.
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
        executeMutation(
            queryClient,
            createCreateTodosMutationOptions({
                queryClient,
                sheetId: SHEET_A,
                userEmail: USER_AN,
                canReplayWrite: () =>
                    isActive && getActiveSheetIdOrNull() === SHEET_A,
            }),
            [{ text: "不可重放" }],
        ),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "UNAUTHORIZED" &&
            err.status === 401,
    );
    // 1 initial POST + 1 refresh, NO replay POST
    assert.equal(guardedCalls.length, 2);
    assert.equal(
        new URL(guardedCalls[0].url).searchParams.get("sheetId"),
        SHEET_A,
    );

    // 4. Unmounting (isActive = false) during refresh also blocks replay.
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
        executeMutation(
            queryClient,
            createCreateTodosMutationOptions({
                queryClient,
                sheetId: SHEET_A,
                userEmail: USER_AN,
                canReplayWrite: () =>
                    isActive && getActiveSheetIdOrNull() === SHEET_A,
            }),
            [{ text: "卸載不重放" }],
        ),
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
    assert.equal(emptyCalls.length, 0);
});

test("AC4: batch POST /todos sends items with credentials, strips client ownerEmail, and appends server items", async () => {
    const queryClient = createTestQueryClient();
    const existing = makeTodo({ id: "todo-0", text: "既有項目" });
    const cacheKey = getTodosQueryKey(SHEET_A, USER_AN);
    queryClient.setQueryData(cacheKey, [existing]);

    const serverItems: TodoItem[] = [
        {
            id: "1700000000000-uuid-1",
            ownerEmail: USER_AN,
            text: "買車票",
            checked: false,
            createdAt: "2026-11-27T03:00:00.000Z",
            updatedAt: "2026-11-27T03:00:00.000Z",
        },
        {
            id: "1700000000000-uuid-2",
            ownerEmail: USER_AN,
            text: "保險",
            checked: true,
            createdAt: "2026-11-27T03:00:00.000Z",
            updatedAt: "2026-11-27T03:00:00.000Z",
        },
    ];

    const calls = mockFetch(() => gcfOk({ items: serverItems }, 201));

    const inputWithSneakyOwner = [
        { text: "買車票", ownerEmail: USER_BO } as CreateTodoItemInput,
        { text: "保險", checked: true },
    ];

    const response = await executeMutation(
        queryClient,
        createCreateTodosMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        inputWithSneakyOwner,
    );

    assert.deepEqual(response, { items: serverItems });
    assert.equal(calls.length, 1);

    const sentUrl = new URL(calls[0].url);
    assert.equal(sentUrl.pathname, "/todos");
    assert.equal(sentUrl.searchParams.get("sheetId"), SHEET_A);
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(calls[0].init?.credentials, "include");
    assert.deepEqual(calls[0].init?.headers, {
        "Content-Type": "application/json",
    });

    const parsedBody = JSON.parse(String(calls[0].init?.body));
    assert.deepEqual(parsedBody, {
        items: [{ text: "買車票" }, { text: "保險", checked: true }],
    });
    assert.equal("ownerEmail" in parsedBody.items[0], false);

    assert.deepEqual(queryClient.getQueryData(cacheKey), [
        existing,
        ...serverItems,
    ]);
});

test("AC5: optimistic check updates immediately, applies server item on 200, and rolls back on 500 and 404 with code", async () => {
    const queryClient = createTestQueryClient();
    const cacheKey = getTodosQueryKey(SHEET_A, USER_AN);
    const todo1 = makeTodo({
        id: "todo-1",
        text: "買車票",
        checked: false,
        updatedAt: "2026-11-27T01:00:00.000Z",
    });
    const todo2 = makeTodo({
        id: "todo-2",
        text: "訂飯店",
        checked: false,
        updatedAt: "2026-11-27T01:05:00.000Z",
    });
    queryClient.setQueryData(cacheKey, [todo1, todo2]);

    // 1. Optimistic check -> 200 success replaces item with server updatedAt.
    let resolvePatch!: (res: Response) => void;
    mockFetch(
        () =>
            new Promise<Response>((resolve) => {
                resolvePatch = resolve;
            }),
    );

    const patchPromise = executeMutation(
        queryClient,
        createUpdateTodoMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        { id: "todo-1", checked: true },
    );

    // Wait a tick for onMutate to run before server resolves.
    await new Promise((r) => setTimeout(r, 0));
    const optimisticList = queryClient.getQueryData<TodoItem[]>(cacheKey)!;
    assert.equal(optimisticList[0].checked, true);
    assert.equal(optimisticList[1].checked, false);

    const serverUpdated: TodoItem = {
        ...todo1,
        checked: true,
        updatedAt: "2026-11-27T04:00:00.000Z",
    };
    resolvePatch(gcfOk({ item: serverUpdated }, 200));
    await patchPromise;

    assert.deepEqual(queryClient.getQueryData(cacheKey), [
        serverUpdated,
        todo2,
    ]);

    // 2. Rollback on HTTP 500 INTERNAL_SERVER_ERROR.
    queryClient.setQueryData(cacheKey, [todo1, todo2]);
    let resolve500!: (res: Response) => void;
    mockFetch(
        () =>
            new Promise<Response>((resolve) => {
                resolve500 = resolve;
            }),
    );

    const fail500Promise = executeMutation(
        queryClient,
        createUpdateTodoMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        { id: "todo-1", checked: true },
    );

    await new Promise((r) => setTimeout(r, 0));
    assert.equal(
        queryClient.getQueryData<TodoItem[]>(cacheKey)?.[0].checked,
        true,
    );

    resolve500(
        gcfError(500, "INTERNAL_SERVER_ERROR", "Sheets backend failed"),
    );
    await assert.rejects(
        fail500Promise,
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "INTERNAL_SERVER_ERROR" &&
            err.status === 500,
    );
    assert.deepEqual(queryClient.getQueryData(cacheKey), [todo1, todo2]);

    // 3. Rollback on HTTP 404 NOT_FOUND.
    mockFetch(() => gcfError(404, "NOT_FOUND", "Todo not found"));
    await assert.rejects(
        executeMutation(
            queryClient,
            createUpdateTodoMutationOptions({
                queryClient,
                sheetId: SHEET_A,
                userEmail: USER_AN,
                canReplayWrite: () => true,
            }),
            { id: "todo-1", checked: true },
        ),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "NOT_FOUND" &&
            err.status === 404,
    );
    assert.deepEqual(queryClient.getQueryData(cacheKey), [todo1, todo2]);

    // 4. Text edit is NOT optimistic before response, and updates cache on HTTP 200.
    let resolveTextPatch!: (res: Response) => void;
    mockFetch(
        () =>
            new Promise<Response>((resolve) => {
                resolveTextPatch = resolve;
            }),
    );
    const textPromise = executeMutation(
        queryClient,
        createUpdateTodoMutationOptions({
            queryClient,
            sheetId: SHEET_A,
            userEmail: USER_AN,
            canReplayWrite: () => true,
        }),
        { id: "todo-1", text: "買新幹線車票" },
    );
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(
        queryClient.getQueryData<TodoItem[]>(cacheKey)?.[0].text,
        "買車票",
    );
    const editedItem: TodoItem = {
        ...todo1,
        text: "買新幹線車票",
        updatedAt: "2026-11-27T05:00:00.000Z",
    };
    resolveTextPatch(gcfOk({ item: editedItem }, 200));
    await textPromise;
    assert.deepEqual(queryClient.getQueryData(cacheKey), [editedItem, todo2]);
});

test("AC6: Todo 403 FORBIDDEN does not refresh, does not redirect, preserves auth & expense cache, and exposes FORBIDDEN code", async () => {
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

    // PATCH 403
    const patchCalls = mockFetch(() =>
        gcfError(403, "FORBIDDEN", "Cannot modify another user's todo"),
    );
    await assert.rejects(
        executeMutation(
            queryClient,
            createUpdateTodoMutationOptions({
                queryClient,
                sheetId: SHEET_A,
                userEmail: USER_AN,
                canReplayWrite: () => true,
            }),
            { id: "bo-todo-1", checked: true },
        ),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "FORBIDDEN" &&
            err.status === 403,
    );
    assert.equal(patchCalls.length, 1);
    assert.equal(
        patchCalls.some((c) => c.url.includes("/auth/travel-split/refresh")),
        false,
    );
    assert.equal(mockLocation.href, initialHref);
    assert.equal(
        window.localStorage.getItem(USER_STORAGE_KEY),
        JSON.stringify({ email: USER_AN, name: "小安" }),
    );
    assert.deepEqual(queryClient.getQueryData(expenseKey), [sampleExpense]);

    // DELETE 403
    const deleteCalls = mockFetch(() =>
        gcfError(403, "FORBIDDEN", "Cannot delete another user's todo"),
    );
    await assert.rejects(
        executeMutation(
            queryClient,
            createDeleteTodoMutationOptions({
                queryClient,
                sheetId: SHEET_A,
                userEmail: USER_AN,
                canReplayWrite: () => true,
            }),
            "bo-todo-1",
        ),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "FORBIDDEN" &&
            err.status === 403,
    );
    assert.equal(deleteCalls.length, 1);
    assert.equal(
        deleteCalls.some((c) => c.url.includes("/auth/travel-split/refresh")),
        false,
    );
    assert.equal(mockLocation.href, initialHref);
    assert.deepEqual(queryClient.getQueryData(expenseKey), [sampleExpense]);

    // GET 403 (e.g. token email not in sheet config.users)
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
    // 1. GET /data 403 triggers refresh and throws TOKEN_EXPIRED if retry is still 403.
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

    // 2. DELETE /delete 403 triggers refresh and throws TOKEN_EXPIRED if retry is still 403.
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

    // 3. POST /add 403 and 401 still use refresh + canReplayWrite logic.
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
        // When canReplayWrite is true, refreshes and replays once -> "saved"
        const replayCalls = mockFetch((url) => {
            if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
                return jsonResponse({ ok: true }, 200);
            }
            if (replayCalls.length === 1) {
                return gcfError(status, status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", "denied");
            }
            return gcfOk({ timestamp: "ts-1" }, 201);
        });
        const saved = await api.addExpense(expensePayload, SHEET_A, () => true);
        assert.equal(saved, "saved");
        assert.equal(replayCalls.length, 3);
        assert.equal(
            replayCalls[1].url,
            `${AUTH_PROXY_BASE}/auth/travel-split/refresh`,
        );

        // When canReplayWrite is false, does NOT replay -> "rejected"
        const blockedCalls = mockFetch((url) => {
            if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
                return jsonResponse({ ok: true }, 200);
            }
            return gcfError(status, status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", "denied");
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

test("AC8: Todo GET 401 refreshes once and retries; refresh failure redirects to /", async () => {
    // 1. Single refresh + retry succeeds.
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
    assert.equal(
        successCalls.filter((c) =>
            c.url.includes("/auth/travel-split/refresh"),
        ).length,
        1,
    );

    // 2. If retried GET still returns 401, does NOT refresh a second time.
    const double401Calls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ ok: true }, 200);
        }
        return gcfError(401, "UNAUTHORIZED", "Still unauthorized");
    });

    await assert.rejects(
        api.getTodos(SHEET_A, USER_AN),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "UNAUTHORIZED" &&
            err.status === 401,
    );
    assert.equal(double401Calls.length, 3);
    assert.equal(
        double401Calls.filter((c) =>
            c.url.includes("/auth/travel-split/refresh"),
        ).length,
        1,
    );

    // 3. Refresh failure redirects to "/" and rejects (same as existing GETs).
    mockLocation.href = "https://app.example.test/todos";
    const refreshFailCalls = mockFetch((url) => {
        if (url.startsWith(`${AUTH_PROXY_BASE}/auth/travel-split/refresh`)) {
            return jsonResponse({ error: "refresh failed" }, 401);
        }
        return gcfError(401, "UNAUTHORIZED", "Token has expired");
    });

    await assert.rejects(api.getTodos(SHEET_A, USER_AN), /Failed to refresh/);
    assert.equal(refreshFailCalls.length, 2);
    assert.equal(mockLocation.href, "/");
});

test("AC9: Todo errors expose code and status for 400/404/422/500, envelope success:false, unreadable body, and network failure", async () => {
    const cases: Array<[number, string, string]> = [
        [400, "INVALID_PARAMS", "Todo text must be between 1 and 500 characters."],
        [404, "NOT_FOUND", "Todo not found"],
        [422, "INVALID_SHEET_LAYOUT", "Todos tab is missing required headers: checked."],
        [500, "INTERNAL_SERVER_ERROR", "Unexpected failure"],
    ];

    for (const [status, code, message] of cases) {
        mockFetch(() => gcfError(status, code, message));
        await assert.rejects(
            api.createTodos(SHEET_A, [{ text: "x" }], () => true),
            (err: unknown) =>
                err instanceof TodoApiError &&
                err.code === code &&
                err.status === status &&
                err.message === message,
        );
    }

    // HTTP 200 with envelope success: false must also reject with code.
    mockFetch(() => gcfError(200, "INVALID_PARAMS", "Envelope failure"));
    await assert.rejects(
        api.getTodos(SHEET_A, USER_AN),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "INVALID_PARAMS" &&
            err.status === 200,
    );

    // Unreadable non-JSON body must reject (never resolve as success).
    mockFetch(
        () =>
            new Response("<html>502 Bad Gateway</html>", {
                status: 502,
                statusText: "Bad Gateway",
            }),
    );
    await assert.rejects(
        api.deleteTodo(SHEET_A, "todo-1", () => true),
        (err: unknown) =>
            err instanceof TodoApiError &&
            err.code === "INTERNAL_SERVER_ERROR" &&
            err.status === 502,
    );

    // Network failure rejects.
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await assert.rejects(
        api.updateTodo(SHEET_A, { id: "todo-1", text: "updated" }, () => true),
        (err: unknown) => err instanceof TypeError,
    );
});

test("Offline writes fail immediately with code OFFLINE and send no fetch", async () => {
    setNavigatorOnline(false);
    const queryClient = createTestQueryClient();
    const cacheKey = getTodosQueryKey(SHEET_A, USER_AN);
    const item = makeTodo({ id: "todo-1", checked: false });
    queryClient.setQueryData(cacheKey, [item]);

    const calls = mockFetch(() => {
        throw new Error("fetch must not be called while offline");
    });

    const createOptions = createCreateTodosMutationOptions({
        queryClient,
        sheetId: SHEET_A,
        userEmail: USER_AN,
        canReplayWrite: () => true,
    });
    assert.equal(createOptions.networkMode, "always");
    assert.equal(createOptions.retry, false);

    await assert.rejects(
        executeMutation(queryClient, createOptions, [{ text: "離線新增" }]),
        (err: unknown) => err instanceof TodoApiError && err.code === "OFFLINE",
    );

    await assert.rejects(
        executeMutation(
            queryClient,
            createUpdateTodoMutationOptions({
                queryClient,
                sheetId: SHEET_A,
                userEmail: USER_AN,
                canReplayWrite: () => true,
            }),
            { id: "todo-1", checked: true },
        ),
        (err: unknown) => err instanceof TodoApiError && err.code === "OFFLINE",
    );

    await assert.rejects(
        executeMutation(
            queryClient,
            createDeleteTodoMutationOptions({
                queryClient,
                sheetId: SHEET_A,
                userEmail: USER_AN,
                canReplayWrite: () => true,
            }),
            "todo-1",
        ),
        (err: unknown) => err instanceof TodoApiError && err.code === "OFFLINE",
    );

    assert.equal(calls.length, 0);
    assert.deepEqual(queryClient.getQueryData(cacheKey), [item]);
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

    // Dehydrate & hydrate into a fresh client (simulating IndexedDB persister round-trip).
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
    assert.equal(
        restoredClient.getQueryData([TODOS_KEY, SHEET_A, USER_AN]),
        undefined,
    );
    assert.equal(
        restoredClient.getQueryData([TODOS_KEY, SHEET_A, USER_BO]),
        undefined,
    );
    assert.equal(
        restoredClient.getQueryData([TODOS_KEY, SHEET_B, USER_AN]),
        undefined,
    );
    assert.deepEqual(
        restoredClient.getQueryData([SHEET_CONFIG_KEY, SHEET_A]),
        { tripName: "Hokkaido" },
    );

    // Verify ExpensesStore delegates clearExpensesCache to clearUserQueryCaches
    // and AuthStore invokes clearExpensesCache in all 4 auth-clear paths.
    const expensesStoreSrc = readFileSync(
        path.join(REPO_ROOT, "src/stores/ExpensesStore.tsx"),
        "utf8",
    );
    assert.match(
        expensesStoreSrc,
        /export function clearExpensesCache\(\)\s*\{\s*clearUserQueryCaches\(queryClient\);\s*\}/,
    );

    const authStoreSrc = readFileSync(
        path.join(REPO_ROOT, "src/stores/AuthStore.tsx"),
        "utf8",
    );
    const clearCalls = authStoreSrc.match(/clearExpensesCache\(\)/g) ?? [];
    assert.equal(clearCalls.length, 4);
});
