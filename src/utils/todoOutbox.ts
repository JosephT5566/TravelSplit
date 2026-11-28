import type { TodoItem } from "../types.ts";
import { normalizeTodoCategory, normalizeTodoText } from "./todoList.ts";

export const TODO_OUTBOX_KEY_SEPARATOR = "::";
export const TODO_OUTBOX_META_PREFIX = "__meta__::";
export const CLIENT_TODO_ID_REGEX =
    /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const TODO_SYNC_MAX_OPS = 100;
export const TODO_KEEPALIVE_MAX_BYTES = 64 * 1024;
export const TODO_OUTBOX_DEBOUNCE_MS = 1_500;
export const TODO_OUTBOX_MAX_WAIT_MS = 10_000;
export const TODO_OUTBOX_BACKOFF_MS = [5_000, 15_000, 45_000, 120_000] as const;
export const TODO_OUTBOX_BACKOFF_CAP_MS = 120_000;
export const TODO_OUTBOX_BACKOFF_JITTER_RATIO = 0.2;
export const TODO_OUTBOX_MAX_TRANSIENT_ATTEMPTS = 4;

const CLIENT_ID_TIMESTAMP_PREFIX_REGEX = /^(\d{13})-/;
const SYNC_ENVELOPE_OVERHEAD_BYTES = 10; // '{"ops":[]}'

export type TodoOutboxKind = "create" | "patch" | "delete";

export type TodoOutboxStatus = "pending" | "inflight" | "failed" | "dropped";

export type TodoOutboxFields = {
    text: string;
    checked: boolean;
    category: string;
};

export type TodoOutboxPatch = Partial<TodoOutboxFields>;

export type TodoOutboxEntry = {
    id: string;
    kind: TodoOutboxKind;
    base: TodoOutboxFields | null;
    patch: TodoOutboxPatch;
    rev: number;
    attempts: number;
    status: TodoOutboxStatus;
    lastError: string | null;
    opId?: string;
    nextAttemptAt?: number;
    createdAt?: string;
};

export type TodoOutboxKeyParts = {
    sheetId: string;
    ownerEmail: string;
    todoId: string;
};

export type UuidDeps = {
    randomUUID?: (() => string) | null;
    getRandomValues?: (<T extends Uint8Array>(array: T) => T) | null;
};

export type ClientTodoIdDeps = UuidDeps & {
    now?: () => number;
};

export type TodoLocalChange =
    | {
          type: "create";
          id: string;
          text: string;
          checked?: boolean;
          category?: string;
          createdAt?: string;
      }
    | {
          type: "patch";
          id: string;
          patch: {
              text?: string;
              checked?: boolean;
              category?: string;
          };
      }
    | {
          type: "delete";
          id: string;
      };

export type TodoSyncCreateOp = {
    opId: string;
    type: "create";
    id: string;
    text: string;
    checked: boolean;
    category: string;
};

export type TodoSyncUpdateOp = {
    opId: string;
    type: "update";
    id: string;
    text?: string;
    checked?: boolean;
    category?: string;
};

export type TodoSyncDeleteOp = {
    opId: string;
    type: "delete";
    id: string;
};

export type TodoSyncOp =
    | TodoSyncCreateOp
    | TodoSyncUpdateOp
    | TodoSyncDeleteOp;

export type TodoSyncSentEntry = {
    id: string;
    rev: number;
    opId: string;
    kind: TodoOutboxKind;
};

export type TodoSyncBatch = {
    ops: TodoSyncOp[];
    sent: TodoSyncSentEntry[];
    body: string;
    byteLength: number;
};

export type BuildSyncBatchesOptions = {
    maxOps?: number;
    maxBytes?: number;
    maxBatches?: number;
    now?: number;
    ignoreBackoff?: boolean;
    generateOpId?: () => string;
};

export type BuildSyncBatchesResult = {
    batches: TodoSyncBatch[];
    entriesWithOpIds: TodoOutboxEntry[];
    remainingEntries: TodoOutboxEntry[];
};

export type BuildKeepaliveSyncBatchOptions = {
    maxOps?: number;
    maxBytes?: number;
    now?: number;
    ignoreBackoff?: boolean;
    generateOpId?: () => string;
};

export type BuildKeepaliveSyncBatchResult = {
    batch: TodoSyncBatch | null;
    entriesWithOpIds: TodoOutboxEntry[];
    remainingEntries: TodoOutboxEntry[];
};

export type TodoSyncOpResultStatus =
    | "applied"
    | "not_found"
    | "forbidden"
    | "invalid";

export type TodoSyncOpResult = {
    opId: string | null;
    id?: string;
    status: TodoSyncOpResultStatus;
    item?: TodoItem;
    duplicate?: boolean;
    deleted?: boolean;
    alreadyGone?: boolean;
    message?: string;
};

export type TodoSyncResponse = {
    results: TodoSyncOpResult[];
    syncedAt: string;
};

export type TodoSyncFailureKind = "transient" | "auth" | "permanent";

export type ReconcileSyncOptions = {
    now?: number;
    random?: () => number;
    maxTransientAttempts?: number;
};

export type ReconcileSyncResponseResult = {
    baseItems: TodoItem[];
    entries: TodoOutboxEntry[];
    appliedIds: string[];
    droppedIds: string[];
    failedIds: string[];
    transientIds: string[];
    syncedAt: string;
};

export type ReconcileSyncFailureResult = {
    entries: TodoOutboxEntry[];
    failureKind: TodoSyncFailureKind;
    authExpired: boolean;
    failedIds: string[];
    transientIds: string[];
    nextAttemptAt?: number;
};

export type TodoOverlayItemStatus = "pending" | "inflight" | "failed";

export type OverlayTodosOptions = {
    ownerEmail?: string;
};

export type OverlayTodosResult = {
    items: TodoItem[];
    statusById: Record<string, TodoOverlayItemStatus>;
    droppedEntryIds: string[];
    droppedCount: number;
    droppedNotice: string | null;
    reconciledEntries: TodoOutboxEntry[];
};

export type NextFlushDelayInput = {
    now: number;
    firstChangeAt: number;
    lastChangeAt: number;
    debounceMs?: number;
    maxWaitMs?: number;
};

type SyncErrorLike = {
    code?: unknown;
    status?: unknown;
    name?: unknown;
    message?: unknown;
};

const HEX_BYTES: readonly string[] = Array.from({ length: 256 }, (_, index) =>
    index.toString(16).padStart(2, "0"),
);

const PERMANENT_ERROR_CODES = new Set([
    "INVALID_PARAMS",
    "BAD_REQUEST",
    "FORBIDDEN",
    "INVALID_SHEET_LAYOUT",
]);

