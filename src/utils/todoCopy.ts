import {
    countUnicodeCodePoints,
    getTodoErrorKind,
    groupTodosByCategory,
    normalizeTodoCategory,
    normalizeTodoText,
    sortTodos,
    TODO_CATEGORY_MAX_LENGTH,
    truncateUnicodeCodePoints,
} from "./todoList.ts";

export const TODO_COPY_BATCH_SIZE = 100;

export type TodoMemberOption = {
    email: string;
    label: string;
    displayName: string;
    isMe: boolean;
};

export type TodoCopySourceItem = {
    id: string;
    text: string;
    createdAt: string;
    category?: string;
};

export type CopyCategoryMatchKind =
    | "uncategorized"
    | "exact"
    | "merged"
    | "new"
    | "unknown";

export type ResolvedCopyCategory = {
    sourceCategory: string;
    targetCategory: string;
    matchKind: CopyCategoryMatchKind;
};

export type TodoCopyCandidate = {
    id: string;
    text: string;
    createdAt: string;
    sourceCategory: string;
    category: string;
    categoryMatchKind: CopyCategoryMatchKind;
    isDuplicate: boolean;
};

export type TodoCopyCandidateGroup = {
    key: string;
    label: string;
    isUncategorized: boolean;
    showHeader: boolean;
    items: TodoCopyCandidate[];
    total: number;
};

export type TodoCopyPayloadItem = {
    text: string;
    checked: false;
    category?: string;
};

export type CopyErrorClassification = "definitely-not-sent" | "unconfirmed";

export type CopyResultSummary = {
    status: "success" | "partial" | "failed";
    message: string;
    detail?: string;
    remaining: number;
    classification?: CopyErrorClassification;
};

type CopyErrorLike = {
    code?: unknown;
    status?: unknown;
};

const DEFINITELY_NOT_SENT_CODES = new Set([
    "OFFLINE",
    "FORBIDDEN",
    "NOT_FOUND",
    "INVALID_SHEET_LAYOUT",
    "UNAUTHORIZED",
    "TOKEN_EXPIRED",
    "INVALID_PARAMS",
    "BAD_REQUEST",
]);

function getEmailLocalPart(email: string): string {
    const atIndex = email.indexOf("@");
    if (atIndex > 0) {
        const localPart = email.slice(0, atIndex).trim();
        if (localPart) {
            return localPart;
        }
    }
    return email;
}

