export const TODO_TEXT_MAX_LENGTH = 500;
export const TODO_TEXT_COUNTER_SHOW_THRESHOLD = 400;
export const TODO_TEXT_COUNTER_WARN_THRESHOLD = 480;

export const TODO_CATEGORY_MAX_LENGTH = 30;
export const TODO_CATEGORY_COUNTER_SHOW_THRESHOLD = 24;
export const TODO_CATEGORY_COUNTER_WARN_THRESHOLD = 28;
export const UNCATEGORIZED_LABEL = "未分類";

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

export type TodoCategoryValidationResult =
    | { ok: true; category: string }
    | { ok: false; reason: "too_long" };

export type TodoCategoryGroup<T> = {
    key: string;
    label: string;
    isUncategorized: boolean;
    showHeader: boolean;
    items: T[];
    completed: number;
    total: number;
};

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
 * Counts Unicode code points (treating surrogate pairs such as emoji as 1).
 */
export function countUnicodeCodePoints(value: string): number {
    return Array.from(value).length;
}

/**
 * Truncates a string to at most maxLength Unicode code points without splitting surrogate pairs.
 */
export function truncateUnicodeCodePoints(
    value: string,
    maxLength: number,
): string {
    if (maxLength <= 0) {
        return "";
    }
    return Array.from(value).slice(0, maxLength).join("");
}

/**
 * Normalizes a todo category by converting line breaks to single spaces, trimming edges
 * (without collapsing internal spaces), and mapping blank or "未分類" to "".
 * Does not truncate overlong legacy values so display can render them safely.
 */
export function normalizeTodoCategory(raw: string | null | undefined): string {
    if (typeof raw !== "string") {
        return "";
    }
    const normalized = sanitizeTodoLineBreaks(raw).trim();
    return normalized === UNCATEGORIZED_LABEL ? "" : normalized;
}

/**
 * Validates a normalized todo category against the 0..30 Unicode code point bound.
 */
export function validateTodoCategory(
    raw: string | null | undefined,
): TodoCategoryValidationResult {
    const category = normalizeTodoCategory(raw);
    if (countUnicodeCodePoints(category) > TODO_CATEGORY_MAX_LENGTH) {
        return { ok: false, reason: "too_long" };
    }
    return { ok: true, category };
}

/**
 * Returns category character counter metadata once length reaches 24 code points.
 */
export function getCategoryCounter(length: number): TodoTextCounter | null {
    if (length < TODO_CATEGORY_COUNTER_SHOW_THRESHOLD) {
        return null;
    }
    if (length >= TODO_CATEGORY_MAX_LENGTH) {
        return {
            label: `已達上限 ${length} / ${TODO_CATEGORY_MAX_LENGTH}`,
            level: "limit",
        };
    }
    if (length >= TODO_CATEGORY_COUNTER_WARN_THRESHOLD) {
        return {
            label: `${length} / ${TODO_CATEGORY_MAX_LENGTH}`,
            level: "warn",
        };
    }
    return {
        label: `${length} / ${TODO_CATEGORY_MAX_LENGTH}`,
        level: "normal",
    };
}

/**
 * Snaps a category input to an existing category spelling when they match
 * case-insensitively after normalization; otherwise returns the normalized input.
 */
export function snapToExistingCategory(
    raw: string | null | undefined,
    existing: readonly string[],
): string {
    const normalized = normalizeTodoCategory(raw);
    if (!normalized) {
        return "";
    }
    const needle = normalized.toLowerCase();
    let caseInsensitiveMatch = "";
    for (const entry of existing) {
        const candidate = normalizeTodoCategory(entry);
        if (!candidate) {
            continue;
        }
        if (candidate === normalized) {
            return candidate;
        }
        if (!caseInsensitiveMatch && candidate.toLowerCase() === needle) {
            caseInsensitiveMatch = candidate;
        }
    }
    return caseInsensitiveMatch || normalized;
}

/**
 * Returns unique non-empty categories present in items, ordered by group order
 * (earliest createdAt item per category, oldest first).
 */
export function getTodoCategories(
    items: readonly { createdAt: string; category?: string }[],
): string[] {
    const sorted = sortTodos(items);
    const seen = new Set<string>();
    const categories: string[] = [];
    for (const item of sorted) {
        const category = normalizeTodoCategory(item.category);
        if (
            category &&
            !seen.has(category) &&
            countUnicodeCodePoints(category) <= TODO_CATEGORY_MAX_LENGTH
        ) {
            seen.add(category);
            categories.push(category);
        }
    }
    return categories;
}

/**
 * Groups todos by normalized category. Groups are ordered by their earliest createdAt item
 * (oldest first), with "未分類" fixed last. Within each group, items keep sortTodos order.
 * When all items are uncategorized, returns a single uncategorized group with showHeader=false.
 */
export function groupTodosByCategory<
    T extends { createdAt: string; checked?: boolean; category?: string },
>(items: readonly T[]): TodoCategoryGroup<T>[] {
    if (items.length === 0) {
        return [];
    }

    const sorted = sortTodos(items);
    const categorized = new Map<string, T[]>();
    const uncategorized: T[] = [];

    for (const item of sorted) {
        const key = normalizeTodoCategory(item.category);
        if (!key) {
            uncategorized.push(item);
            continue;
        }
        const bucket = categorized.get(key);
        if (bucket) {
            bucket.push(item);
        } else {
            categorized.set(key, [item]);
        }
    }

    const hasCategorized = categorized.size > 0;
    const groups: TodoCategoryGroup<T>[] = [];

    for (const [key, groupItems] of categorized.entries()) {
        let completed = 0;
        for (const item of groupItems) {
            if (item.checked === true) {
                completed += 1;
            }
        }
        groups.push({
            key,
            label: key,
            isUncategorized: false,
            showHeader: true,
            items: groupItems,
            completed,
            total: groupItems.length,
        });
    }

    if (uncategorized.length > 0) {
        let completed = 0;
        for (const item of uncategorized) {
            if (item.checked === true) {
                completed += 1;
            }
        }
        groups.push({
            key: "",
            label: UNCATEGORIZED_LABEL,
            isUncategorized: true,
            showHeader: hasCategorized,
            items: uncategorized,
            completed,
            total: uncategorized.length,
        });
    }

    return groups;
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