function requireNonEmptyPart(value: string, label: string): string {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) {
        throw new Error(`Todo outbox ${label} must be a non-empty string.`);
    }
    return trimmed;
}

/**
 * Builds the scoped IndexedDB key `<sheetId>::<ownerEmail>::<todoId>`.
 */
export function buildTodoOutboxKey(
    sheetId: string,
    ownerEmail: string,
    todoId: string,
): string {
    return `${requireNonEmptyPart(sheetId, "sheetId")}${TODO_OUTBOX_KEY_SEPARATOR}${requireNonEmptyPart(ownerEmail, "ownerEmail")}${TODO_OUTBOX_KEY_SEPARATOR}${requireNonEmptyPart(todoId, "todoId")}`;
}

/**
 * Builds the scope prefix `<sheetId>::<ownerEmail>::` for scanning/clearing one user's sheet outbox.
 */
export function buildTodoOutboxScopePrefix(
    sheetId: string,
    ownerEmail: string,
): string {
    return `${requireNonEmptyPart(sheetId, "sheetId")}${TODO_OUTBOX_KEY_SEPARATOR}${requireNonEmptyPart(ownerEmail, "ownerEmail")}${TODO_OUTBOX_KEY_SEPARATOR}`;
}

/**
 * Builds the metadata key `__meta__::<sheetId>::<ownerEmail>` (e.g. for `lastSavedAt`).
 */
export function buildTodoOutboxMetaKey(
    sheetId: string,
    ownerEmail: string,
): string {
    return `${TODO_OUTBOX_META_PREFIX}${requireNonEmptyPart(sheetId, "sheetId")}${TODO_OUTBOX_KEY_SEPARATOR}${requireNonEmptyPart(ownerEmail, "ownerEmail")}`;
}

/**
 * Parses a scoped outbox entry key, returning null for meta keys or malformed keys.
 */
export function parseTodoOutboxKey(key: string): TodoOutboxKeyParts | null {
    if (typeof key !== "string" || key.startsWith(TODO_OUTBOX_META_PREFIX)) {
        return null;
    }
    const parts = key.split(TODO_OUTBOX_KEY_SEPARATOR);
    if (parts.length !== 3) {
        return null;
    }
    const [sheetId, ownerEmail, todoId] = parts;
    if (!sheetId || !ownerEmail || !todoId) {
        return null;
    }
    return { sheetId, ownerEmail, todoId };
}

function formatUuidBytes(bytes: Uint8Array): string {
    return (
        HEX_BYTES[bytes[0]] +
        HEX_BYTES[bytes[1]] +
        HEX_BYTES[bytes[2]] +
        HEX_BYTES[bytes[3]] +
        "-" +
        HEX_BYTES[bytes[4]] +
        HEX_BYTES[bytes[5]] +
        "-" +
        HEX_BYTES[bytes[6]] +
        HEX_BYTES[bytes[7]] +
        "-" +
        HEX_BYTES[bytes[8]] +
        HEX_BYTES[bytes[9]] +
        "-" +
        HEX_BYTES[bytes[10]] +
        HEX_BYTES[bytes[11]] +
        HEX_BYTES[bytes[12]] +
        HEX_BYTES[bytes[13]] +
        HEX_BYTES[bytes[14]] +
        HEX_BYTES[bytes[15]]
    );
}

/**
 * Generates a lowercase RFC 4122 UUID v4 using `randomUUID` when available,
 * falling back to `getRandomValues`.
 */
export function generateUuidV4(deps?: UuidDeps): string {
    if (typeof deps?.randomUUID === "function") {
        return deps.randomUUID().toLowerCase();
    }
    if (
        deps?.randomUUID === undefined &&
        deps?.getRandomValues === undefined &&
        typeof globalThis.crypto?.randomUUID === "function"
    ) {
        return globalThis.crypto.randomUUID().toLowerCase();
    }

    const getRandomValues =
        typeof deps?.getRandomValues === "function"
            ? deps.getRandomValues
            : deps?.getRandomValues === undefined &&
                typeof globalThis.crypto?.getRandomValues === "function"
              ? <T extends Uint8Array>(array: T) =>
                    globalThis.crypto.getRandomValues(array)
              : null;

    if (!getRandomValues) {
        throw new Error(
            "No randomUUID or getRandomValues source available for UUID generation.",
        );
    }

    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuidBytes(bytes);
}

/**
 * Generates a client-side todo ID `<13-digit-ms>-<uuid>` matching the backend contract.
 */
export function generateClientTodoId(deps?: ClientTodoIdDeps): string {
    const timestamp = (deps?.now ?? Date.now)();
    if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new RangeError("Timestamp for client todo ID must be non-negative.");
    }
    const ms = Math.floor(timestamp);
    const prefix = String(ms).padStart(13, "0");
    if (prefix.length !== 13) {
        throw new RangeError("Timestamp for client todo ID must be 13 digits.");
    }
    const uuid = generateUuidV4(deps);
    const id = `${prefix}-${uuid}`;
    if (!CLIENT_TODO_ID_REGEX.test(id)) {
        throw new Error(`Generated client todo ID does not match backend format: ${id}`);
    }
    return id;
}

export function isValidClientTodoId(id: string): boolean {
    return CLIENT_TODO_ID_REGEX.test(id);
}

/**
 * Extracts normalized comparable fields `{ text, checked, category }` from a TodoItem.
 */
export function toOutboxFields(
    item: Pick<TodoItem, "text" | "checked" | "category">,
): TodoOutboxFields {
    return {
        text: item.text,
        checked: Boolean(item.checked),
        category: normalizeTodoCategory(item.category),
    };
}

function isPatchEmpty(patch: TodoOutboxPatch): boolean {
    return (
        patch.text === undefined &&
        patch.checked === undefined &&
        patch.category === undefined
    );
}

function diffFields(
    base: TodoOutboxFields,
    desired: TodoOutboxFields,
): TodoOutboxPatch {
    const patch: TodoOutboxPatch = {};
    if (desired.text !== base.text) {
        patch.text = desired.text;
    }
    if (desired.checked !== base.checked) {
        patch.checked = desired.checked;
    }
    if (desired.category !== base.category) {
        patch.category = desired.category;
    }
    return patch;
}

function applyPatchFields(
    base: TodoOutboxFields,
    patch: TodoOutboxPatch,
): TodoOutboxFields {
    return {
        text: patch.text !== undefined ? patch.text : base.text,
        checked: patch.checked !== undefined ? patch.checked : base.checked,
        category:
            patch.category !== undefined
                ? normalizeTodoCategory(patch.category)
                : base.category,
    };
}

