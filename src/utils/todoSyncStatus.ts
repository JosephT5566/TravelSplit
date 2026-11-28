import type { TodoOutboxEntry } from "./todoOutbox.ts";

export const TODO_IDB_UNAVAILABLE_WARNING =
    "此裝置無法離線保存，請保持頁面開啟";

export const TODO_BACK_ONLINE_ANNOUNCEMENT = "已恢復連線";

export type TodoSyncStatusKind =
    | "failed"
    | "auth-expired"
    | "offline-pending"
    | "offline-idle"
    | "inflight"
    | "pending"
    | "refreshing"
    | "saved"
    | "refreshed"
    | "idle";

export type TodoSyncStatusTone =
    | "ok"
    | "syncing"
    | "pending"
    | "offline"
    | "failed";

export type TodoSyncStatusAction = "retry" | "sign-in" | "sync-now" | null;

export type TodoSyncAnnouncement = {
    role: "status" | "alert";
    politeness: "polite" | "assertive";
    text: string;
};

export type TodoSyncStatusPrevious = {
    kind: TodoSyncStatusKind;
    isOnline: boolean;
    text?: string;
    lastSavedAt?: number | null;
    lastRefreshedAt?: number | null;
};

export type DeriveSyncStatusInput = {
    entries?: readonly Pick<
        TodoOutboxEntry,
        "id" | "status" | "nextAttemptAt"
    >[];
    isOnline: boolean;
    isFlushing?: boolean;
    isRefreshing?: boolean;
    authExpired?: boolean;
    lastSavedAt?: number | null;
    lastRefreshedAt?: number | null;
    now?: number;
    idbUnavailable?: boolean;
    readOnly?: boolean;
};

export type TodoSyncStatusResult = {
    kind: TodoSyncStatusKind;
    tone: TodoSyncStatusTone;
    text: string;
    action: TodoSyncStatusAction;
    warning?: string;
    count?: number;
    retryInSeconds?: number;
};

export type TodoSyncAnnouncementState = {
    previous: TodoSyncStatusPrevious | null;
    politeText: string;
    alertText: string;
    lastDroppedNotice: string | null;
};

export type AdvanceSyncAnnouncementInput = {
    status: TodoSyncStatusResult;
    isOnline: boolean;
    readOnly?: boolean;
    lastSavedAt?: number | null;
    lastRefreshedAt?: number | null;
    droppedNotice?: string | null;
};

function isValidPositiveTimestamp(
    value: number | null | undefined,
): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Formats a timestamp in local 24-hour time:
 * - Today: `HH:mm`
 * - Yesterday: `昨天 HH:mm`
 * - Earlier (or other dates): `M/D HH:mm`
 */
export function formatTodoSyncTime(
    timestamp: number | Date,
    now?: number | Date,
): string {
    const target = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const reference =
        now instanceof Date
            ? now
            : now !== undefined
              ? new Date(now)
              : new Date();

    if (Number.isNaN(target.getTime()) || Number.isNaN(reference.getTime())) {
        return "";
    }

    const hours = String(target.getHours()).padStart(2, "0");
    const minutes = String(target.getMinutes()).padStart(2, "0");
    const timePart = `${hours}:${minutes}`;

    const refYear = reference.getFullYear();
    const refMonth = reference.getMonth();
    const refDate = reference.getDate();

    if (
        target.getFullYear() === refYear &&
        target.getMonth() === refMonth &&
        target.getDate() === refDate
    ) {
        return timePart;
    }

    const yesterday = new Date(refYear, refMonth, refDate - 1);
    if (
        target.getFullYear() === yesterday.getFullYear() &&
        target.getMonth() === yesterday.getMonth() &&
        target.getDate() === yesterday.getDate()
    ) {
        return `昨天 ${timePart}`;
    }

    return `${target.getMonth() + 1}/${target.getDate()} ${timePart}`;
}

