import type {
    AddExpenseRequest,
    Expense,
    SheetConfig,
    User,
    RawExpense,
    ExpenseWriteResult,
    DeleteExpenseResponse,
    TodoItem,
} from "../src/types";
import logger from "@/src/utils/logger";
import { getSelectedSheetId } from "@/src/utils/sheetSelection";
import {
    TODO_SYNC_MAX_OPS,
    type TodoSyncOp,
    type TodoSyncOpResultStatus,
    type TodoSyncResponse,
} from "@/src/utils/todoOutbox";

export const TODO_SYNC_TIMEOUT_MS = 15_000;

export type SyncTodosOptions = {
    keepalive?: boolean;
    signal?: AbortSignal;
    canReplayWrite?: () => boolean;
    timeoutMs?: number;
};

export interface TodoSyncTransport {
    syncTodos(
        sheetId: string,
        ops: readonly TodoSyncOp[],
        options?: SyncTodosOptions,
    ): Promise<TodoSyncResponse>;
}

export class TodoApiError extends Error {
    code: string;
    status?: number;

    constructor(message: string, code: string, status?: number) {
        super(message);
        this.name = "TodoApiError";
        this.code = code;
        this.status = status;
    }
}

let isRefreshing = false;
let failedQueue: {
    resolve: () => void;
    reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error?: unknown) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });

    failedQueue = [];
};

const isUnauthorizedResponse = async (
    response: Response,
    {
        treatForbiddenAsUnauthorized = true,
    }: { treatForbiddenAsUnauthorized?: boolean } = {},
) => {
    if (response.ok) {
        return false;
    }

    if (
        response.status === 401 ||
        (treatForbiddenAsUnauthorized && response.status === 403)
    ) {
        return true;
    }

    const errorBody = await response
        .clone()
        .json()
        .catch(() => null);

    const errorCode = errorBody?.error?.code;
    return errorCode === "UNAUTHORIZED" || errorCode === "TOKEN_EXPIRED";
};

async function refreshToken() {
    try {
        const proxyUrl = process.env.NEXT_PUBLIC_AUTH_PROXY;
        if (!proxyUrl) {
            throw new Error("Missing NEXT_PUBLIC_AUTH_PROXY env variable.");
        }

        const response = await fetch(`${proxyUrl}/auth/travel-split/refresh`, {
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error("Failed to refresh token.");
        }
    } catch (error) {
        logger.error("Could not refresh token:", error);
        throw error;
    }
}

async function apiFetch(
    url: string,
    options: RequestInit = {},
    {
        hasRetried = false,
        canReplayWrite,
        treatForbiddenAsUnauthorized = true,
    }: {
        hasRetried?: boolean;
        canReplayWrite?: () => boolean;
        treatForbiddenAsUnauthorized?: boolean;
    } = {},
): Promise<Response> {
    try {
        const response = await fetch(url, options);

        // A server error with an auth-looking payload may follow an applied write.
        const isDenied = canReplayWrite
            ? response.status === 401 ||
              (treatForbiddenAsUnauthorized && response.status === 403)
            : await isUnauthorizedResponse(response, {
                  treatForbiddenAsUnauthorized,
              });
        if (!isDenied || hasRetried) {
            return response;
        }

        const retry = () => {
            if (options.signal?.aborted || (canReplayWrite && !canReplayWrite())) {
                return response;
            }
            return apiFetch(url, options, {
                hasRetried: true,
                canReplayWrite,
                treatForbiddenAsUnauthorized,
            });
        };

        if (isRefreshing) {
            return new Promise<void>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(
                retry,
                (error) => {
                    if (canReplayWrite) return response;
                    throw error;
                },
            );
        }

        isRefreshing = true;

        try {
            await refreshToken();
            processQueue();
            return retry();
        } catch (refreshError) {
            processQueue(refreshError);
            if (canReplayWrite) return response;
            if (typeof window !== "undefined") {
                window.location.href = "/";
            }
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    } catch (error) {
        logger.log(
            "apiFetch error:",
            error instanceof Error ? error.message : error,
        );

        throw error;
    }
}

async function processGcfResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        // The fetcher will handle token expiry, but we leave this as a fallback.
        if (response.status === 401 || response.status === 403) {
            throw new Error("TOKEN_EXPIRED");
        }
        const err = new Error(`Failed to fetch: ${response.statusText}`);
        logger.log("🚀 Fail to fetch api", err.message);
        throw err;
    }

    const result = await response.json();
    logger.log("🚀 Fetched result:", result);

    if (result.success) {
        return result.data as T;
    } else {
        throw new Error(result.error?.message || "Unknown error from server");
    }
}