function makeCleanEntry(entry: TodoOutboxEntry): TodoOutboxEntry {
    const clean: TodoOutboxEntry = {
        id: entry.id,
        kind: entry.kind,
        base: entry.base ? { ...entry.base } : null,
        patch: { ...entry.patch },
        rev: entry.rev,
        attempts: entry.attempts,
        status: entry.status,
        lastError: entry.lastError,
    };
    if (entry.opId !== undefined) {
        clean.opId = entry.opId;
    }
    if (entry.nextAttemptAt !== undefined) {
        clean.nextAttemptAt = entry.nextAttemptAt;
    }
    if (entry.createdAt !== undefined) {
        clean.createdAt = entry.createdAt;
    }
    return clean;
}

/**
 * Pure outbox merge reducer implementing spec §1 rules:
 * - patch field returning to base drops that field; empty patch removes the entry
 *   (unless currently inflight, where an empty patch stays with bumped rev until settled)
 * - create + patch folds into create
 * - create + delete removes the entry (unless create is inflight -> becomes delete)
 * - patch + delete => delete
 * - rev increments on every effective change; opId is cleared whenever rev changes
 */
export function applyLocalChange(
    entry: TodoOutboxEntry | undefined,
    change: TodoLocalChange,
    baseItem?: TodoItem | null,
): TodoOutboxEntry | null {
    if (change.type === "create") {
        const text = normalizeTodoText(change.text);
        const checked = Boolean(change.checked ?? false);
        const category = normalizeTodoCategory(change.category);
        const created: TodoOutboxEntry = {
            id: change.id,
            kind: "create",
            base: null,
            patch: { text, checked, category },
            rev: entry ? entry.rev + 1 : 1,
            attempts: 0,
            status: entry?.status === "inflight" ? "inflight" : "pending",
            lastError: null,
        };
        if (change.createdAt !== undefined) {
            created.createdAt = change.createdAt;
        }
        return created;
    }

    if (change.type === "delete") {
        if (entry?.status === "dropped") {
            return null;
        }
        if (entry?.kind === "delete") {
            return entry;
        }
        if (entry?.kind === "create") {
            if (entry.status === "inflight") {
                return {
                    id: entry.id,
                    kind: "delete",
                    base: null,
                    patch: {},
                    rev: entry.rev + 1,
                    attempts: entry.attempts,
                    status: "inflight",
                    lastError: entry.lastError,
                };
            }
            return null;
        }

        const isInflight = entry?.status === "inflight";
        const base = entry?.base
            ? { ...entry.base }
            : baseItem
              ? toOutboxFields(baseItem)
              : null;

        return {
            id: entry?.id ?? change.id,
            kind: "delete",
            base,
            patch: {},
            rev: entry ? entry.rev + 1 : 1,
            attempts: isInflight ? entry.attempts : 0,
            status: isInflight ? "inflight" : "pending",
            lastError: isInflight ? entry.lastError : null,
        };
    }

    // change.type === "patch"
    if (entry?.status === "dropped") {
        return null;
    }
    if (entry?.kind === "delete") {
        return entry;
    }

    if (entry?.kind === "create") {
        const prevText = entry.patch.text ?? "";
        const prevChecked = Boolean(entry.patch.checked ?? false);
        const prevCategory = normalizeTodoCategory(entry.patch.category);

        const nextText =
            change.patch.text !== undefined
                ? normalizeTodoText(change.patch.text)
                : prevText;
        const nextChecked =
            change.patch.checked !== undefined
                ? Boolean(change.patch.checked)
                : prevChecked;
        const nextCategory =
            change.patch.category !== undefined
                ? normalizeTodoCategory(change.patch.category)
                : prevCategory;

        if (
            nextText === prevText &&
            nextChecked === prevChecked &&
            nextCategory === prevCategory
        ) {
            return entry;
        }

        const isInflight = entry.status === "inflight";
        const nextEntry: TodoOutboxEntry = {
            id: entry.id,
            kind: "create",
            base: null,
            patch: {
                text: nextText,
                checked: nextChecked,
                category: nextCategory,
            },
            rev: entry.rev + 1,
            attempts: isInflight ? entry.attempts : 0,
            status: isInflight ? "inflight" : "pending",
            lastError: isInflight ? entry.lastError : null,
        };
        if (entry.createdAt !== undefined) {
            nextEntry.createdAt = entry.createdAt;
        }
        return nextEntry;
    }

    const base = entry?.base
        ? { ...entry.base }
        : baseItem
          ? toOutboxFields(baseItem)
          : null;
    if (!base) {
        return entry ?? null;
    }

    const current = entry ? applyPatchFields(base, entry.patch) : base;
    const desired: TodoOutboxFields = {
        text:
            change.patch.text !== undefined
                ? normalizeTodoText(change.patch.text)
                : current.text,
        checked:
            change.patch.checked !== undefined
                ? Boolean(change.patch.checked)
                : current.checked,
        category:
            change.patch.category !== undefined
                ? normalizeTodoCategory(change.patch.category)
                : current.category,
    };

    if (
        desired.text === current.text &&
        desired.checked === current.checked &&
        desired.category === current.category
    ) {
        return entry ?? null;
    }

    const nextPatch = diffFields(base, desired);
    const isInflight = entry?.status === "inflight";

    if (isPatchEmpty(nextPatch) && !isInflight) {
        return null;
    }

    return {
        id: entry?.id ?? change.id,
        kind: "patch",
        base,
        patch: nextPatch,
        rev: entry ? entry.rev + 1 : 1,
        attempts: isInflight ? entry.attempts : 0,
        status: isInflight ? "inflight" : "pending",
        lastError: isInflight ? entry.lastError : null,
    };
}

/**
 * Resets failed or backing-off pending entries for immediate retry while keeping
 * their existing `opId` intact for idempotent resends.
 */
export function resetEntriesForRetry(
    entries: readonly TodoOutboxEntry[],
    targetIds?: ReadonlySet<string> | readonly string[],
): TodoOutboxEntry[] {
    const idSet =
        targetIds === undefined
            ? null
            : targetIds instanceof Set
              ? targetIds
              : new Set(targetIds);

    return entries.map((entry) => {
        if (entry.status !== "failed" && entry.status !== "pending") {
            return entry;
        }
        if (idSet !== null && !idSet.has(entry.id)) {
            return entry;
        }
        const next: TodoOutboxEntry = {
            id: entry.id,
            kind: entry.kind,
            base: entry.base ? { ...entry.base } : null,
            patch: { ...entry.patch },
            rev: entry.rev,
            attempts: 0,
            status: "pending",
            lastError: null,
        };
        if (entry.opId !== undefined) {
            next.opId = entry.opId;
        }
        if (entry.createdAt !== undefined) {
            next.createdAt = entry.createdAt;
        }
        return next;
    });
}