function resolveMemberDisplayName(email: string, rawName?: unknown): string {
    if (typeof rawName === "string") {
        const trimmed = rawName.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    return getEmailLocalPart(email);
}

/**
 * Builds the member switcher options from sheetConfig.users.
 * Current user is always placed first with label "我" (even if absent from users).
 * Remaining members keep object key order; empty email keys are ignored.
 */
export function buildMemberOptions(
    users: Record<string, string> | null | undefined,
    currentEmail: string,
): TodoMemberOption[] {
    const safeUsers = users && typeof users === "object" ? users : {};
    const trimmedCurrentEmail =
        typeof currentEmail === "string" ? currentEmail.trim() : "";

    const seen = new Set<string>();
    const options: TodoMemberOption[] = [];

    if (trimmedCurrentEmail) {
        const currentRawName = Object.hasOwn(safeUsers, trimmedCurrentEmail)
            ? safeUsers[trimmedCurrentEmail]
            : undefined;
        options.push({
            email: trimmedCurrentEmail,
            label: "我",
            displayName: resolveMemberDisplayName(
                trimmedCurrentEmail,
                currentRawName,
            ),
            isMe: true,
        });
        seen.add(trimmedCurrentEmail);
    }

    for (const [rawEmail, rawName] of Object.entries(safeUsers)) {
        const email = rawEmail.trim();
        if (!email || seen.has(email)) {
            continue;
        }
        seen.add(email);
        const displayName = resolveMemberDisplayName(email, rawName);
        options.push({
            email,
            label: displayName,
            displayName,
            isMe: false,
        });
    }

    return options;
}

function sanitizeCopyCategory(raw: string | null | undefined): string {
    const normalized = normalizeTodoCategory(raw);
    if (!normalized) {
        return "";
    }
    if (countUnicodeCodePoints(normalized) <= TODO_CATEGORY_MAX_LENGTH) {
        return normalized;
    }
    return normalizeTodoCategory(
        truncateUnicodeCodePoints(normalized, TODO_CATEGORY_MAX_LENGTH),
    );
}

function buildExistingCategoryMap(
    myItems: readonly { createdAt?: string; category?: string }[],
): Map<string, string> {
    const ordered = sortTodos(
        myItems.map((item) => ({
            createdAt: item.createdAt ?? "",
            category: item.category,
        })),
    );
    const map = new Map<string, string>();
    for (const item of ordered) {
        const sanitized = sanitizeCopyCategory(item.category);
        if (!sanitized) {
            continue;
        }
        const lower = sanitized.toLowerCase();
        if (!map.has(lower)) {
            map.set(lower, sanitized);
        }
    }
    return map;
}

/**
 * Resolves each normalized source category to its target write category and match kind.
 * - Normalizes line breaks/edges and truncates overlong legacy categories to 30 code points.
 * - Case-insensitively snaps to existing spellings in myItems when available.
 * - For brand-new categories differing only in case within the batch, first spelling wins
 *   in source createdAt order.
 * - Uncategorized items remain uncategorized ("").
 */
export function resolveCopyCategories(
    sourceItems: readonly { createdAt: string; category?: string }[],
    myItems?: readonly { createdAt?: string; category?: string }[] | undefined,
): Map<string, ResolvedCopyCategory> {
    const sorted = sortTodos(sourceItems);
    const myCategoryByLower =
        myItems === undefined ? null : buildExistingCategoryMap(myItems);
    const batchSpellingByLower = new Map<string, string>();
    const resolved = new Map<string, ResolvedCopyCategory>();

    for (const item of sorted) {
        const sourceCategory = normalizeTodoCategory(item.category);
        if (resolved.has(sourceCategory)) {
            continue;
        }

        const writeBase = sanitizeCopyCategory(item.category);
        if (!writeBase) {
            resolved.set(sourceCategory, {
                sourceCategory: "",
                targetCategory: "",
                matchKind: "uncategorized",
            });
            continue;
        }

        const lower = writeBase.toLowerCase();
        if (myCategoryByLower !== null) {
            const myExisting = myCategoryByLower.get(lower);
            if (myExisting !== undefined) {
                resolved.set(sourceCategory, {
                    sourceCategory,
                    targetCategory: myExisting,
                    matchKind:
                        myExisting === sourceCategory ? "exact" : "merged",
                });
                continue;
            }
            const firstInBatch = batchSpellingByLower.get(lower);
            if (firstInBatch !== undefined) {
                resolved.set(sourceCategory, {
                    sourceCategory,
                    targetCategory: firstInBatch,
                    matchKind: "new",
                });
            } else {
                batchSpellingByLower.set(lower, writeBase);
                resolved.set(sourceCategory, {
                    sourceCategory,
                    targetCategory: writeBase,
                    matchKind: "new",
                });
            }
            continue;
        }

        const firstInBatch = batchSpellingByLower.get(lower);
        if (firstInBatch !== undefined) {
            resolved.set(sourceCategory, {
                sourceCategory,
                targetCategory: firstInBatch,
                matchKind: "unknown",
            });
        } else {
            batchSpellingByLower.set(lower, writeBase);
            resolved.set(sourceCategory, {
                sourceCategory,
                targetCategory: writeBase,
                matchKind: "unknown",
            });
        }
    }

    return resolved;
}

/**
 * Sorts source todos by createdAt ascending (stable), resolves target categories,
 * and flags duplicates against myItems using case-sensitive normalizeTodoText equality
 * (ignoring category). Nothing is flagged as duplicate when myItems is undefined.
 */
export function buildCopyCandidates(
    sourceItems: readonly TodoCopySourceItem[],
    myItems?:
        | readonly { text: string; createdAt?: string; category?: string }[]
        | undefined,
): TodoCopyCandidate[] {
    const sorted = sortTodos(sourceItems);
    const resolutions = resolveCopyCategories(sorted, myItems);
    const myNormalizedTexts =
        myItems === undefined
            ? null
            : new Set(myItems.map((item) => normalizeTodoText(item.text)));

    return sorted.map((item) => {
        const sourceCategory = normalizeTodoCategory(item.category);
        const resolution = resolutions.get(sourceCategory);
        return {
            id: item.id,
            text: item.text,
            createdAt: item.createdAt,
            sourceCategory,
            category: resolution?.targetCategory ?? "",
            categoryMatchKind:
                resolution?.matchKind ??
                (sourceCategory ? "unknown" : "uncategorized"),
            isDuplicate:
                myNormalizedTexts !== null &&
                myNormalizedTexts.has(normalizeTodoText(item.text)),
        };
    });
}

/**
 * Groups copy candidates by their normalized source category using the same group
 * ordering as groupTodosByCategory (earliest createdAt first, "未分類" last,
 * showHeader=false when only "未分類" exists).
 */
export function groupCopyCandidatesByCategory(
    candidates: readonly TodoCopyCandidate[],
): TodoCopyCandidateGroup[] {
    const wrapped = candidates.map((candidate) => ({
        createdAt: candidate.createdAt,
        category: candidate.sourceCategory,
        checked: false,
        candidate,
    }));
    return groupTodosByCategory(wrapped).map((group) => ({
        key: group.key,
        label: group.label,
        isUncategorized: group.isUncategorized,
        showHeader: group.showHeader,
        items: group.items.map((entry) => entry.candidate),
        total: group.total,
    }));
}

/**
 * Toggles selection for all items in a group without mutating selectedIds.
 * If every item in groupItemIds is currently selected, deselects them all;
 * otherwise selects every item in groupItemIds (including duplicates).
 */
export function toggleGroupSelection(
    selectedIds: ReadonlySet<string>,
    groupItemIds: readonly string[],
): Set<string> {
    const next = new Set(selectedIds);
    if (groupItemIds.length === 0) {
        return next;
    }
    const allSelected = groupItemIds.every((id) => selectedIds.has(id));
    if (allSelected) {
        for (const id of groupItemIds) {
            next.delete(id);
        }
    } else {
        for (const id of groupItemIds) {
            next.add(id);
        }
    }
    return next;
}

/**
 * Builds POST /todos payload items for selected candidates in source creation order.
 * Copied items are always unchecked, omit id/ownerEmail/timestamps, and carry a normalized,
 * 30-code-point-capped category when non-empty (first spelling in the batch wins on case ties).
 */
export function buildCopyItems(
    candidates: readonly { id: string; text: string; category?: string }[],
    selectedIds: ReadonlySet<string>,
): TodoCopyPayloadItem[] {
    const result: TodoCopyPayloadItem[] = [];
    const batchSpellingByLower = new Map<string, string>();

    for (const candidate of candidates) {
        if (!selectedIds.has(candidate.id)) {
            continue;
        }
        const sanitized = sanitizeCopyCategory(candidate.category);
        if (!sanitized) {
            result.push({ text: candidate.text, checked: false });
            continue;
        }
        const lower = sanitized.toLowerCase();
        const existingInBatch = batchSpellingByLower.get(lower);
        const category = existingInBatch ?? sanitized;
        if (!existingInBatch) {
            batchSpellingByLower.set(lower, category);
        }
        result.push({ text: candidate.text, checked: false, category });
    }
    return result;
}

/**
 * Splits items into sequential batches of at most `size` (default 100).
 */
export function chunkCopyItems<T>(
    items: readonly T[],
    size = TODO_COPY_BATCH_SIZE,
): T[][] {
    if (!Number.isInteger(size) || size <= 0) {
        throw new RangeError("Batch size must be a positive integer.");
    }
    if (items.length === 0) {
        return [];
    }
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

/**
 * Checks whether a duck-typed todo error represents 400 INVALID_PARAMS.
 */
export function isInvalidParamsError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    const candidate = error as CopyErrorLike;
    const code =
        typeof candidate.code === "string" ? candidate.code.trim() : "";
    const status =
        typeof candidate.status === "number" ? candidate.status : undefined;

    if (code === "INVALID_PARAMS") {
        return true;
    }
    return !code && status === 400;
}

/**
 * Classifies a thrown copy error as "definitely-not-sent" (OFFLINE, or 4xx with an explicit
 * rejection code) vs "unconfirmed" (network/timeout/unreadable response, 5xx, unknown).
 */
export function classifyCopyError(error: unknown): CopyErrorClassification {
    const kind = getTodoErrorKind(error);
    if (kind === "offline") {
        return "definitely-not-sent";
    }

    if (!error || typeof error !== "object") {
        return "unconfirmed";
    }

    const candidate = error as CopyErrorLike;
    const code =
        typeof candidate.code === "string" ? candidate.code.trim() : "";
    const status =
        typeof candidate.status === "number" ? candidate.status : undefined;

    if (!code || code === "INVALID_RESPONSE") {
        return "unconfirmed";
    }

    if (status !== undefined) {
        if (status >= 400 && status < 500 && status !== 408) {
            return "definitely-not-sent";
        }
        return "unconfirmed";
    }

    if (DEFINITELY_NOT_SENT_CODES.has(code)) {
        return "definitely-not-sent";
    }

    return "unconfirmed";
}

/**
 * Produces fixed Traditional Chinese status summaries for copy completion, partial failure,
 * and full failure without leaking server details or todo item text.
 */
export function summarizeCopyResult({
    total,
    copied,
    error,
}: {
    total: number;
    copied: number;
    error?: unknown;
}): CopyResultSummary {
    const safeTotal = Math.max(0, total);
    const safeCopied = Math.max(0, Math.min(copied, safeTotal));
    const remaining = safeTotal - safeCopied;

    if (error === undefined && safeCopied === safeTotal) {
        return {
            status: "success",
            message: `已複製 ${safeCopied} 項到我的清單`,
            remaining: 0,
        };
    }

    const classification = classifyCopyError(error);
    const kind = getTodoErrorKind(error);

    if (safeCopied > 0 && remaining > 0) {
        let detail: string;
        if (classification === "unconfirmed") {
            detail = `未自動重試。下方僅保留尚未複製的 ${remaining} 項，請先到我的清單確認，再決定是否重試。`;
        } else if (kind === "offline") {
            detail = `目前離線，未自動重試。下方僅保留尚未複製的 ${remaining} 項，恢復連線後可重試剩餘項目。`;
        } else if (kind === "forbidden") {
            detail = `沒有權限新增待辦，未自動重試。下方僅保留尚未複製的 ${remaining} 項。`;
        } else if (kind === "invalid_sheet_layout") {
            detail = `試算表格式有問題，請聯絡旅程管理員。下方僅保留尚未複製的 ${remaining} 項。`;
        } else if (kind === "unauthorized") {
            detail = `登入已過期，請重新登入。下方僅保留尚未複製的 ${remaining} 項。`;
        } else {
            detail = `發生錯誤，未自動重試。下方僅保留尚未複製的 ${remaining} 項，確認網路後可重試剩餘項目。`;
        }

        return {
            status: "partial",
            message: `已複製 ${safeCopied} / ${safeTotal} 項，尚有 ${remaining} 項未完成`,
            detail,
            remaining,
            classification,
        };
    }

    if (kind === "offline") {
        return {
            status: "failed",
            message: "目前離線，無法複製待辦",
            remaining,
            classification,
        };
    }

    if (kind === "forbidden") {
        return {
            status: "failed",
            message: "沒有權限新增待辦，請確認你仍是這個旅程的成員",
            remaining,
            classification,
        };
    }

    if (kind === "invalid_sheet_layout") {
        return {
            status: "failed",
            message: "試算表格式有問題，請聯絡旅程管理員",
            remaining,
            classification,
        };
    }

    if (kind === "unauthorized") {
        return {
            status: "failed",
            message: "登入已過期，請重新登入",
            remaining,
            classification,
        };
    }

    if (classification === "unconfirmed") {
        return {
            status: "failed",
            message: "無法複製待辦，請先到我的清單確認，再決定是否重試",
            detail: "暫時無法確認是否已複製成功。請先到我的清單確認，再決定是否重試，避免重複新增。",
            remaining,
            classification,
        };
    }

    return {
        status: "failed",
        message: "無法複製待辦，請重試",
        remaining,
        classification,
    };
}