/**
 * Determines whether a status (or status transition) should be announced via aria-live.
 * Announced: saved, refreshed, offline, failed/auth-expired (alert), back-online.
 * Not announced: pending, inflight (saving), refreshing, idle.
 */
export function getSyncStatusAnnouncement({
    kind,
    text,
    isOnline,
    readOnly = false,
    lastSavedAt,
    lastRefreshedAt,
    previous,
}: {
    kind: TodoSyncStatusKind;
    text: string;
    isOnline: boolean;
    readOnly?: boolean;
    lastSavedAt?: number | null;
    lastRefreshedAt?: number | null;
    previous?: TodoSyncStatusPrevious | null;
}): TodoSyncAnnouncement | undefined {
    if (!previous) {
        if (!text) {
            return undefined;
        }
        if (kind === "failed" || kind === "auth-expired") {
            return { role: "alert", politeness: "assertive", text };
        }
        if (
            kind === "offline-pending" ||
            kind === "offline-idle" ||
            kind === "saved" ||
            kind === "refreshed"
        ) {
            return { role: "status", politeness: "polite", text };
        }
        return undefined;
    }

    if (readOnly) {
        if (
            kind === "refreshed" &&
            text &&
            (previous.kind !== "refreshed" ||
                previous.lastRefreshedAt !== lastRefreshedAt)
        ) {
            return { role: "status", politeness: "polite", text };
        }
        return undefined;
    }

    if (kind === "failed" || kind === "auth-expired") {
        if (previous.kind !== kind || previous.text !== text) {
            return { role: "alert", politeness: "assertive", text };
        }
        if (!previous.isOnline && isOnline) {
            return {
                role: "status",
                politeness: "polite",
                text: TODO_BACK_ONLINE_ANNOUNCEMENT,
            };
        }
        if (previous.isOnline && !isOnline) {
            return { role: "status", politeness: "polite", text: "離線" };
        }
        return undefined;
    }

    if (!previous.isOnline && isOnline) {
        return {
            role: "status",
            politeness: "polite",
            text: TODO_BACK_ONLINE_ANNOUNCEMENT,
        };
    }

    if (previous.isOnline && !isOnline) {
        return text
            ? { role: "status", politeness: "polite", text }
            : { role: "status", politeness: "polite", text: "離線" };
    }

    if (!isOnline) {
        return undefined;
    }

    if (
        kind === "saved" &&
        text &&
        (previous.kind !== "saved" || previous.lastSavedAt !== lastSavedAt)
    ) {
        return { role: "status", politeness: "polite", text };
    }

    if (
        kind === "refreshed" &&
        text &&
        (previous.kind !== "refreshed" ||
            previous.lastRefreshedAt !== lastRefreshedAt)
    ) {
        return { role: "status", politeness: "polite", text };
    }

    return undefined;
}

/**
 * Derives the single status line representation per spec §4 priority:
 * failed > auth-expired > offline-pending > offline-idle > inflight >
 * pending (with backoff countdown) > refreshing > saved > refreshed.
 * Read-only teammate views only display `已更新 · HH:mm`.
 */