/**
 * Discards a single outbox entry (e.g. "捨棄變更" on permanent failure).
 */
export function discardOutboxEntry(
    entries: readonly TodoOutboxEntry[],
    id: string,
): TodoOutboxEntry[] {
    return entries.filter((entry) => entry.id !== id);
}

/**
 * Removes dropped entries after the one-time deletion notice has been shown.
 */
export function dismissDroppedEntries(
    entries: readonly TodoOutboxEntry[],
): TodoOutboxEntry[] {
    return entries.filter((entry) => entry.status !== "dropped");
}

/**
 * Computes exact UTF-8 byte length of a string without allocating typed arrays.
 */
export function getUtf8ByteLength(value: string): number {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code <= 0x7f) {
            bytes += 1;
        } else if (code <= 0x7ff) {
            bytes += 2;
        } else if (
            code >= 0xd800 &&
            code <= 0xdbff &&
            index + 1 < value.length
        ) {
            const next = value.charCodeAt(index + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                bytes += 4;
                index += 1;
            } else {
                bytes += 3;
            }
        } else {
            bytes += 3;
        }
    }
    return bytes;
}

function isSendableEntry(
    entry: TodoOutboxEntry,
    now: number | undefined,
    ignoreBackoff: boolean,
): boolean {
    if (entry.status !== "pending") {
        return false;
    }
    if (entry.kind === "patch" && isPatchEmpty(entry.patch)) {
        return false;
    }
    if (
        !ignoreBackoff &&
        now !== undefined &&
        entry.nextAttemptAt !== undefined &&
        entry.nextAttemptAt > now
    ) {
        return false;
    }
    return true;
}

function buildOpFromEntry(
    entry: TodoOutboxEntry,
    opId: string,
): TodoSyncOp | null {
    if (entry.kind === "create") {
        return {
            opId,
            type: "create",
            id: entry.id,
            text: entry.patch.text ?? "",
            checked: Boolean(entry.patch.checked ?? false),
            category: normalizeTodoCategory(entry.patch.category),
        };
    }

    if (entry.kind === "delete") {
        return {
            opId,
            type: "delete",
            id: entry.id,
        };
    }

    const op: TodoSyncUpdateOp = {
        opId,
        type: "update",
        id: entry.id,
    };
    let hasField = false;
    if (entry.patch.text !== undefined) {
        op.text = entry.patch.text;
        hasField = true;
    }
    if (entry.patch.checked !== undefined) {
        op.checked = entry.patch.checked;
        hasField = true;
    }
    if (entry.patch.category !== undefined) {
        op.category = normalizeTodoCategory(entry.patch.category);
        hasField = true;
    }
    return hasField ? op : null;
}

/**
 * Builds chunked `POST /todos/sync` batches from pending outbox entries:
 * - reuses existing `entry.opId` for retries at the same `rev`, minting one when absent
 * - chunks to at most `maxOps` (default 100) ops per request
 * - optionally enforces a UTF-8 JSON body byte cap (`maxBytes`) and batch count cap (`maxBatches`)
 */
export function buildSyncBatches(
    entries: readonly TodoOutboxEntry[],
    options: BuildSyncBatchesOptions = {},
): BuildSyncBatchesResult {
    const maxOps = options.maxOps ?? TODO_SYNC_MAX_OPS;
    if (!Number.isInteger(maxOps) || maxOps <= 0) {
        throw new RangeError("maxOps must be a positive integer.");
    }
    const maxBytes = options.maxBytes;
    if (maxBytes !== undefined && (!Number.isFinite(maxBytes) || maxBytes <= 0)) {
        throw new RangeError("maxBytes must be a positive number.");
    }
    const maxBatches = options.maxBatches;
    if (
        maxBatches !== undefined &&
        (!Number.isInteger(maxBatches) || maxBatches <= 0)
    ) {
        throw new RangeError("maxBatches must be a positive integer.");
    }

    const ignoreBackoff = options.ignoreBackoff ?? false;
    const generateOpId = options.generateOpId ?? (() => generateUuidV4());

    const batches: TodoSyncBatch[] = [];
    const remainingEntries: TodoOutboxEntry[] = [];
    const assignedOpIds = new Map<string, string>();

    let currentOps: TodoSyncOp[] = [];
    let currentSent: TodoSyncSentEntry[] = [];
    let currentBytes = SYNC_ENVELOPE_OVERHEAD_BYTES;
    let stopped = false;

    const finalizeCurrentBatch = () => {
        if (currentOps.length === 0) {
            return;
        }
        const body = JSON.stringify({ ops: currentOps });
        batches.push({
            ops: currentOps,
            sent: currentSent,
            body,
            byteLength: getUtf8ByteLength(body),
        });
        currentOps = [];
        currentSent = [];
        currentBytes = SYNC_ENVELOPE_OVERHEAD_BYTES;
    };

    for (const entry of entries) {
        if (!isSendableEntry(entry, options.now, ignoreBackoff)) {
            continue;
        }
        if (stopped) {
            remainingEntries.push(entry);
            continue;
        }

        const existingOpId =
            typeof entry.opId === "string" && entry.opId.trim().length > 0
                ? entry.opId
                : null;
        const opId = existingOpId ?? generateOpId();
        const op = buildOpFromEntry(entry, opId);
        if (!op) {
            continue;
        }

        const opBytes = getUtf8ByteLength(JSON.stringify(op));
        if (
            maxBytes !== undefined &&
            SYNC_ENVELOPE_OVERHEAD_BYTES + opBytes > maxBytes
        ) {
            // Single op exceeds byte cap; stop so later ops stay in order for regular flush.
            finalizeCurrentBatch();
            stopped = true;
            remainingEntries.push(entry);
            continue;
        }

        const nextBytes =
            currentOps.length === 0
                ? SYNC_ENVELOPE_OVERHEAD_BYTES + opBytes
                : currentBytes + 1 + opBytes;
        const exceedsOps = currentOps.length >= maxOps;
        const exceedsBytes = maxBytes !== undefined && nextBytes > maxBytes;

        if (exceedsOps || exceedsBytes) {
            finalizeCurrentBatch();
            if (maxBatches !== undefined && batches.length >= maxBatches) {
                stopped = true;
                remainingEntries.push(entry);
                continue;
            }
            currentBytes = SYNC_ENVELOPE_OVERHEAD_BYTES + opBytes;
        } else {
            currentBytes = nextBytes;
        }

        currentOps.push(op);
        currentSent.push({
            id: entry.id,
            rev: entry.rev,
            opId,
            kind: entry.kind,
        });
        assignedOpIds.set(entry.id, opId);
    }

    finalizeCurrentBatch();

    const entriesWithOpIds = entries.map((entry) => {
        const assignedOpId = assignedOpIds.get(entry.id);
        if (assignedOpId === undefined || assignedOpId === entry.opId) {
            return entry;
        }
        return makeCleanEntry({ ...entry, opId: assignedOpId });
    });

    return {
        batches,
        entriesWithOpIds,
        remainingEntries,
    };
}