async function readExpenseWriteResult(
    response: Response,
): Promise<ExpenseWriteResult> {
    if (response.status === 401 || response.status === 403) {
        return "rejected";
    }

    const result: unknown = await response.json();
    if (typeof result !== "object" || result === null || !("success" in result)) {
        return "unknown";
    }
    if (response.ok && result.success === true) return "saved";
    if (
        (response.ok || response.status === 400 || response.status === 422) &&
        result.success === false
    ) {
        return "rejected";
    }
    return "unknown";
}

// Special handler for /me which might not be wrapped in the GCF response format
async function processUserResponse(response: Response): Promise<User> {
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    // Assumes the /me endpoint returns the User object directly
    return response.json();
}

const getGcfUrl = (path: string, sheetId = getSelectedSheetId()) => {
    const gcfUrl = process.env.NEXT_PUBLIC_TRAVEL_SPLIT_GCF;
    if (!gcfUrl) {
        throw new Error("Missing NEXT_PUBLIC_TRAVEL_SPLIT_GCF env variable.");
    }
    if (!sheetId) {
        throw new Error("Missing NEXT_PUBLIC_SHEET_ID env variable.");
    }
    const url = new URL(`${gcfUrl}${path}`);
    url.searchParams.append("sheetId", sheetId);
    return url.toString();
};

function statusToTodoErrorCode(status: number): string {
    switch (status) {
        case 400:
            return "INVALID_PARAMS";
        case 401:
            return "UNAUTHORIZED";
        case 403:
            return "FORBIDDEN";
        case 404:
            return "NOT_FOUND";
        case 408:
            return "TIMEOUT";
        case 422:
            return "INVALID_SHEET_LAYOUT";
        case 429:
            return "RATE_LIMITED";
        default:
            return status >= 500 ? "INTERNAL_SERVER_ERROR" : "UNKNOWN_ERROR";
    }
}

async function processTodoResponse<T>(response: Response): Promise<T> {
    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new TodoApiError(
            `Invalid response from server (${response.status || "unknown"})`,
            response.ok
                ? "INVALID_RESPONSE"
                : statusToTodoErrorCode(response.status),
            response.status,
        );
    }

    if (typeof body !== "object" || body === null || !("success" in body)) {
        throw new TodoApiError(
            response.statusText || "Invalid response from server",
            response.ok
                ? "INVALID_RESPONSE"
                : statusToTodoErrorCode(response.status),
            response.status,
        );
    }

    const envelope = body as {
        success: unknown;
        data?: unknown;
        error?: { code?: unknown; message?: unknown } | null;
    };

    if (!response.ok || envelope.success !== true) {
        const trimmedCode =
            typeof envelope.error?.code === "string"
                ? envelope.error.code.trim()
                : "";
        const code = trimmedCode || statusToTodoErrorCode(response.status);
        const trimmedMessage =
            typeof envelope.error?.message === "string"
                ? envelope.error.message.trim()
                : "";
        const message =
            trimmedMessage ||
            response.statusText ||
            "Unknown error from server";
        throw new TodoApiError(message, code, response.status);
    }

    return envelope.data as T;
}

function getPinnedTodosUrl(sheetId: string, suffix = ""): URL {
    const trimmedSheetId = typeof sheetId === "string" ? sheetId.trim() : "";
    if (!trimmedSheetId) {
        throw new TodoApiError(
            "Missing sheetId for todo request.",
            "INVALID_PARAMS",
        );
    }
    return new URL(getGcfUrl(`/todos${suffix}`, trimmedSheetId));
}

const VALID_TODO_SYNC_OP_STATUSES = new Set<TodoSyncOpResultStatus>([
    "applied",
    "not_found",
    "forbidden",
    "invalid",
]);

function isValidTodoSyncResponse(data: unknown): data is TodoSyncResponse {
    if (typeof data !== "object" || data === null) {
        return false;
    }
    const candidate = data as { results?: unknown; syncedAt?: unknown };
    if (
        !Array.isArray(candidate.results) ||
        typeof candidate.syncedAt !== "string" ||
        !candidate.syncedAt.trim()
    ) {
        return false;
    }
    for (const entry of candidate.results) {
        if (typeof entry !== "object" || entry === null) {
            return false;
        }
        const opResult = entry as {
            opId?: unknown;
            status?: unknown;
            item?: unknown;
        };
        if (opResult.opId !== null && typeof opResult.opId !== "string") {
            return false;
        }
        if (
            typeof opResult.status !== "string" ||
            !VALID_TODO_SYNC_OP_STATUSES.has(
                opResult.status as TodoSyncOpResultStatus,
            )
        ) {
            return false;
        }
        if (
            opResult.item !== undefined &&
            (typeof opResult.item !== "object" ||
                opResult.item === null ||
                typeof (opResult.item as { id?: unknown }).id !== "string")
        ) {
            return false;
        }
    }
    return true;
}

