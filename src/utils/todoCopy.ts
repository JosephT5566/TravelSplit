import {
    getTodoErrorKind,
    normalizeTodoText,
    sortTodos,
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
};

export type TodoCopyCandidate = {
    id: string;
    text: string;
    isDuplicate: boolean;
};

export type TodoCopyPayloadItem = {
    text: string;
    checked: false;
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

/**
 * Sorts source todos by createdAt ascending (stable) and flags duplicates against myItems
 * using case-sensitive normalizeTodoText equality. Nothing is flagged when myItems is undefined.
 */
export function buildCopyCandidates(
    sourceItems: readonly TodoCopySourceItem[],
    myItems?: readonly { text: string }[] | undefined,
): TodoCopyCandidate[] {
    const sorted = sortTodos(sourceItems);
    const myNormalizedTexts =
        myItems === undefined
            ? null
            : new Set(myItems.map((item) => normalizeTodoText(item.text)));

    return sorted.map((item) => ({
        id: item.id,
        text: item.text,
        isDuplicate:
            myNormalizedTexts !== null &&
            myNormalizedTexts.has(normalizeTodoText(item.text)),
    }));
}

/**
 * Builds POST /todos payload items for selected candidates in source order.
 * Copied items are always unchecked and omit id, ownerEmail, and timestamps.
 */
export function buildCopyItems(
    candidates: readonly { id: string; text: string }[],
    selectedIds: ReadonlySet<string>,
): TodoCopyPayloadItem[] {
    const result: TodoCopyPayloadItem[] = [];
    for (const candidate of candidates) {
        if (selectedIds.has(candidate.id)) {
            result.push({ text: candidate.text, checked: false });
        }
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