/**
 * Builds a single keepalive-safe `POST /todos/sync` batch capped at <=100 ops and <=64KB UTF-8.
 * Entries that do not fit are returned in `remainingEntries` for a later flush.
 */
export function buildKeepaliveSyncBatch(
    entries: readonly TodoOutboxEntry[],
    options: BuildKeepaliveSyncBatchOptions = {},
): BuildKeepaliveSyncBatchResult {
    const result = buildSyncBatches(entries, {
        maxOps: options.maxOps ?? TODO_SYNC_MAX_OPS,
        maxBytes: options.maxBytes ?? TODO_KEEPALIVE_MAX_BYTES,
        maxBatches: 1,
        now: options.now,
        ignoreBackoff: options.ignoreBackoff,
        generateOpId: options.generateOpId,
    });
    return {
        batch: result.batches[0] ?? null,
        entriesWithOpIds: result.entriesWithOpIds,
        remainingEntries: result.remainingEntries,
    };
}

/**
 * Pure debounce + maxWait flush scheduling math.
 */
export function nextFlushDelay({
    now,
    firstChangeAt,
    lastChangeAt,
    debounceMs = TODO_OUTBOX_DEBOUNCE_MS,
    maxWaitMs = TODO_OUTBOX_MAX_WAIT_MS,
}: NextFlushDelayInput): number {
    const debounceDeadline = lastChangeAt + debounceMs;
    const maxWaitDeadline = firstChangeAt + maxWaitMs;
    const deadline = Math.min(debounceDeadline, maxWaitDeadline);
    return Math.max(0, deadline - now);
}

/**
 * Computes exponential backoff delay (5s -> 15s -> 45s -> 120s cap) with ±20% jitter.
 */
export function backoffDelay(
    attempt: number,
    random: () => number = Math.random,
): number {
    const safeAttempt = Number.isFinite(attempt)
        ? Math.max(1, Math.floor(attempt))
        : 1;
    const stepIndex = Math.min(
        safeAttempt - 1,
        TODO_OUTBOX_BACKOFF_MS.length - 1,
    );
    const baseMs = Math.min(
        TODO_OUTBOX_BACKOFF_MS[stepIndex],
        TODO_OUTBOX_BACKOFF_CAP_MS,
    );
    const rawRandom = random();
    const clampedRandom = Number.isFinite(rawRandom)
        ? Math.min(1, Math.max(0, rawRandom))
        : 0.5;
    const jitterMultiplier =
        1 + (clampedRandom * 2 - 1) * TODO_OUTBOX_BACKOFF_JITTER_RATIO;
    return Math.round(baseMs * jitterMultiplier);
}

/**
 * Classifies a whole-request error from `POST /todos/sync` into auth (401),
 * transient (network/timeout/5xx/429), or permanent (400/403/422).
 */
export function classifySyncRequestError(error: unknown): TodoSyncFailureKind {
    if (!error || typeof error !== "object") {
        return "transient";
    }

    const candidate = error as SyncErrorLike;
    const code =
        typeof candidate.code === "string" ? candidate.code.trim() : "";
    const status =
        typeof candidate.status === "number" ? candidate.status : undefined;
    const name =
        typeof candidate.name === "string" ? candidate.name.trim() : "";

    if (status === 401 || code === "UNAUTHORIZED" || code === "TOKEN_EXPIRED") {
        return "auth";
    }

    if (
        code === "OFFLINE" ||
        code === "INVALID_RESPONSE" ||
        code === "TIMEOUT" ||
        name === "AbortError" ||
        name === "TimeoutError" ||
        status === 408 ||
        status === 429 ||
        (status !== undefined && status >= 500)
    ) {
        return "transient";
    }

    if (PERMANENT_ERROR_CODES.has(code)) {
        return "permanent";
    }

    if (status !== undefined && status >= 400 && status < 500) {
        return "permanent";
    }

    return "transient";
}

function getPermanentFailureMessage(error: unknown): string {
    if (error && typeof error === "object") {
        const candidate = error as SyncErrorLike;
        const code =
            typeof candidate.code === "string" ? candidate.code.trim() : "";
        const status =
            typeof candidate.status === "number" ? candidate.status : undefined;
        const message =
            typeof candidate.message === "string"
                ? candidate.message.trim()
                : "";

        if (code === "FORBIDDEN" || status === 403) {
            return "沒有權限修改這個待辦";
        }
        if (code === "INVALID_SHEET_LAYOUT" || status === 422) {
            return "試算表格式有問題，請聯絡旅程管理員";
        }
        if (message) {
            return message;
        }
    }
    return "同步請求失敗，請重試";
}

function getPerOpPermanentMessage(result: TodoSyncOpResult): string {
    const trimmed =
        typeof result.message === "string" ? result.message.trim() : "";
    if (trimmed) {
        return trimmed;
    }
    if (result.status === "forbidden") {
        return "沒有權限修改這個待辦";
    }
    return "待辦內容格式無效";
}