export function deriveSyncStatus(
    input: DeriveSyncStatusInput,
): TodoSyncStatusResult {
    const now = input.now ?? Date.now();
    const isOnline = input.isOnline;
    const readOnly = Boolean(input.readOnly);
    const hasSaved = isValidPositiveTimestamp(input.lastSavedAt);
    const hasRefreshed = isValidPositiveTimestamp(input.lastRefreshedAt);

    if (readOnly) {
        const kind: TodoSyncStatusKind = hasRefreshed ? "refreshed" : "idle";
        const text = hasRefreshed
            ? `已更新 · ${formatTodoSyncTime(input.lastRefreshedAt!, now)}`
            : "";
        return {
            kind,
            tone: "ok",
            text,
            action: null,
        };
    }

    const entries = input.entries ?? [];
    const failedIds = new Set<string>();
    const inflightIds = new Set<string>();
    const pendingIds = new Set<string>();
    const activeIds = new Set<string>();
    const pendingEntries: Pick<
        TodoOutboxEntry,
        "id" | "status" | "nextAttemptAt"
    >[] = [];

    for (const entry of entries) {
        if (entry.status === "dropped") {
            continue;
        }
        if (entry.status === "failed") {
            failedIds.add(entry.id);
        } else if (entry.status === "inflight") {
            inflightIds.add(entry.id);
            activeIds.add(entry.id);
        } else if (entry.status === "pending") {
            pendingIds.add(entry.id);
            activeIds.add(entry.id);
            pendingEntries.push(entry);
        }
    }

    let kind: TodoSyncStatusKind;
    let tone: TodoSyncStatusTone;
    let text: string;
    let action: TodoSyncStatusAction = null;
    let count: number | undefined;
    let retryInSeconds: number | undefined;

    if (failedIds.size > 0) {
        kind = "failed";
        tone = "failed";
        count = failedIds.size;
        text = `同步失敗 · ${count} 項（點擊重試）`;
        action = "retry";
    } else if (input.authExpired) {
        kind = "auth-expired";
        tone = "failed";
        text = "登入已過期，登入後會繼續同步";
        action = "sign-in";
    } else if (!isOnline && activeIds.size > 0) {
        kind = "offline-pending";
        tone = "offline";
        count = activeIds.size;
        text = `離線，${count} 項變更會在連線後同步`;
    } else if (!isOnline) {
        kind = "offline-idle";
        tone = "offline";
        const latestTimestamp =
            hasSaved && hasRefreshed
                ? Math.max(input.lastSavedAt!, input.lastRefreshedAt!)
                : hasSaved
                  ? input.lastSavedAt!
                  : hasRefreshed
                    ? input.lastRefreshedAt!
                    : null;
        text =
            latestTimestamp !== null
                ? `離線 · 顯示 ${formatTodoSyncTime(latestTimestamp, now)} 的資料`
                : "離線";
    } else if (input.isFlushing || inflightIds.size > 0) {
        kind = "inflight";
        tone = "syncing";
        text = "儲存中…";
    } else if (pendingIds.size > 0) {
        kind = "pending";
        tone = "pending";
        count = pendingIds.size;
        action = "sync-now";

        let allBackingOff = pendingEntries.length > 0;
        let earliestNextAttemptAt: number | undefined;
        for (const entry of pendingEntries) {
            if (
                typeof entry.nextAttemptAt === "number" &&
                Number.isFinite(entry.nextAttemptAt) &&
                entry.nextAttemptAt > now
            ) {
                if (
                    earliestNextAttemptAt === undefined ||
                    entry.nextAttemptAt < earliestNextAttemptAt
                ) {
                    earliestNextAttemptAt = entry.nextAttemptAt;
                }
            } else {
                allBackingOff = false;
                break;
            }
        }

        if (allBackingOff && earliestNextAttemptAt !== undefined) {
            retryInSeconds = Math.max(
                1,
                Math.ceil((earliestNextAttemptAt - now) / 1000),
            );
            text = `${count} 項尚未同步（${retryInSeconds} 秒後重試）`;
        } else {
            text = `${count} 項尚未同步`;
        }
    } else if (input.isRefreshing) {
        kind = "refreshing";
        tone = "syncing";
        text = "更新中…";
    } else if (
        hasSaved &&
        (!hasRefreshed || input.lastSavedAt! > input.lastRefreshedAt!)
    ) {
        kind = "saved";
        tone = "ok";
        text = `已儲存 · ${formatTodoSyncTime(input.lastSavedAt!, now)}`;
    } else if (hasRefreshed) {
        kind = "refreshed";
        tone = "ok";
        text = `已更新 · ${formatTodoSyncTime(input.lastRefreshedAt!, now)}`;
    } else {
        kind = "idle";
        tone = "ok";
        text = "";
    }

    const result: TodoSyncStatusResult = {
        kind,
        tone,
        text,
        action,
    };
    if (input.idbUnavailable) {
        result.warning = TODO_IDB_UNAVAILABLE_WARNING;
    }
    if (count !== undefined) {
        result.count = count;
    }
    if (retryInSeconds !== undefined) {
        result.retryInSeconds = retryInSeconds;
    }
    return result;
}