function assertOnlineForTodoWrite() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new TodoApiError(
            "Cannot modify todos while offline.",
            "OFFLINE",
        );
    }
}

const TWD_TOTAL_COLUMN = "金額（台幣）";
const LEGACY_TWD_TOTAL_COLUMN = "台幣總額";

function readExpenseNumber(raw: string | number | null | undefined) {
    if (raw == null || (typeof raw === "string" && !raw.trim())) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

function mapRawExpenseToExpense(
    raw: RawExpense,
    currentUserEmail: string,
    users: Record<string, string>,
): Expense {
    const amount = readExpenseNumber(raw["金額"]);
    const rate = readExpenseNumber(raw["匯率"]);
    const personalShare = readExpenseNumber(raw["個人小記"]);
    const hasFormulaSplit = Boolean(raw["分攤設定"]);
    const twdTotal = raw[TWD_TOTAL_COLUMN] ?? raw[LEGACY_TWD_TOTAL_COLUMN];
    if (
        hasFormulaSplit &&
        (readExpenseNumber(twdTotal) === undefined ||
            readExpenseNumber(raw["分攤差額"]) === undefined ||
            personalShare === undefined)
    ) {
        throw new Error("試算表有無法計算的支出。請檢查付款人分頁的金額與匯率。");
    }

    const splitsJson: Record<string, number> = {
        [currentUserEmail]: personalShare ?? 0,
    };
    const reservedColumns = new Set([
        "時間戳記", "日期", "星期", "類別", "品項", "金額", "貨幣", "匯率", "付款人",
        "個人小記", "已結算", TWD_TOTAL_COLUMN, LEGACY_TWD_TOTAL_COLUMN, "分攤差額", "分攤設定",
    ]);
    for (const [email, name] of Object.entries(users)) {
        if (reservedColumns.has(name)) continue;
        const share = readExpenseNumber(raw[name]);
        if (share !== undefined) splitsJson[email] = share;
    }

    return {
        timestamp: raw["時間戳記"],
        date: raw["日期"],
        itemName: raw["品項"],
        category: raw["類別"],
        payer: raw["付款人"],
        amount: amount ?? NaN,
        currency: raw["貨幣"],
        exchangeRate: rate || 1,
        splitsJson,
    };
}

export const api = {
    async getSheetConfig(sheetId?: string): Promise<SheetConfig> {
        const url = getGcfUrl("/setting", sheetId);
        const response = await apiFetch(url, {
            method: "GET",
            credentials: "include",
        });
        const sheetConfig = await processGcfResponse<SheetConfig>(response);
        logger.log("🚀 getSheetConfig:", sheetConfig);
        return sheetConfig;
    },

    async addExpense(
        expense: AddExpenseRequest,
        sheetId: string,
        canReplayWrite: () => boolean,
    ): Promise<ExpenseWriteResult> {
        let url: string;
        try {
            url = getGcfUrl("/add", sheetId);
        } catch (error) {
            logger.error("Could not construct the add expense URL.", error);
            return "rejected";
        }

        const controller = new AbortController();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<ExpenseWriteResult>((resolve) => {
            timeout = setTimeout(() => {
                resolve("unknown");
                controller.abort();
            }, 20_000);
        });
        try {
            const writeResult = apiFetch(
                url,
                {
                    method: "POST",
                    credentials: "include",
                    redirect: "error",
                    signal: controller.signal,
                    body: JSON.stringify({ payload: expense }),
                    headers: { "Content-Type": "application/json" },
                },
                { canReplayWrite },
            ).then(readExpenseWriteResult);
            return await Promise.race([writeResult, deadline]);
        } catch {
            return "unknown";
        } finally {
            clearTimeout(timeout);
        }
    },

    async getExpenses(
        userEmail: string,
        users: Record<string, string>,
        sheetId: string,
        signal: AbortSignal,
    ): Promise<Expense[]> {
        logger.log("🚀 getExpenses called for: ", userEmail);
        const url = new URL(getGcfUrl("/data", sheetId));
        url.searchParams.append("email", userEmail);

        const response = await apiFetch(url.toString(), {
            method: "GET",
            credentials: "include",
            signal,
        });

        // The API now returns a raw format that needs conversion.
        const rawExpenses = await processGcfResponse<RawExpense[]>(response);
        return rawExpenses.map((raw) =>
            mapRawExpenseToExpense(raw, userEmail, users),
        );
    },

    async deleteExpenses(timestamp: string): Promise<DeleteExpenseResponse> {
        logger.log("🚀 deleteExpenses called for: ", timestamp);
        const url = new URL(getGcfUrl("/delete"));

        const response = await apiFetch(url.toString(), {
            method: "DELETE",
            credentials: "include",
            body: JSON.stringify({ timestamp: timestamp }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        return processGcfResponse<DeleteExpenseResponse>(response);
    },

    async getCurrentUser(): Promise<User> {
        const proxyUrl = process.env.NEXT_PUBLIC_AUTH_PROXY;
        if (!proxyUrl) {
            throw new Error("Missing NEXT_PUBLIC_AUTH_PROXY env variable.");
        }
        const response = await fetch(`${proxyUrl}/auth/travel-split/me`, {
            method: "GET",
            credentials: "include",
        });
        logger.log("🚀 Fetched /me response:", response);

        return processUserResponse(response);
    },

    async getTodos(
        sheetId: string,
        ownerEmail?: string,
        signal?: AbortSignal,
    ): Promise<TodoItem[]> {
        const url = getPinnedTodosUrl(sheetId);
        const trimmedOwner =
            typeof ownerEmail === "string" ? ownerEmail.trim() : "";
        if (trimmedOwner) {
            url.searchParams.append("ownerEmail", trimmedOwner);
        }

        const response = await apiFetch(
            url.toString(),
            {
                method: "GET",
                credentials: "include",
                signal,
            },
            { treatForbiddenAsUnauthorized: false },
        );
        const data = await processTodoResponse<TodoItem[]>(response);
        if (!Array.isArray(data)) {
            throw new TodoApiError(
                "Invalid todo list response.",
                "INVALID_RESPONSE",
                response.status,
            );
        }
        return data;
    },

    async syncTodos(
        sheetId: string,
        ops: readonly TodoSyncOp[],
        options: SyncTodosOptions = {},
    ): Promise<TodoSyncResponse> {
        if (!Array.isArray(ops) || ops.length === 0 || ops.length > TODO_SYNC_MAX_OPS) {
            throw new TodoApiError(
                `ops must contain between 1 and ${TODO_SYNC_MAX_OPS} operations.`,
                "INVALID_PARAMS",
            );
        }
        assertOnlineForTodoWrite();
        const url = getPinnedTodosUrl(sheetId, "/sync");
        const keepalive = Boolean(options.keepalive);
        const timeoutMs = options.timeoutMs ?? TODO_SYNC_TIMEOUT_MS;
        const useTimeout = !keepalive && timeoutMs > 0;
        const replayGuard = options.canReplayWrite ?? (() => true);

        const controller = useTimeout ? new AbortController() : null;
        let timedOut = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let onExternalAbort: (() => void) | undefined;

        if (controller && options.signal) {
            if (options.signal.aborted) {
                controller.abort(options.signal.reason);
            } else {
                onExternalAbort = () => controller.abort(options.signal?.reason);
                options.signal.addEventListener("abort", onExternalAbort, {
                    once: true,
                });
            }
        }

        const effectiveSignal = controller ? controller.signal : options.signal;
        const fetchInit: RequestInit = {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ ops }),
            headers: {
                "Content-Type": "application/json",
            },
            ...(effectiveSignal ? { signal: effectiveSignal } : {}),
            ...(keepalive ? { keepalive: true } : {}),
        };

        const requestPromise = (async () => {
            const response = await apiFetch(url.toString(), fetchInit, {
                hasRetried: keepalive,
                canReplayWrite: replayGuard,
                treatForbiddenAsUnauthorized: false,
            });
            const data = await processTodoResponse<unknown>(response);
            if (!isValidTodoSyncResponse(data)) {
                throw new TodoApiError(
                    "Invalid sync todos response.",
                    "INVALID_RESPONSE",
                    response.status,
                );
            }
            return {
                results: data.results,
                syncedAt: data.syncedAt,
            };
        })();

        // Prevent unhandled rejection if the timeout deadline wins the race.
        requestPromise.catch(() => {});

        try {
            if (!useTimeout || !controller) {
                return await requestPromise;
            }
            const deadline = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    timedOut = true;
                    controller.abort();
                    reject(
                        new TodoApiError(
                            "Todo sync request timed out.",
                            "TIMEOUT",
                        ),
                    );
                }, timeoutMs);
            });
            return await Promise.race([requestPromise, deadline]);
        } catch (error) {
            if (timedOut) {
                throw new TodoApiError(
                    "Todo sync request timed out.",
                    "TIMEOUT",
                );
            }
            throw error;
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
            if (options.signal && onExternalAbort) {
                options.signal.removeEventListener("abort", onExternalAbort);
            }
        }
    },
};

export const defaultTodoSyncTransport: TodoSyncTransport = {
    syncTodos: (sheetId, ops, options) => api.syncTodos(sheetId, ops, options),
};