function applyTransientFailureToEntry(
    current: TodoOutboxEntry,
    sent: TodoSyncSentEntry,
    now: number,
    maxTransientAttempts: number,
    getDelayForAttempt: (attempt: number) => number,
): { nextEntry: TodoOutboxEntry | null; failed: boolean; nextAttemptAt?: number } {
    if (current.kind === "patch" && isPatchEmpty(current.patch)) {
        return { nextEntry: null, failed: false };
    }

    const nextAttempts = current.attempts + 1;
    const preservedOpId =
        current.rev === sent.rev ? (current.opId ?? sent.opId) : current.opId;

    if (nextAttempts >= maxTransientAttempts) {
        const failedEntry: TodoOutboxEntry = {
            id: current.id,
            kind: current.kind,
            base: current.base ? { ...current.base } : null,
            patch: { ...current.patch },
            rev: current.rev,
            attempts: nextAttempts,
            status: "failed",
            lastError: "同步失敗，請點擊重試",
        };
        if (preservedOpId !== undefined) {
            failedEntry.opId = preservedOpId;
        }
        if (current.createdAt !== undefined) {
            failedEntry.createdAt = current.createdAt;
        }
        return { nextEntry: failedEntry, failed: true };
    }

    const nextAttemptAt = now + getDelayForAttempt(nextAttempts);
    const pendingEntry: TodoOutboxEntry = {
        id: current.id,
        kind: current.kind,
        base: current.base ? { ...current.base } : null,
        patch: { ...current.patch },
        rev: current.rev,
        attempts: nextAttempts,
        status: "pending",
        lastError: null,
        nextAttemptAt,
    };
    if (preservedOpId !== undefined) {
        pendingEntry.opId = preservedOpId;
    }
    if (current.createdAt !== undefined) {
        pendingEntry.createdAt = current.createdAt;
    }
    return { nextEntry: pendingEntry, failed: false, nextAttemptAt };
}

/**
 * Reconciles a HTTP 200 `POST /todos/sync` response against the current outbox
 * and server base list, handling per-op applied/not_found/forbidden/invalid,
 * missing results (transient), and in-flight rev changes.
 */
export function reconcileSyncResponse(
    baseItems: readonly TodoItem[],
    currentEntries: readonly TodoOutboxEntry[],
    sentEntries: readonly TodoSyncSentEntry[],
    response: TodoSyncResponse,
    options: ReconcileSyncOptions = {},
): ReconcileSyncResponseResult {
    const now = options.now ?? Date.now();
    const random = options.random ?? Math.random;
    const maxTransientAttempts =
        options.maxTransientAttempts ?? TODO_OUTBOX_MAX_TRANSIENT_ATTEMPTS;

    const nextBase = [...baseItems];
    const baseIndexById = new Map<string, number>();
    nextBase.forEach((item, index) => {
        baseIndexById.set(item.id, index);
    });

    const upsertBaseItem = (item: TodoItem) => {
        const existingIndex = baseIndexById.get(item.id);
        if (existingIndex !== undefined) {
            nextBase[existingIndex] = item;
        } else {
            baseIndexById.set(item.id, nextBase.length);
            nextBase.push(item);
        }
    };

    const removeBaseItem = (id: string) => {
        const existingIndex = baseIndexById.get(id);
        if (existingIndex === undefined) {
            return;
        }
        nextBase.splice(existingIndex, 1);
        baseIndexById.clear();
        nextBase.forEach((item, index) => {
            baseIndexById.set(item.id, index);
        });
    };

    const resultByOpId = new Map<string, TodoSyncOpResult>();
    for (const result of response.results ?? []) {
        if (
            typeof result.opId === "string" &&
            result.opId.length > 0 &&
            !resultByOpId.has(result.opId)
        ) {
            resultByOpId.set(result.opId, result);
        }
    }

    const entryMap = new Map<string, TodoOutboxEntry>();
    for (const entry of currentEntries) {
        entryMap.set(entry.id, entry);
    }

    const delayByAttempt = new Map<number, number>();
    const getDelayForAttempt = (attempt: number) => {
        const existing = delayByAttempt.get(attempt);
        if (existing !== undefined) {
            return existing;
        }
        const computed = backoffDelay(attempt, random);
        delayByAttempt.set(attempt, computed);
        return computed;
    };

    const appliedIds: string[] = [];
    const droppedIds: string[] = [];
    const failedIds: string[] = [];
    const transientIds: string[] = [];

    for (const sent of sentEntries) {
        const current = entryMap.get(sent.id);
        const result = resultByOpId.get(sent.opId);

        if (!result) {
            if (!current) {
                continue;
            }
            const outcome = applyTransientFailureToEntry(
                current,
                sent,
                now,
                maxTransientAttempts,
                getDelayForAttempt,
            );
            if (outcome.nextEntry === null) {
                entryMap.delete(sent.id);
            } else {
                entryMap.set(sent.id, outcome.nextEntry);
                if (outcome.failed) {
                    failedIds.push(sent.id);
                } else {
                    transientIds.push(sent.id);
                }
            }
            continue;
        }

        if (result.status === "applied") {
            if (sent.kind === "delete" || result.deleted === true) {
                removeBaseItem(sent.id);
                appliedIds.push(sent.id);
                if (!current) {
                    continue;
                }
                if (current.rev === sent.rev || current.kind === "delete") {
                    entryMap.delete(sent.id);
                } else if (current.kind === "create") {
                    entryMap.set(
                        sent.id,
                        makeCleanEntry({
                            ...current,
                            attempts: 0,
                            status: "pending",
                            lastError: null,
                            nextAttemptAt: undefined,
                        }),
                    );
                } else {
                    entryMap.set(
                        sent.id,
                        makeCleanEntry({
                            ...current,
                            status: "dropped",
                            lastError: null,
                            nextAttemptAt: undefined,
                        }),
                    );
                    droppedIds.push(sent.id);
                }
                continue;
            }

            if (!result.item) {
                if (!current) {
                    continue;
                }
                const outcome = applyTransientFailureToEntry(
                    current,
                    sent,
                    now,
                    maxTransientAttempts,
                    getDelayForAttempt,
                );
                if (outcome.nextEntry === null) {
                    entryMap.delete(sent.id);
                } else {
                    entryMap.set(sent.id, outcome.nextEntry);
                    if (outcome.failed) {
                        failedIds.push(sent.id);
                    } else {
                        transientIds.push(sent.id);
                    }
                }
                continue;
            }

            upsertBaseItem(result.item);
            appliedIds.push(sent.id);

            if (!current) {
                continue;
            }

            const newBase = toOutboxFields(result.item);

            if (current.rev === sent.rev) {
                if (
                    sent.kind === "create" &&
                    current.kind === "create" &&
                    result.duplicate === true
                ) {
                    const desired: TodoOutboxFields = {
                        text: current.patch.text ?? newBase.text,
                        checked: Boolean(current.patch.checked ?? newBase.checked),
                        category: normalizeTodoCategory(current.patch.category),
                    };
                    const remainingPatch = diffFields(newBase, desired);
                    if (!isPatchEmpty(remainingPatch)) {
                        entryMap.set(sent.id, {
                            id: current.id,
                            kind: "patch",
                            base: newBase,
                            patch: remainingPatch,
                            rev: current.rev,
                            attempts: 0,
                            status: "pending",
                            lastError: null,
                        });
                        continue;
                    }
                }
                entryMap.delete(sent.id);
                continue;
            }

            // Entry changed while in-flight: rebase onto server item.
            if (current.kind === "delete") {
                entryMap.set(sent.id, {
                    id: current.id,
                    kind: "delete",
                    base: newBase,
                    patch: {},
                    rev: current.rev,
                    attempts: 0,
                    status: "pending",
                    lastError: null,
                });
                continue;
            }

            const desired: TodoOutboxFields =
                current.kind === "create"
                    ? {
                          text: current.patch.text ?? newBase.text,
                          checked: Boolean(
                              current.patch.checked ?? newBase.checked,
                          ),
                          category: normalizeTodoCategory(
                              current.patch.category,
                          ),
                      }
                    : applyPatchFields(current.base ?? newBase, current.patch);

            const rebasedPatch = diffFields(newBase, desired);
            if (isPatchEmpty(rebasedPatch)) {
                entryMap.delete(sent.id);
            } else {
                entryMap.set(sent.id, {
                    id: current.id,
                    kind: "patch",
                    base: newBase,
                    patch: rebasedPatch,
                    rev: current.rev,
                    attempts: 0,
                    status: "pending",
                    lastError: null,
                });
            }
            continue;
        }

        if (result.status === "not_found") {
            removeBaseItem(sent.id);
            if (!current) {
                continue;
            }
            if (
                sent.kind === "delete" ||
                current.kind === "delete" ||
                (current.kind === "patch" && isPatchEmpty(current.patch))
            ) {
                entryMap.delete(sent.id);
                continue;
            }
            entryMap.set(sent.id, {
                id: current.id,
                kind: current.kind,
                base: current.base ? { ...current.base } : null,
                patch: { ...current.patch },
                rev: current.rev,
                attempts: current.attempts,
                status: "dropped",
                lastError: null,
            });
            droppedIds.push(sent.id);
            continue;
        }

        // "forbidden" or "invalid"
        if (!current) {
            continue;
        }
        if (sent.kind === "create" && current.kind === "delete") {
            // Create was rejected and user deleted the item locally; drop cleanly.
            entryMap.delete(sent.id);
            continue;
        }
        if (result.status === "invalid" && current.rev !== sent.rev) {
            // User already edited the entry while invalid payload was in flight.
            const retryEntry: TodoOutboxEntry = {
                id: current.id,
                kind: current.kind,
                base: current.base ? { ...current.base } : null,
                patch: { ...current.patch },
                rev: current.rev,
                attempts: 0,
                status: "pending",
                lastError: null,
            };
            if (current.createdAt !== undefined) {
                retryEntry.createdAt = current.createdAt;
            }
            entryMap.set(sent.id, retryEntry);
            continue;
        }

        const preservedOpId =
            current.rev === sent.rev ? (current.opId ?? sent.opId) : current.opId;
        const failedEntry: TodoOutboxEntry = {
            id: current.id,
            kind: current.kind,
            base: current.base ? { ...current.base } : null,
            patch: { ...current.patch },
            rev: current.rev,
            attempts: current.attempts,
            status: "failed",
            lastError: getPerOpPermanentMessage(result),
        };
        if (preservedOpId !== undefined) {
            failedEntry.opId = preservedOpId;
        }
        if (current.createdAt !== undefined) {
            failedEntry.createdAt = current.createdAt;
        }
        entryMap.set(sent.id, failedEntry);
        failedIds.push(sent.id);
    }

    const entries: TodoOutboxEntry[] = [];
    for (const original of currentEntries) {
        const updated = entryMap.get(original.id);
        if (updated) {
            entries.push(updated);
        }
    }

    return {
        baseItems: nextBase,
        entries,
        appliedIds,
        droppedIds,
        failedIds,
        transientIds,
        syncedAt: response.syncedAt,
    };
}