function isInProgressSyncKind(kind: TodoSyncStatusKind): boolean {
    return kind === "pending" || kind === "inflight" || kind === "refreshing";
}

/**
 * Initializes the live-region announcement state tracker.
 * Pass `initiallyIdle: true` on a cold load (no cached data yet) so the first
 * load completing into `refreshed` is treated as a transition from `idle`.
 */
export function createInitialSyncAnnouncementState(options?: {
    initiallyIdle?: boolean;
    isOnline?: boolean;
}): TodoSyncAnnouncementState {
    const isOnline = options?.isOnline ?? true;
    return {
        previous: options?.initiallyIdle ? { kind: "idle", isOnline } : null,
        politeText: "",
        alertText: "",
        lastDroppedNotice: null,
    };
}

/**
 * Pure transition reducer for the permanently mounted polite (`role="status"`)
 * and assertive (`role="alert"`) live regions. Clears `politeText` when entering
 * unannounced in-progress states (`pending`, `inflight`, `refreshing`) so
 * repeated `已儲存` / `已更新` announcements in the same minute update the DOM,
 * and announces failures once via `alertText` (clearing `alertText` once recovered).
 */
export function advanceSyncAnnouncementState(
    state: TodoSyncAnnouncementState,
    input: AdvanceSyncAnnouncementInput,
): TodoSyncAnnouncementState {
    const {
        status,
        isOnline,
        readOnly = false,
        lastSavedAt,
        lastRefreshedAt,
        droppedNotice = null,
    } = input;

    const nextPrevious: TodoSyncStatusPrevious = {
        kind: status.kind,
        isOnline,
        text: status.text,
        lastSavedAt,
        lastRefreshedAt,
    };

    const isAlertKind =
        !readOnly &&
        (status.kind === "failed" || status.kind === "auth-expired");

    if (state.previous === null) {
        const nextAlertText = isAlertKind && status.text ? status.text : "";
        const nextPoliteText = !readOnly && droppedNotice ? droppedNotice : "";
        return {
            previous: nextPrevious,
            politeText: nextPoliteText,
            alertText: nextAlertText,
            lastDroppedNotice: droppedNotice,
        };
    }

    const announce = getSyncStatusAnnouncement({
        kind: status.kind,
        text: status.text,
        isOnline,
        readOnly,
        lastSavedAt,
        lastRefreshedAt,
        previous: state.previous,
    });

    const enteringInProgress =
        isInProgressSyncKind(status.kind) &&
        !isInProgressSyncKind(state.previous.kind);

    let nextPoliteText = enteringInProgress ? "" : state.politeText;
    let nextAlertText = isAlertKind ? state.alertText : "";

    if (announce) {
        if (announce.role === "alert") {
            nextAlertText = announce.text;
        } else {
            nextPoliteText = announce.text;
        }
    }

    if (
        !readOnly &&
        droppedNotice &&
        droppedNotice !== state.lastDroppedNotice
    ) {
        nextPoliteText =
            announce && announce.role === "status" && announce.text
                ? `${announce.text}，${droppedNotice}`
                : droppedNotice;
    }

    if (
        state.previous.kind === nextPrevious.kind &&
        state.previous.isOnline === nextPrevious.isOnline &&
        state.previous.text === nextPrevious.text &&
        state.previous.lastSavedAt === nextPrevious.lastSavedAt &&
        state.previous.lastRefreshedAt === nextPrevious.lastRefreshedAt &&
        state.politeText === nextPoliteText &&
        state.alertText === nextAlertText &&
        state.lastDroppedNotice === droppedNotice
    ) {
        return state;
    }

    return {
        previous: nextPrevious,
        politeText: nextPoliteText,
        alertText: nextAlertText,
        lastDroppedNotice: droppedNotice,
    };
}
