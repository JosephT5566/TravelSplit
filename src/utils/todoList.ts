export const TODO_TEXT_MAX_LENGTH = 500;
export const TODO_TEXT_COUNTER_SHOW_THRESHOLD = 400;
export const TODO_TEXT_COUNTER_WARN_THRESHOLD = 480;

export type TodoAction = "load" | "create" | "update" | "delete";

export type TodoErrorKind =
    | "offline"
    | "forbidden"
    | "not_found"
    | "invalid_sheet_layout"
    | "unauthorized"
    | "unknown";

export type TodoTextValidationResult =
    | { ok: true; text: string }
    | { ok: false; reason: "empty" | "too_long" };

export type TodoTextCounter = {
    label: string;
    level: "normal" | "warn" | "limit";
};

export type TodoCompletionStats = {
    completed: number;
    total: number;
    percent: number;
};

type TodoErrorLike = {
    code?: unknown;
    status?: unknown;
};

const LINE_BREAK_PATTERN = /\r\n|[\r\n\u2028\u2029]/g;

/**
 * Replaces line breaks with single spaces without trimming or collapsing other spaces.
 */
export function sanitizeTodoLineBreaks(raw: string): string {
    return raw.replace(LINE_BREAK_PATTERN, " ");
}

/**
 * Normalizes todo text by converting line breaks to single spaces and trimming edges.
 */
export function normalizeTodoText(raw: string): string {
    return sanitizeTodoLineBreaks(raw).trim();
}

/**
 * Validates normalized todo text against the 1..500 character bounds.
 */
export function validateTodoText(raw: string): TodoTextValidationResult {
    const text = normalizeTodoText(raw);
    if (text.length === 0) {
        return { ok: false, reason: "empty" };
    }
    if (text.length > TODO_TEXT_MAX_LENGTH) {
        return { ok: false, reason: "too_long" };
    }
    return { ok: true, text };
}

/**
 * Returns character counter metadata once length reaches 400 characters.
 */
export function getTextCounter(length: number): TodoTextCounter | null {
    if (length < TODO_TEXT_COUNTER_SHOW_THRESHOLD) {
        return null;
    }
    if (length >= TODO_TEXT_MAX_LENGTH) {
        return {
            label: `已達上限 ${length} / ${TODO_TEXT_MAX_LENGTH}`,
            level: "limit",
        };
    }
    if (length >= TODO_TEXT_COUNTER_WARN_THRESHOLD) {
        return {
            label: `${length} / ${TODO_TEXT_MAX_LENGTH}`,
            level: "warn",
        };
    }
    return {
        label: `${length} / ${TODO_TEXT_MAX_LENGTH}`,
        level: "normal",
    };
}

/**
 * Sorts todos by createdAt ascending (oldest first) without mutating the input array.
 * Checked state never affects ordering; ties and unparsable timestamps preserve input order.
 */
export function sortTodos<T extends { createdAt: string }>(
    items: readonly T[],
): T[] {
    return items
        .map((item, index) => ({
            item,
            index,
            timestamp: Date.parse(item.createdAt),
        }))
        .sort((a, b) => {
            const aValid = Number.isFinite(a.timestamp);
            const bValid = Number.isFinite(b.timestamp);

            if (aValid && bValid) {
                if (a.timestamp !== b.timestamp) {
                    return a.timestamp - b.timestamp;
                }
                return a.index - b.index;
            }
            if (aValid !== bValid) {
                return aValid ? -1 : 1;
            }
            return a.index - b.index;
        })
        .map((entry) => entry.item);
}

/**
 * Computes completed count, total count, and integer completion percentage (0..100).
 */
export function getCompletionStats(
    items: readonly { checked: boolean }[],
): TodoCompletionStats {
    const total = items.length;
    if (total === 0) {
        return { completed: 0, total: 0, percent: 0 };
    }
    let completed = 0;
    for (const item of items) {
        if (item.checked) {
            completed += 1;
        }
    }
    return {
        completed,
        total,
        percent: Math.round((completed / total) * 100),
    };
}

/**
 * Classifies a duck-typed todo API error without importing services/api.
 */
export function getTodoErrorKind(error: unknown): TodoErrorKind {
    if (!error || typeof error !== "object") {
        return "unknown";
    }

    const candidate = error as TodoErrorLike;
    const code =
        typeof candidate.code === "string" ? candidate.code.trim() : "";
    const status =
        typeof candidate.status === "number" ? candidate.status : undefined;

    if (code === "OFFLINE") {
        return "offline";
    }
    if (code === "FORBIDDEN") {
        return "forbidden";
    }
    if (code === "NOT_FOUND") {
        return "not_found";
    }
    if (code === "INVALID_SHEET_LAYOUT") {
        return "invalid_sheet_layout";
    }
    if (code === "UNAUTHORIZED" || code === "TOKEN_EXPIRED") {
        return "unauthorized";
    }

    if (!code) {
        if (status === 403) {
            return "forbidden";
        }
        if (status === 404) {
            return "not_found";
        }
        if (status === 422) {
            return "invalid_sheet_layout";
        }
        if (status === 401) {
            return "unauthorized";
        }
    }

    return "unknown";
}

export function isOfflineError(error: unknown): boolean {
    return getTodoErrorKind(error) === "offline";
}

export function isForbiddenError(error: unknown): boolean {
    return getTodoErrorKind(error) === "forbidden";
}

export function isNotFoundError(error: unknown): boolean {
    return getTodoErrorKind(error) === "not_found";
}

/**
 * Maps todo API errors to fixed Traditional Chinese messages without leaking server details.
 */
export function getTodoErrorMessage(
    error: unknown,
    action: TodoAction,
): string {
    const kind = getTodoErrorKind(error);
    switch (kind) {
        case "offline":
            return "目前離線，無法修改待辦";
        case "forbidden":
            return action === "load"
                ? "你不是這個旅程的成員，無法查看待辦"
                : "沒有權限修改這個待辦";
        case "not_found":
            return "這個待辦已不存在";
        case "invalid_sheet_layout":
            return "試算表格式有問題，請聯絡旅程管理員";
        case "unauthorized":
            return "登入已過期，請重新登入";
        default:
            return "無法完成，請重試";
    }
}