/**
 * Reconciles a whole-request failure from `POST /todos/sync`:
 * - 401 -> `authExpired: true` (entries return to pending without burning attempts)
 * - transient (network/timeout/5xx/429) -> `attempts + 1` with backoff; >=4 becomes `failed`
 * - permanent (400/403/422) -> `failed` immediately
 */
export function reconcileSyncFailure(
    currentEntries: readonly TodoOutboxEntry[],
    sentEntries: readonly TodoSyncSentEntry[],
    error: unknown,
    options: ReconcileSyncOptions = {},
): ReconcileSyncFailureResult {
    const now = options.now ?? Date.now();
    const random = options.random ?? Math.random;
    const maxTransientAttempts =
        options.maxTransientAttempts ?? TODO_OUTBOX_MAX_TRANSIENT_ATTEMPTS;

    const failureKind = classifySyncRequestError(error);
    const entryMap = new Map<string, TodoOutboxEntry>();
    for (const entry of currentEntries) {
        entryMap.set(entry.id, entry);
    }

    const delayByAttempt = new Map<number, number>();
    const getDelayForAttempt = (attempt: number) => {
        const existing = delayByAttempt.get(attempt);
        if (existing !== undefined) {
            return existing;
        }
        const computed = backoffDelay(attempt, random);
        delayByAttempt.set(attempt, computed);
        return computed;
    };

    const failedIds: string[] = [];
    const transientIds: string[] = [];
    let earliestNextAttemptAt: number | undefined;

    for (const sent of sentEntries) {
        const current = entryMap.get(sent.id);
        if (!current) {
            continue;
        }

        if (failureKind === "auth") {
            if (current.kind === "patch" && isPatchEmpty(current.patch)) {
                entryMap.delete(sent.id);
                continue;
            }
            const preservedOpId =
                current.rev === sent.rev
                    ? (current.opId ?? sent.opId)
                    : current.opId;
            const pendingEntry: TodoOutboxEntry = {
                id: current.id,
                kind: current.kind,
                base: current.base ? { ...current.base } : null,
                patch: { ...current.patch },
                rev: current.rev,
                attempts: current.attempts,
                status: "pending",
                lastError: null,
            };
            if (preservedOpId !== undefined) {
                pendingEntry.opId = preservedOpId;
            }
            if (current.createdAt !== undefined) {
                pendingEntry.createdAt = current.createdAt;
            }
            entryMap.set(sent.id, pendingEntry);
            continue;
        }

        if (failureKind === "permanent") {
            if (current.kind === "patch" && isPatchEmpty(current.patch)) {
                entryMap.delete(sent.id);
                continue;
            }
            const preservedOpId =
                current.rev === sent.rev
                    ? (current.opId ?? sent.opId)
                    : current.opId;
            const failedEntry: TodoOutboxEntry = {
                id: current.id,
                kind: current.kind,
                base: current.base ? { ...current.base } : null,
                patch: { ...current.patch },
                rev: current.rev,
                attempts: current.attempts,
                status: "failed",
                lastError: getPermanentFailureMessage(error),
            };
            if (preservedOpId !== undefined) {
                failedEntry.opId = preservedOpId;
            }
            if (current.createdAt !== undefined) {
                failedEntry.createdAt = current.createdAt;
            }
            entryMap.set(sent.id, failedEntry);
            failedIds.push(sent.id);
            continue;
        }

        // Transient failure
        const outcome = applyTransientFailureToEntry(
            current,
            sent,
            now,
            maxTransientAttempts,
            getDelayForAttempt,
        );
        if (outcome.nextEntry === null) {
            entryMap.delete(sent.id);
        } else {
            entryMap.set(sent.id, outcome.nextEntry);
            if (outcome.failed) {
                failedIds.push(sent.id);
            } else {
                transientIds.push(sent.id);
                if (
                    outcome.nextAttemptAt !== undefined &&
                    (earliestNextAttemptAt === undefined ||
                        outcome.nextAttemptAt < earliestNextAttemptAt)
                ) {
                    earliestNextAttemptAt = outcome.nextAttemptAt;
                }
            }
        }
    }

    const entries: TodoOutboxEntry[] = [];
    for (const original of currentEntries) {
        const updated = entryMap.get(original.id);
        if (updated) {
            entries.push(updated);
        }
    }

    const result: ReconcileSyncFailureResult = {
        entries,
        failureKind,
        authExpired: failureKind === "auth",
        failedIds,
        transientIds,
    };
    if (earliestNextAttemptAt !== undefined) {
        result.nextAttemptAt = earliestNextAttemptAt;
    }
    return result;
}

/**
 * Formats the one-time notice shown when patched items disappeared on another device.
 */
export function formatDroppedTodosNotice(count: number): string {
    return `${count} 項已在其他裝置刪除，已移除你的變更`;
}

function extractCreatedAtFromClientId(id: string): string {
    const match = CLIENT_ID_TIMESTAMP_PREFIX_REGEX.exec(id);
    if (!match) {
        return "";
    }
    const ms = Number(match[1]);
    if (!Number.isFinite(ms)) {
        return "";
    }
    return new Date(ms).toISOString();
}

/**
 * Overlays outbox entries onto server base items without mutating either input:
 * - patches apply on top of matching base items
 * - deletes hide matching base items
 * - creates append in creation order (deduplicated if base already contains the id)
 * - patches whose base item disappeared on refetch become `dropped` with a one-time notice
 */
export function overlayTodos(
    baseItems: readonly TodoItem[],
    entries: readonly TodoOutboxEntry[],
    options: OverlayTodosOptions = {},
): OverlayTodosResult {
    const baseIdSet = new Set(baseItems.map((item) => item.id));
    const entryById = new Map<string, TodoOutboxEntry>();
    for (const entry of entries) {
        entryById.set(entry.id, entry);
    }

    const statusById: Record<string, TodoOverlayItemStatus> = {};
    const visibleBaseItems: TodoItem[] = [];

    for (const baseItem of baseItems) {
        const entry = entryById.get(baseItem.id);
        if (!entry || entry.status === "dropped") {
            visibleBaseItems.push(baseItem);
            continue;
        }
        if (entry.kind === "delete") {
            statusById[entry.id] = entry.status;
            continue;
        }
        // "patch" or duplicate "create" already present in baseItems
        visibleBaseItems.push({
            ...baseItem,
            text:
                entry.patch.text !== undefined
                    ? entry.patch.text
                    : baseItem.text,
            checked:
                entry.patch.checked !== undefined
                    ? entry.patch.checked
                    : baseItem.checked,
            category:
                entry.patch.category !== undefined
                    ? normalizeTodoCategory(entry.patch.category)
                    : baseItem.category,
        });
        statusById[entry.id] = entry.status;
    }

    const fallbackOwnerEmail =
        options.ownerEmail ?? baseItems[0]?.ownerEmail ?? "";
    const createdCandidates: {
        item: TodoItem;
        timestamp: number;
        index: number;
    }[] = [];
    const droppedEntryIds: string[] = [];
    const reconciledEntries: TodoOutboxEntry[] = [];

    entries.forEach((entry, index) => {
        if (entry.status === "dropped") {
            droppedEntryIds.push(entry.id);
            reconciledEntries.push(entry);
            return;
        }

        if (entry.kind === "create") {
            reconciledEntries.push(entry);
            if (!baseIdSet.has(entry.id)) {
                const createdAt =
                    entry.createdAt ?? extractCreatedAtFromClientId(entry.id);
                const item: TodoItem = {
                    id: entry.id,
                    ownerEmail: fallbackOwnerEmail,
                    text: entry.patch.text ?? "",
                    checked: Boolean(entry.patch.checked ?? false),
                    category: normalizeTodoCategory(entry.patch.category),
                    createdAt,
                    updatedAt: createdAt,
                };
                createdCandidates.push({
                    item,
                    timestamp: Date.parse(createdAt),
                    index,
                });
                statusById[entry.id] = entry.status;
            }
            return;
        }

        if (entry.kind === "patch") {
            if (!baseIdSet.has(entry.id)) {
                if (isPatchEmpty(entry.patch)) {
                    // Empty in-flight patch on a disappeared item needs no notice.
                    return;
                }
                droppedEntryIds.push(entry.id);
                reconciledEntries.push({
                    id: entry.id,
                    kind: entry.kind,
                    base: entry.base ? { ...entry.base } : null,
                    patch: { ...entry.patch },
                    rev: entry.rev,
                    attempts: entry.attempts,
                    status: "dropped",
                    lastError: null,
                });
                return;
            }
            reconciledEntries.push(entry);
            return;
        }

        // entry.kind === "delete"
        if (!baseIdSet.has(entry.id)) {
            if (entry.status === "inflight") {
                reconciledEntries.push(entry);
            }
            return;
        }
        reconciledEntries.push(entry);
    });

    createdCandidates.sort((a, b) => {
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
    });

    const items = [
        ...visibleBaseItems,
        ...createdCandidates.map((candidate) => candidate.item),
    ];
    const droppedCount = droppedEntryIds.length;

    return {
        items,
        statusById,
        droppedEntryIds,
        droppedCount,
        droppedNotice:
            droppedCount > 0 ? formatDroppedTodosNotice(droppedCount) : null,
        reconciledEntries,
    };
}
