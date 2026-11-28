import assert from "node:assert/strict";
import { test } from "node:test";
import type { TodoItem } from "../src/types.ts";
import {
    applyLocalChange,
    backoffDelay,
    buildKeepaliveSyncBatch,
    buildSyncBatches,
    buildTodoOutboxKey,
    buildTodoOutboxMetaKey,
    buildTodoOutboxScopePrefix,
    classifySyncRequestError,
    CLIENT_TODO_ID_REGEX,
    discardOutboxEntry,
    dismissDroppedEntries,
    formatDroppedTodosNotice,
    generateClientTodoId,
    generateUuidV4,
    getUtf8ByteLength,
    isValidClientTodoId,
    nextFlushDelay,
    overlayTodos,
    parseTodoOutboxKey,
    reconcileSyncFailure,
    reconcileSyncResponse,
    resetEntriesForRetry,
    TODO_KEEPALIVE_MAX_BYTES,
    TODO_OUTBOX_DEBOUNCE_MS,
    TODO_OUTBOX_MAX_TRANSIENT_ATTEMPTS,
    TODO_OUTBOX_MAX_WAIT_MS,
    TODO_SYNC_MAX_OPS,
    type TodoOutboxEntry,
} from "../src/utils/todoOutbox.ts";

const OWNER = "an@example.com";

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
    return {
        id: "1732780000000-00000000-0000-4000-8000-000000000001",
        ownerEmail: OWNER,
        text: "買車票",
        checked: false,
        category: "交通",
        createdAt: "2026-11-28T01:00:00.000Z",
        updatedAt: "2026-11-28T01:00:00.000Z",
        ...overrides,
    };
}

function makeUuidGenerator(prefix = "00000000-0000-4000-8000-") {
    let counter = 0;
    return () => {
        counter += 1;
        return `${prefix}${String(counter).padStart(12, "0")}`;
    };
}

test("scope key helpers build and parse <sheetId>::<ownerEmail>::<todoId> and separate meta keys", () => {
    const key = buildTodoOutboxKey("sheet-a", "an@example.com", "todo-1");
    assert.equal(key, "sheet-a::an@example.com::todo-1");
    assert.equal(
        buildTodoOutboxScopePrefix(" sheet-a ", " an@example.com "),
        "sheet-a::an@example.com::",
    );
    assert.deepEqual(parseTodoOutboxKey(key), {
        sheetId: "sheet-a",
        ownerEmail: "an@example.com",
        todoId: "todo-1",
    });

    const metaKey = buildTodoOutboxMetaKey("sheet-a", "an@example.com");
    assert.equal(metaKey, "__meta__::sheet-a::an@example.com");
    assert.equal(parseTodoOutboxKey(metaKey), null);
    assert.equal(parseTodoOutboxKey("sheet-a::an@example.com"), null);
    assert.equal(parseTodoOutboxKey("sheet-a::::todo-1"), null);

    assert.throws(() => buildTodoOutboxKey("  ", "an@example.com", "todo-1"));
    assert.throws(() => buildTodoOutboxKey("sheet-a", "", "todo-1"));
    assert.throws(() => buildTodoOutboxKey("sheet-a", "an@example.com", " "));
});

test("generateClientTodoId uses injected now/randomUUID and getRandomValues UUID v4 fallback matching backend regex", () => {
    const fixedNow = () => 1732780000123;
    const fromRandomUuid = generateClientTodoId({
        now: fixedNow,
        randomUUID: () => "ABCDEF01-2345-4678-9ABC-DEF012345678",
    });
    assert.equal(
        fromRandomUuid,
        "1732780000123-abcdef01-2345-4678-9abc-def012345678",
    );
    assert.equal(CLIENT_TODO_ID_REGEX.test(fromRandomUuid), true);
    assert.equal(isValidClientTodoId(fromRandomUuid), true);

    // Fallback to getRandomValues with all-0x00 and all-0xff bytes to verify RFC 4122 v4 bits.
    const uuidFromZeros = generateUuidV4({
        randomUUID: null,
        getRandomValues: (arr) => {
            arr.fill(0x00);
            return arr;
        },
    });
    assert.equal(uuidFromZeros, "00000000-0000-4000-8000-000000000000");

    const uuidFromOnes = generateUuidV4({
        randomUUID: null,
        getRandomValues: (arr) => {
            arr.fill(0xff);
            return arr;
        },
    });
    assert.equal(uuidFromOnes, "ffffffff-ffff-4fff-bfff-ffffffffffff");

    const idFromFallback = generateClientTodoId({
        now: fixedNow,
        getRandomValues: (arr) => {
            for (let i = 0; i < arr.length; i += 1) {
                arr[i] = i * 17;
            }
            return arr;
        },
    });
    assert.equal(CLIENT_TODO_ID_REGEX.test(idFromFallback), true);
    assert.match(
        idFromFallback,
        /^1732780000123-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    // Default runtime crypto also produces a valid backend-compatible ID.
    const defaultId = generateClientTodoId();
    assert.equal(CLIENT_TODO_ID_REGEX.test(defaultId), true);
});

test("applyLocalChange merge matrix: check-uncheck and edit-back-to-base cancel out completely", () => {
    const baseItem = makeTodo({
        text: "買車票",
        checked: false,
        category: "交通",
    });

    // Check -> pending patch
    const checked = applyLocalChange(
        undefined,
        { type: "patch", id: baseItem.id, patch: { checked: true } },
        baseItem,
    );
    assert.ok(checked);
    assert.equal(checked.kind, "patch");
    assert.deepEqual(checked.base, {
        text: "買車票",
        checked: false,
        category: "交通",
    });
    assert.deepEqual(checked.patch, { checked: true });
    assert.equal(checked.rev, 1);
    assert.equal(checked.status, "pending");

    // Uncheck back to base -> cancels entry completely (null)
    const unchecked = applyLocalChange(
        checked,
        { type: "patch", id: baseItem.id, patch: { checked: false } },
        baseItem,
    );
    assert.equal(unchecked, null);

    // Edit text (with whitespace/newlines) -> edit back to original cancels
    const edited = applyLocalChange(
        undefined,
        { type: "patch", id: baseItem.id, patch: { text: "  買高鐵\n車票  " } },
        baseItem,
    );
    assert.ok(edited);
    assert.deepEqual(edited.patch, { text: "買高鐵 車票" });
    assert.equal(edited.rev, 1);

    const revertedText = applyLocalChange(
        edited,
        { type: "patch", id: baseItem.id, patch: { text: " 買車票\r\n" } },
        baseItem,
    );
    assert.equal(revertedText, null);

    // Multi-field edit where one field reverts to base keeps only the remaining field
    const multi1 = applyLocalChange(
        undefined,
        {
            type: "patch",
            id: baseItem.id,
            patch: { checked: true, category: "  未分類  " },
        },
        baseItem,
    );
    assert.ok(multi1);
    assert.deepEqual(multi1.patch, { checked: true, category: "" });

    const multi2 = applyLocalChange(
        multi1,
        { type: "patch", id: baseItem.id, patch: { category: " 交通\n" } },
        baseItem,
    );
    assert.ok(multi2);
    assert.deepEqual(multi2.patch, { checked: true });
    assert.equal(multi2.rev, 2);

    // No-op edit against uncategorized base ("未分類" normalizes to "") produces null
    const uncategorized = makeTodo({ category: undefined });
    const noopCat = applyLocalChange(
        undefined,
        { type: "patch", id: uncategorized.id, patch: { category: "未分類" } },
        uncategorized,
    );
    assert.equal(noopCat, null);
});

test("applyLocalChange merge matrix: create+patch, create+delete, patch+delete, delete existing, and failed reset", () => {
    const newId = "1732780000100-00000000-0000-4000-8000-000000000010";
    const created = applyLocalChange(undefined, {
        type: "create",
        id: newId,
        text: "  旅平險\n ",
        category: " 行前 ",
        createdAt: "2026-11-28T02:00:00.000Z",
    });
    assert.ok(created);
    assert.deepEqual(created, {
        id: newId,
        kind: "create",
        base: null,
        patch: { text: "旅平險", checked: false, category: "行前" },
        rev: 1,
        attempts: 0,
        status: "pending",
        lastError: null,
        createdAt: "2026-11-28T02:00:00.000Z",
    });

    // create + patch folds into create, bumps rev, clears opId, keeps createdAt
    const createdWithOpId: TodoOutboxEntry = {
        ...created,
        opId: "op-create-1",
    };
    const folded = applyLocalChange(createdWithOpId, {
        type: "patch",
        id: newId,
        patch: { checked: true, text: " 旅平險＋不便險 ", category: "未分類" },
    });
    assert.ok(folded);
    assert.equal(folded.kind, "create");
    assert.deepEqual(folded.patch, {
        text: "旅平險＋不便險",
        checked: true,
        category: "",
    });
    assert.equal(folded.rev, 2);
    assert.equal(folded.opId, undefined);
    assert.equal(folded.createdAt, "2026-11-28T02:00:00.000Z");

    // create + delete (not inflight) removes entry completely (never sent)
    const deletedCreate = applyLocalChange(folded, {
        type: "delete",
        id: newId,
    });
    assert.equal(deletedCreate, null);

    // patch + delete => delete
    const baseItem = makeTodo();
    const patched: TodoOutboxEntry = {
        ...applyLocalChange(
            undefined,
            { type: "patch", id: baseItem.id, patch: { checked: true } },
            baseItem,
        )!,
        opId: "op-patch-1",
    };
    const patchThenDelete = applyLocalChange(
        patched,
        { type: "delete", id: baseItem.id },
        baseItem,
    );
    assert.ok(patchThenDelete);
    assert.equal(patchThenDelete.kind, "delete");
    assert.deepEqual(patchThenDelete.patch, {});
    assert.equal(patchThenDelete.rev, 2);
    assert.equal(patchThenDelete.opId, undefined);
    assert.equal(patchThenDelete.status, "pending");

    // delete of existing item directly
    const directDelete = applyLocalChange(
        undefined,
        { type: "delete", id: baseItem.id },
        baseItem,
    );
    assert.ok(directDelete);
    assert.equal(directDelete.kind, "delete");
    assert.deepEqual(directDelete.base, {
        text: "買車票",
        checked: false,
        category: "交通",
    });
    assert.equal(directDelete.rev, 1);

    // editing a failed entry resets status to pending, attempts to 0, clears lastError/nextAttemptAt/opId
    const failedEntry: TodoOutboxEntry = {
        ...patched,
        attempts: 4,
        status: "failed",
        lastError: "同步失敗",
        nextAttemptAt: 999999,
    };
    const recovered = applyLocalChange(
        failedEntry,
        { type: "patch", id: baseItem.id, patch: { text: "改買高鐵票" } },
        baseItem,
    );
    assert.ok(recovered);
    assert.equal(recovered.status, "pending");
    assert.equal(recovered.attempts, 0);
    assert.equal(recovered.lastError, null);
    assert.equal(recovered.nextAttemptAt, undefined);
    assert.equal(recovered.opId, undefined);
    assert.equal(recovered.rev, 2);
});

test("applyLocalChange handles rev race while inflight without dropping unconfirmed reverts or deletes", () => {
    const baseItem = makeTodo({ checked: false, text: "買車票" });

    // Patch inflight + revert back to base keeps entry alive with bumped rev and empty patch
    const inflightPatch: TodoOutboxEntry = {
        id: baseItem.id,
        kind: "patch",
        base: { text: "買車票", checked: false, category: "交通" },
        patch: { checked: true },
        rev: 1,
        attempts: 0,
        status: "inflight",
        lastError: null,
        opId: "op-1",
    };
    const revertedWhileInflight = applyLocalChange(
        inflightPatch,
        { type: "patch", id: baseItem.id, patch: { checked: false } },
        baseItem,
    );
    assert.ok(revertedWhileInflight);
    assert.equal(revertedWhileInflight.rev, 2);
    assert.equal(revertedWhileInflight.status, "inflight");
    assert.deepEqual(revertedWhileInflight.patch, {});
    assert.equal(revertedWhileInflight.opId, undefined);

    // Create inflight + delete converts to delete instead of vanishing
    const inflightCreate: TodoOutboxEntry = {
        id: "1732780000200-00000000-0000-4000-8000-000000000020",
        kind: "create",
        base: null,
        patch: { text: "新項目", checked: false, category: "行李" },
        rev: 1,
        attempts: 0,
        status: "inflight",
        lastError: null,
        opId: "op-create",
    };
    const deletedWhileCreating = applyLocalChange(inflightCreate, {
        type: "delete",
        id: inflightCreate.id,
    });
    assert.ok(deletedWhileCreating);
    assert.equal(deletedWhileCreating.kind, "delete");
    assert.equal(deletedWhileCreating.rev, 2);
    assert.equal(deletedWhileCreating.status, "inflight");
    assert.equal(deletedWhileCreating.opId, undefined);
});

test("buildSyncBatches shapes create/update/delete ops, reuses stable opId on retry, and mints new opId after rev change", () => {
    const createEntry = applyLocalChange(undefined, {
        type: "create",
        id: "1732780000100-00000000-0000-4000-8000-000000000001",
        text: "旅平險",
        category: "行前",
    })!;
    const patchEntry = applyLocalChange(
        undefined,
        {
            type: "patch",
            id: "todo-2",
            patch: { checked: true, category: "" },
        },
        makeTodo({ id: "todo-2", category: "交通" }),
    )!;
    const deleteEntry = applyLocalChange(
        undefined,
        { type: "delete", id: "todo-3" },
        makeTodo({ id: "todo-3" }),
    )!;
    const failedEntry: TodoOutboxEntry = {
        ...deleteEntry,
        id: "todo-4",
        status: "failed",
        lastError: "403",
    };
    const backoffEntry: TodoOutboxEntry = {
        ...deleteEntry,
        id: "todo-5",
        nextAttemptAt: 20_000,
    };

    let opCalls = 0;
    const nextOpId = () => {
        opCalls += 1;
        return `op-${opCalls}`;
    };

    const first = buildSyncBatches(
        [createEntry, patchEntry, deleteEntry, failedEntry, backoffEntry],
        { now: 10_000, generateOpId: nextOpId },
    );

    assert.equal(first.batches.length, 1);
    assert.equal(opCalls, 3);
    assert.deepEqual(first.batches[0].ops, [
        {
            opId: "op-1",
            type: "create",
            id: createEntry.id,
            text: "旅平險",
            checked: false,
            category: "行前",
        },
        {
            opId: "op-2",
            type: "update",
            id: "todo-2",
            checked: true,
            category: "",
        },
        {
            opId: "op-3",
            type: "delete",
            id: "todo-3",
        },
    ]);
    assert.equal("text" in first.batches[0].ops[1], false);

    // Retry with same rev reuses exact opIds without calling generateOpId again.
    const retry = buildSyncBatches(first.entriesWithOpIds, {
        now: 10_000,
        generateOpId: nextOpId,
    });
    assert.equal(opCalls, 3);
    assert.deepEqual(
        retry.batches[0].ops.map((op) => op.opId),
        ["op-1", "op-2", "op-3"],
    );

    // Editing patchEntry bumps rev and clears opId -> next batch generates op-4 for todo-2 only.
    const updatedPatch = applyLocalChange(
        first.entriesWithOpIds[1],
        { type: "patch", id: "todo-2", patch: { text: "新文字" } },
        makeTodo({ id: "todo-2", category: "交通" }),
    )!;
    const afterEdit = buildSyncBatches(
        [first.entriesWithOpIds[0], updatedPatch, first.entriesWithOpIds[2]],
        { now: 10_000, generateOpId: nextOpId },
    );
    assert.equal(opCalls, 4);
    assert.deepEqual(
        afterEdit.batches[0].ops.map((op) => op.opId),
        ["op-1", "op-4", "op-3"],
    );

    // ignoreBackoff includes backing-off entry.
    const forced = buildSyncBatches([backoffEntry], {
        now: 10_000,
        ignoreBackoff: true,
        generateOpId: nextOpId,
    });
    assert.equal(forced.batches.length, 1);
    assert.equal(forced.batches[0].ops[0].id, "todo-5");
});

test("buildSyncBatches chunks to <=100 ops per request across boundary counts", () => {
    assert.equal(TODO_SYNC_MAX_OPS, 100);
    const makeEntries = (count: number): TodoOutboxEntry[] =>
        Array.from({ length: count }, (_, i) => ({
            id: `1732780000${String(i).padStart(3, "0")}-00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
            kind: "create",
            base: null,
            patch: { text: `項目 ${i}`, checked: false, category: "行李" },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        }));

    assert.deepEqual(
        buildSyncBatches(makeEntries(0), { generateOpId: makeUuidGenerator() })
            .batches,
        [],
    );
    assert.deepEqual(
        buildSyncBatches(makeEntries(100), { generateOpId: makeUuidGenerator() })
            .batches.map((b) => b.ops.length),
        [100],
    );
    assert.deepEqual(
        buildSyncBatches(makeEntries(101), { generateOpId: makeUuidGenerator() })
            .batches.map((b) => b.ops.length),
        [100, 1],
    );
    assert.deepEqual(
        buildSyncBatches(makeEntries(250), { generateOpId: makeUuidGenerator() })
            .batches.map((b) => b.ops.length),
        [100, 100, 50],
    );
});

test("buildKeepaliveSyncBatch limits UTF-8 JSON body to <=64KB with multi-byte CJK/emoji and keeps remaining entries for later", () => {
    assert.equal(TODO_KEEPALIVE_MAX_BYTES, 65_536);

    // 500 Traditional Chinese chars = 1500 UTF-8 bytes per item; 60 items > 90KB (> 64KB) while still < 100 ops.
    const cjkText = "旅".repeat(480) + "🎒".repeat(20); // 480*3 + 20*4 = 1520 bytes
    assert.equal(getUtf8ByteLength(cjkText), Buffer.byteLength(cjkText, "utf8"));

    const entries: TodoOutboxEntry[] = Array.from({ length: 60 }, (_, i) => ({
        id: `1732780000${String(i).padStart(3, "0")}-00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        kind: "create",
        base: null,
        patch: { text: cjkText, checked: false, category: "行前準備" },
        rev: 1,
        attempts: 0,
        status: "pending",
        lastError: null,
    }));

    const result = buildKeepaliveSyncBatch(entries, {
        generateOpId: makeUuidGenerator(),
    });
    assert.ok(result.batch);
    const actualUtf8Bytes = Buffer.byteLength(result.batch.body, "utf8");
    assert.equal(result.batch.byteLength, actualUtf8Bytes);
    assert.ok(actualUtf8Bytes <= TODO_KEEPALIVE_MAX_BYTES);
    assert.ok(result.batch.ops.length > 0 && result.batch.ops.length < 60);
    assert.equal(
        result.batch.ops.length + result.remainingEntries.length,
        60,
    );

    // Adding the very next remaining entry would exceed 64KB.
    const nextEntry = result.remainingEntries[0];
    const probeBody = JSON.stringify({
        ops: [
            ...result.batch.ops,
            {
                opId: "00000000-0000-4000-8000-999999999999",
                type: "create",
                id: nextEntry.id,
                text: nextEntry.patch.text,
                checked: false,
                category: nextEntry.patch.category,
            },
        ],
    });
    assert.ok(Buffer.byteLength(probeBody, "utf8") > TODO_KEEPALIVE_MAX_BYTES);

    // Remaining entries did NOT get premature opIds assigned.
    assert.equal(
        result.entriesWithOpIds[result.batch.ops.length].opId,
        undefined,
    );
    assert.ok(result.entriesWithOpIds[0].opId);

    // Also respects 100-op cap even when tiny ops fit well under 64KB.
    const tinyEntries: TodoOutboxEntry[] = Array.from(
        { length: 120 },
        (_, i) => ({
            id: `todo-${i}`,
            kind: "delete",
            base: null,
            patch: {},
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        }),
    );
    const tinyKeepalive = buildKeepaliveSyncBatch(tinyEntries, {
        generateOpId: makeUuidGenerator(),
    });
    assert.ok(tinyKeepalive.batch);
    assert.equal(tinyKeepalive.batch.ops.length, 100);
    assert.equal(tinyKeepalive.remainingEntries.length, 20);

    // Single op exceeding custom maxBytes is deferred without infinite loop.
    const tooSmallCap = buildKeepaliveSyncBatch([entries[0]], {
        maxBytes: 100,
        generateOpId: makeUuidGenerator(),
    });
    assert.equal(tooSmallCap.batch, null);
    assert.equal(tooSmallCap.remainingEntries.length, 1);
});

test("reconcileSyncResponse handles applied (create/update/delete), rev races, duplicate create edits, not_found, forbidden, invalid, and missing results", () => {
    const base1 = makeTodo({ id: "t-update", text: "舊文字", checked: false, category: "交通" });
    const base2 = makeTodo({ id: "t-delete", text: "要刪除" });
    const base3 = makeTodo({ id: "t-race", text: "競態項目", checked: false, category: "行李" });
    const base4 = makeTodo({ id: "t-revert-race", text: "反覆勾選", checked: false, category: "行李" });
    const base5 = makeTodo({ id: "t-notfound", text: "別處已刪" });
    const base6 = makeTodo({ id: "t-forbidden", text: "他人項目" });
    const base7 = makeTodo({ id: "t-invalid", text: "無效項目" });
    const base8 = makeTodo({ id: "t-missing", text: "遺漏結果" });

    const createId = "1732780000500-00000000-0000-4000-8000-000000000050";
    const dupCreateId = "1732780000501-00000000-0000-4000-8000-000000000051";
    const createDeleteId = "1732780000502-00000000-0000-4000-8000-000000000052";
    const createEditRaceId = "1732780000503-00000000-0000-4000-8000-000000000053";

    const currentEntries: TodoOutboxEntry[] = [
        {
            id: createId,
            kind: "create",
            base: null,
            patch: { text: "新待辦", checked: false, category: "行前" },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-create",
        },
        {
            id: dupCreateId,
            kind: "create",
            base: null,
            patch: { text: "重送後有改字", checked: true, category: "行前" },
            rev: 2,
            attempts: 1,
            status: "inflight",
            lastError: null,
            opId: "op-dup-create",
        },
        {
            // Create sent at rev 1, deleted locally while in-flight -> rev 2 delete
            id: createDeleteId,
            kind: "delete",
            base: null,
            patch: {},
            rev: 2,
            attempts: 0,
            status: "inflight",
            lastError: null,
        },
        {
            // Create sent at rev 1 with text="初版", edited while in-flight -> rev 2 text="修改版", checked=true
            id: createEditRaceId,
            kind: "create",
            base: null,
            patch: { text: "修改版", checked: true, category: "行前" },
            rev: 2,
            attempts: 0,
            status: "inflight",
            lastError: null,
        },
        {
            id: base1.id,
            kind: "patch",
            base: { text: "舊文字", checked: false, category: "交通" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-update",
        },
        {
            id: base2.id,
            kind: "delete",
            base: { text: "要刪除", checked: false, category: "交通" },
            patch: {},
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-delete",
        },
        {
            // Sent checked=true at rev 1; edited text while in-flight -> rev 2
            id: base3.id,
            kind: "patch",
            base: { text: "競態項目", checked: false, category: "行李" },
            patch: { checked: true, text: "新競態文字" },
            rev: 2,
            attempts: 0,
            status: "inflight",
            lastError: null,
        },
        {
            // Sent checked=true at rev 1; unchecked back to false while in-flight -> rev 2 empty patch
            id: base4.id,
            kind: "patch",
            base: { text: "反覆勾選", checked: false, category: "行李" },
            patch: {},
            rev: 2,
            attempts: 0,
            status: "inflight",
            lastError: null,
        },
        {
            id: base5.id,
            kind: "patch",
            base: { text: "別處已刪", checked: false, category: "交通" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-notfound",
        },
        {
            id: base6.id,
            kind: "patch",
            base: { text: "他人項目", checked: false, category: "交通" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-forbidden",
        },
        {
            id: base7.id,
            kind: "patch",
            base: { text: "無效項目", checked: false, category: "交通" },
            patch: { text: "" },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-invalid",
        },
        {
            id: base8.id,
            kind: "patch",
            base: { text: "遺漏結果", checked: false, category: "交通" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-missing",
        },
    ];

    const sentEntries = [
        { id: createId, rev: 1, opId: "op-create", kind: "create" as const },
        { id: dupCreateId, rev: 2, opId: "op-dup-create", kind: "create" as const },
        { id: createDeleteId, rev: 1, opId: "op-create-del", kind: "create" as const },
        { id: createEditRaceId, rev: 1, opId: "op-create-edit", kind: "create" as const },
        { id: base1.id, rev: 1, opId: "op-update", kind: "patch" as const },
        { id: base2.id, rev: 1, opId: "op-delete", kind: "delete" as const },
        { id: base3.id, rev: 1, opId: "op-race", kind: "patch" as const },
        { id: base4.id, rev: 1, opId: "op-revert-race", kind: "patch" as const },
        { id: base5.id, rev: 1, opId: "op-notfound", kind: "patch" as const },
        { id: base6.id, rev: 1, opId: "op-forbidden", kind: "patch" as const },
        { id: base7.id, rev: 1, opId: "op-invalid", kind: "patch" as const },
        { id: base8.id, rev: 1, opId: "op-missing", kind: "patch" as const },
    ];

    const createdServerItem = makeTodo({
        id: createId,
        text: "新待辦",
        checked: false,
        category: "行前",
        updatedAt: "2026-11-28T05:00:00.000Z",
    });
    const dupServerItem = makeTodo({
        id: dupCreateId,
        text: "原本的字",
        checked: false,
        category: "行前",
        updatedAt: "2026-11-28T04:50:00.000Z",
    });
    const createDelServerItem = makeTodo({
        id: createDeleteId,
        text: "建立後秒刪",
        checked: false,
        category: "行前",
        updatedAt: "2026-11-28T05:00:00.000Z",
    });
    const createEditServerItem = makeTodo({
        id: createEditRaceId,
        text: "初版",
        checked: false,
        category: "行前",
        updatedAt: "2026-11-28T05:00:00.000Z",
    });
    const updated1 = {
        ...base1,
        checked: true,
        updatedAt: "2026-11-28T05:00:00.000Z",
    };
    const updated3 = {
        ...base3,
        checked: true,
        updatedAt: "2026-11-28T05:00:00.000Z",
    };
    const updated4 = {
        ...base4,
        checked: true,
        updatedAt: "2026-11-28T05:00:00.000Z",
    };

    const reconciled = reconcileSyncResponse(
        [base1, base2, base3, base4, base5, base6, base7, base8],
        currentEntries,
        sentEntries,
        {
            syncedAt: "2026-11-28T05:00:00.000Z",
            results: [
                { opId: "op-create", id: createId, status: "applied", item: createdServerItem },
                { opId: "op-dup-create", id: dupCreateId, status: "applied", duplicate: true, item: dupServerItem },
                { opId: "op-create-del", id: createDeleteId, status: "applied", item: createDelServerItem },
                { opId: "op-create-edit", id: createEditRaceId, status: "applied", item: createEditServerItem },
                { opId: "op-update", id: base1.id, status: "applied", item: updated1 },
                { opId: "op-delete", id: base2.id, status: "applied", deleted: true },
                { opId: "op-race", id: base3.id, status: "applied", item: updated3 },
                { opId: "op-revert-race", id: base4.id, status: "applied", item: updated4 },
                { opId: "op-notfound", id: base5.id, status: "not_found" },
                { opId: "op-forbidden", id: base6.id, status: "forbidden" },
                { opId: "op-invalid", id: base7.id, status: "invalid", message: "text 不可為空" },
                // op-missing intentionally omitted!
            ],
        },
        { now: 100_000, random: () => 0.5 },
    );

    const byId = new Map(reconciled.entries.map((e) => [e.id, e]));
    const baseById = new Map(reconciled.baseItems.map((i) => [i.id, i]));

    // 1. applied create/update/delete (rev unchanged) removed from outbox and reflected in baseItems
    assert.equal(byId.has(createId), false);
    assert.deepEqual(baseById.get(createId), createdServerItem);
    assert.equal(byId.has(base1.id), false);
    assert.deepEqual(baseById.get(base1.id), updated1);
    assert.equal(byId.has(base2.id), false);
    assert.equal(baseById.has(base2.id), false);

    // 2. duplicate create whose existing server item differs from local edits rebases to patch
    const dupRebased = byId.get(dupCreateId);
    assert.ok(dupRebased);
    assert.equal(dupRebased.kind, "patch");
    assert.equal(dupRebased.status, "pending");
    assert.deepEqual(dupRebased.patch, { text: "重送後有改字", checked: true });
    assert.equal(dupRebased.opId, undefined);

    // 3. create deleted while in-flight stays as pending delete so next flush deletes it
    const createDelNext = byId.get(createDeleteId);
    assert.ok(createDelNext);
    assert.equal(createDelNext.kind, "delete");
    assert.equal(createDelNext.status, "pending");
    assert.deepEqual(baseById.get(createDeleteId), createDelServerItem);

    // 3b. create edited while in-flight converts to pending patch against returned server item
    const createEditNext = byId.get(createEditRaceId);
    assert.ok(createEditNext);
    assert.equal(createEditNext.kind, "patch");
    assert.equal(createEditNext.status, "pending");
    assert.deepEqual(createEditNext.base, {
        text: "初版",
        checked: false,
        category: "行前",
    });
    assert.deepEqual(createEditNext.patch, { text: "修改版", checked: true });
    assert.equal(createEditNext.opId, undefined);
    assert.deepEqual(baseById.get(createEditRaceId), createEditServerItem);

    // 4. rev race on patch: checked=true dropped from patch, text="新競態文字" retained on new base
    const raceNext = byId.get(base3.id);
    assert.ok(raceNext);
    assert.equal(raceNext.kind, "patch");
    assert.equal(raceNext.status, "pending");
    assert.equal(raceNext.base?.checked, true);
    assert.deepEqual(raceNext.patch, { text: "新競態文字" });
    assert.equal(raceNext.opId, undefined);

    // 5. revert while in-flight: server applied checked=true, rebased patch now sends checked=false
    const revertRaceNext = byId.get(base4.id);
    assert.ok(revertRaceNext);
    assert.equal(revertRaceNext.kind, "patch");
    assert.equal(revertRaceNext.status, "pending");
    assert.equal(revertRaceNext.base?.checked, true);
    assert.deepEqual(revertRaceNext.patch, { checked: false });

    // 6. not_found on update => dropped + removed from base
    const notFoundNext = byId.get(base5.id);
    assert.ok(notFoundNext);
    assert.equal(notFoundNext.status, "dropped");
    assert.equal(baseById.has(base5.id), false);
    assert.deepEqual(reconciled.droppedIds, [base5.id]);

    // 7. forbidden & invalid => permanent failed with message
    const forbiddenNext = byId.get(base6.id);
    assert.ok(forbiddenNext);
    assert.equal(forbiddenNext.status, "failed");
    assert.equal(forbiddenNext.lastError, "沒有權限修改這個待辦");

    const invalidNext = byId.get(base7.id);
    assert.ok(invalidNext);
    assert.equal(invalidNext.status, "failed");
    assert.equal(invalidNext.lastError, "text 不可為空");

    // 8. missing result => transient (attempts + 1, pending with backoff, opId preserved)
    const missingNext = byId.get(base8.id);
    assert.ok(missingNext);
    assert.equal(missingNext.status, "pending");
    assert.equal(missingNext.attempts, 1);
    assert.equal(missingNext.nextAttemptAt, 105_000);
    assert.equal(missingNext.opId, "op-missing");
    assert.deepEqual(reconciled.transientIds, [base8.id]);
});

test("reconcileSyncFailure handles transient 4-strike rule, 401 authExpired, and permanent 400/403", () => {
    assert.equal(TODO_OUTBOX_MAX_TRANSIENT_ATTEMPTS, 4);
    assert.equal(classifySyncRequestError(new TypeError("Failed to fetch")), "transient");
    assert.equal(classifySyncRequestError({ name: "AbortError" }), "transient");
    assert.equal(classifySyncRequestError({ status: 408 }), "transient");
    assert.equal(classifySyncRequestError({ status: 429 }), "transient");
    assert.equal(classifySyncRequestError({ status: 500 }), "transient");
    assert.equal(classifySyncRequestError({ status: 503 }), "transient");
    assert.equal(classifySyncRequestError({ status: 401 }), "auth");
    assert.equal(classifySyncRequestError({ code: "TOKEN_EXPIRED" }), "auth");
    assert.equal(classifySyncRequestError({ status: 400, code: "INVALID_PARAMS" }), "permanent");
    assert.equal(classifySyncRequestError({ status: 403, code: "FORBIDDEN" }), "permanent");
    assert.equal(classifySyncRequestError({ status: 422, code: "INVALID_SHEET_LAYOUT" }), "permanent");

    const untouched: TodoOutboxEntry = {
        id: "t-untouched",
        kind: "delete",
        base: null,
        patch: {},
        rev: 1,
        attempts: 0,
        status: "pending",
        lastError: null,
    };
    let entries: TodoOutboxEntry[] = [
        {
            id: "t-1",
            kind: "patch",
            base: { text: "A", checked: false, category: "" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-1",
        },
        untouched,
    ];
    const sent = [{ id: "t-1", rev: 1, opId: "op-1", kind: "patch" as const }];

    // 4-strike transient progression (5s -> 15s -> 45s -> failed on 4th)
    const transientErrors = [
        new TypeError("Failed to fetch"),
        { status: 503 },
        { status: 429 },
        { name: "TimeoutError" },
    ];
    const expectedDelays = [5_000, 15_000, 45_000];

    for (let strike = 1; strike <= 4; strike += 1) {
        const res = reconcileSyncFailure(
            entries,
            sent,
            transientErrors[strike - 1],
            { now: 10_000, random: () => 0.5 },
        );
        assert.equal(res.failureKind, "transient");
        assert.equal(res.authExpired, false);
        assert.deepEqual(res.entries[1], untouched);

        const item = res.entries[0];
        assert.equal(item.attempts, strike);
        assert.equal(item.opId, "op-1");

        if (strike < 4) {
            assert.equal(item.status, "pending");
            assert.equal(item.nextAttemptAt, 10_000 + expectedDelays[strike - 1]);
            assert.equal(res.nextAttemptAt, 10_000 + expectedDelays[strike - 1]);
            assert.deepEqual(res.failedIds, []);
            assert.deepEqual(res.transientIds, ["t-1"]);
            entries = [{ ...item, status: "inflight" }, untouched];
        } else {
            assert.equal(item.status, "failed");
            assert.equal(item.nextAttemptAt, undefined);
            assert.ok(item.lastError);
            assert.deepEqual(res.failedIds, ["t-1"]);
            assert.deepEqual(res.transientIds, []);
        }
    }

    // Manual retry resets failed entry back to pending with attempts=0 while keeping opId.
    const retried = resetEntriesForRetry(
        [{ ...entries[0], status: "failed", attempts: 4, lastError: "失敗" }],
    );
    assert.equal(retried[0].status, "pending");
    assert.equal(retried[0].attempts, 0);
    assert.equal(retried[0].lastError, null);
    assert.equal(retried[0].nextAttemptAt, undefined);
    assert.equal(retried[0].opId, "op-1");

    // 401 -> separate auth signal, NOT failed, attempts untouched.
    const authRes = reconcileSyncFailure(
        [{ ...retried[0], status: "inflight", attempts: 1 }],
        sent,
        { status: 401, code: "UNAUTHORIZED" },
        { now: 20_000 },
    );
    assert.equal(authRes.failureKind, "auth");
    assert.equal(authRes.authExpired, true);
    assert.equal(authRes.entries[0].status, "pending");
    assert.equal(authRes.entries[0].attempts, 1);
    assert.equal(authRes.entries[0].opId, "op-1");
    assert.deepEqual(authRes.failedIds, []);

    // Permanent 400 and 403 -> failed immediately on first attempt.
    for (const err of [
        { status: 400, code: "INVALID_PARAMS", message: "ops 格式錯誤" },
        { status: 403, code: "FORBIDDEN" },
    ]) {
        const permRes = reconcileSyncFailure(
            [{ ...retried[0], status: "inflight", attempts: 0 }],
            sent,
            err,
            { now: 30_000 },
        );
        assert.equal(permRes.failureKind, "permanent");
        assert.equal(permRes.authExpired, false);
        assert.equal(permRes.entries[0].status, "failed");
        assert.ok(permRes.entries[0].lastError);
        assert.deepEqual(permRes.failedIds, ["t-1"]);
    }

    // Discard & dismiss helpers
    assert.deepEqual(discardOutboxEntry(retried, "t-1"), []);
    assert.deepEqual(
        dismissDroppedEntries([
            { ...retried[0], id: "d1", status: "dropped" },
            retried[0],
        ]).map((e) => e.id),
        ["t-1"],
    );
});

test("overlayTodos overlays patches/creates/deletes on refetch-replaced base and detects dropped patches", () => {
    const serverBase: TodoItem[] = [
        makeTodo({ id: "b1", text: "伺服器版本", checked: false, category: "行李" }),
        makeTodo({ id: "b2", text: "本地已刪", checked: false, category: "交通" }),
        makeTodo({ id: "b3", text: "無改動", checked: true, category: "證件" }),
    ];

    // Out-of-order creates, patch on b1, delete on b2, patch on disappeared b-gone, delete on disappeared b-del-gone
    const entries: TodoOutboxEntry[] = [
        {
            id: "1732780000200-00000000-0000-4000-8000-000000000002",
            kind: "create",
            base: null,
            patch: { text: "第二筆新增", checked: false, category: "行李" },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            createdAt: "2026-11-28T03:02:00.000Z",
        },
        {
            id: "1732780000100-00000000-0000-4000-8000-000000000001",
            kind: "create",
            base: null,
            patch: { text: "第一筆新增", checked: true, category: "" },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
            createdAt: "2026-11-28T03:01:00.000Z",
        },
        {
            id: "b1",
            kind: "patch",
            base: { text: "舊伺服器版本", checked: false, category: "行李" },
            patch: { checked: true, category: "" },
            rev: 1,
            attempts: 0,
            status: "failed",
            lastError: "失敗",
        },
        {
            id: "b2",
            kind: "delete",
            base: { text: "本地已刪", checked: false, category: "交通" },
            patch: {},
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        },
        {
            id: "b-gone-1",
            kind: "patch",
            base: { text: "別處已刪 1", checked: false, category: "" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        },
        {
            id: "b-gone-2",
            kind: "patch",
            base: { text: "別處已刪 2", checked: false, category: "" },
            patch: { text: "我有改字" },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        },
        {
            id: "b-del-gone",
            kind: "delete",
            base: { text: "兩邊都刪了", checked: false, category: "" },
            patch: {},
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        },
    ];

    const overlay = overlayTodos(serverBase, entries, { ownerEmail: OWNER });

    // Visible list: b1 (patched, keeping server's updated text while overriding checked & clearing category),
    // b2 hidden, b3 intact, creates appended in creation order (first before second).
    assert.deepEqual(
        overlay.items.map((item) => ({
            id: item.id,
            text: item.text,
            checked: item.checked,
            category: item.category,
        })),
        [
            { id: "b1", text: "伺服器版本", checked: true, category: "" },
            { id: "b3", text: "無改動", checked: true, category: "證件" },
            {
                id: "1732780000100-00000000-0000-4000-8000-000000000001",
                text: "第一筆新增",
                checked: true,
                category: "",
            },
            {
                id: "1732780000200-00000000-0000-4000-8000-000000000002",
                text: "第二筆新增",
                checked: false,
                category: "行李",
            },
        ],
    );

    assert.equal(overlay.statusById["b1"], "failed");
    assert.equal(
        overlay.statusById["1732780000100-00000000-0000-4000-8000-000000000001"],
        "pending",
    );
    assert.equal(
        overlay.statusById["1732780000200-00000000-0000-4000-8000-000000000002"],
        "inflight",
    );
    assert.equal(overlay.statusById["b3"], undefined);
    assert.equal(overlay.statusById["b-gone-1"], undefined);

    // Dropped detection for patches whose base disappeared; disappeared delete is NOT counted as dropped.
    assert.deepEqual(overlay.droppedEntryIds, ["b-gone-1", "b-gone-2"]);
    assert.equal(overlay.droppedCount, 2);
    assert.equal(
        overlay.droppedNotice,
        "2 項已在其他裝置刪除，已移除你的變更",
    );
    assert.equal(
        formatDroppedTodosNotice(1),
        "1 項已在其他裝置刪除，已移除你的變更",
    );

    const reconciledById = new Map(
        overlay.reconciledEntries.map((e) => [e.id, e]),
    );
    assert.equal(reconciledById.get("b-gone-1")?.status, "dropped");
    assert.equal(reconciledById.get("b-gone-2")?.status, "dropped");
    assert.equal(reconciledById.has("b-del-gone"), false);

    // Deduplicates if a pending create's id already arrived in baseItems via refetch.
    const dupId = "1732780000100-00000000-0000-4000-8000-000000000001";
    const dedupOverlay = overlayTodos(
        [makeTodo({ id: dupId, text: "伺服器版", checked: false })],
        [entries[1]],
    );
    assert.equal(dedupOverlay.items.length, 1);
    assert.equal(dedupOverlay.items[0].text, "第一筆新增");
    assert.equal(dedupOverlay.items[0].checked, true);

    // Falls back to 13-digit client-id timestamp prefix for ordering creates without explicit createdAt.
    const prefixOrdered = overlayTodos([], [
        {
            id: "1732780009000-00000000-0000-4000-8000-000000000009",
            kind: "create",
            base: null,
            patch: { text: "較晚", checked: false, category: "" },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        },
        {
            id: "1732780001000-00000000-0000-4000-8000-000000000001",
            kind: "create",
            base: null,
            patch: { text: "較早", checked: false, category: "" },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        },
    ]);
    assert.deepEqual(
        prefixOrdered.items.map((item) => item.text),
        ["較早", "較晚"],
    );
    assert.equal(prefixOrdered.items[0].createdAt, new Date(1732780001000).toISOString());
});

test("nextFlushDelay enforces 1500ms debounce and 10000ms maxWait", () => {
    assert.equal(TODO_OUTBOX_DEBOUNCE_MS, 1_500);
    assert.equal(TODO_OUTBOX_MAX_WAIT_MS, 10_000);

    // Single change -> 1500ms
    assert.equal(
        nextFlushDelay({ now: 1_000, firstChangeAt: 1_000, lastChangeAt: 1_000 }),
        1_500,
    );
    // Elapsed 500ms since last change -> 1000ms left
    assert.equal(
        nextFlushDelay({ now: 1_500, firstChangeAt: 1_000, lastChangeAt: 1_000 }),
        1_000,
    );
    // Continuous edits: last change at 9s after first -> capped by 10s maxWait (1000ms left)
    assert.equal(
        nextFlushDelay({ now: 10_000, firstChangeAt: 1_000, lastChangeAt: 10_000 }),
        1_000,
    );
    // At maxWait boundary -> 0ms (flush immediately)
    assert.equal(
        nextFlushDelay({ now: 11_000, firstChangeAt: 1_000, lastChangeAt: 11_000 }),
        0,
    );
    // Past both deadlines -> clamped at 0ms
    assert.equal(
        nextFlushDelay({ now: 20_000, firstChangeAt: 1_000, lastChangeAt: 12_000 }),
        0,
    );
});

test("backoffDelay follows 5/15/45/120s cap 120s with exact ±20% jitter bounds", () => {
    const cases: { attempt: number; min: number; mid: number; max: number }[] = [
        { attempt: 1, min: 4_000, mid: 5_000, max: 6_000 },
        { attempt: 2, min: 12_000, mid: 15_000, max: 18_000 },
        { attempt: 3, min: 36_000, mid: 45_000, max: 54_000 },
        { attempt: 4, min: 96_000, mid: 120_000, max: 144_000 },
        { attempt: 5, min: 96_000, mid: 120_000, max: 144_000 },
        { attempt: 20, min: 96_000, mid: 120_000, max: 144_000 },
    ];

    for (const { attempt, min, mid, max } of cases) {
        assert.equal(backoffDelay(attempt, () => 0), min);
        assert.equal(backoffDelay(attempt, () => 0.5), mid);
        assert.equal(backoffDelay(attempt, () => 1), max);
    }

    // Clamps out-of-range attempt and random inputs safely.
    assert.equal(backoffDelay(0, () => 0.5), 5_000);
    assert.equal(backoffDelay(1, () => -1), 4_000);
    assert.equal(backoffDelay(1, () => 2), 6_000);
});

test("reconcileSyncResponse in-flight rev rebase preserves untouched server fields using sentFields", () => {
    const initialBase = makeTodo({
        id: "t-multi-device",
        text: "原字",
        checked: false,
        category: "交通",
    });

    // Device 1 checks the item (rev 1) and builds an update batch.
    const checkedEntry = applyLocalChange(
        undefined,
        { type: "patch", id: initialBase.id, patch: { checked: true } },
        initialBase,
    )!;
    const built = buildSyncBatches([checkedEntry], {
        generateOpId: () => "op-checked-1",
    });
    assert.equal(built.batches.length, 1);
    assert.deepEqual(built.batches[0].sent[0].sentFields, ["checked"]);

    // While in-flight, Device 1 changes category (never touching text).
    const inflightEntry: TodoOutboxEntry = {
        ...built.entriesWithOpIds[0],
        status: "inflight",
    };
    const editedCategory = applyLocalChange(
        inflightEntry,
        { type: "patch", id: initialBase.id, patch: { category: "行李" } },
        initialBase,
    )!;
    assert.equal(editedCategory.rev, 2);
    assert.deepEqual(editedCategory.patch, { checked: true, category: "行李" });

    // Meanwhile Device 2 updated text to "新字" on the server.
    const serverItem = makeTodo({
        id: initialBase.id,
        text: "新字",
        checked: true,
        category: "交通",
        updatedAt: "2026-11-28T06:00:00.000Z",
    });

    const rebased = reconcileSyncResponse(
        [initialBase],
        [editedCategory],
        built.batches[0].sent,
        {
            syncedAt: "2026-11-28T06:00:00.000Z",
            results: [
                {
                    opId: "op-checked-1",
                    id: initialBase.id,
                    status: "applied",
                    item: serverItem,
                },
            ],
        },
    );

    assert.equal(rebased.entries.length, 1);
    assert.equal(rebased.entries[0].status, "pending");
    assert.deepEqual(rebased.entries[0].base, {
        text: "新字",
        checked: true,
        category: "交通",
    });
    // Must ONLY patch category — must NOT synthesize text: "原字" and clobber Device 2's "新字".
    assert.deepEqual(rebased.entries[0].patch, { category: "行李" });

    // Also verify in-flight revert of checked while Device 2 updated text:
    // rebased patch should revert checked back to false without touching text.
    const revertedInflight = applyLocalChange(
        inflightEntry,
        { type: "patch", id: initialBase.id, patch: { checked: false } },
        initialBase,
    )!;
    assert.deepEqual(revertedInflight.patch, {});

    const rebasedRevert = reconcileSyncResponse(
        [initialBase],
        [revertedInflight],
        built.batches[0].sent,
        {
            syncedAt: "2026-11-28T06:00:00.000Z",
            results: [
                {
                    opId: "op-checked-1",
                    id: initialBase.id,
                    status: "applied",
                    item: serverItem,
                },
            ],
        },
    );

    assert.equal(rebasedRevert.entries.length, 1);
    assert.deepEqual(rebasedRevert.entries[0].base, {
        text: "新字",
        checked: true,
        category: "交通",
    });
    assert.deepEqual(rebasedRevert.entries[0].patch, { checked: false });
});

test("overlayTodos keeps failed delete entries visible with failed status while hiding pending/inflight deletes", () => {
    const pendingDel = makeTodo({ id: "b-pending-del", text: "待刪除" });
    const inflightDel = makeTodo({ id: "b-inflight-del", text: "刪除中" });
    const failedDel = makeTodo({ id: "b-failed-del", text: "刪除失敗" });

    const entries: TodoOutboxEntry[] = [
        {
            id: pendingDel.id,
            kind: "delete",
            base: { text: "待刪除", checked: false, category: "交通" },
            patch: {},
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
        },
        {
            id: inflightDel.id,
            kind: "delete",
            base: { text: "刪除中", checked: false, category: "交通" },
            patch: {},
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
        },
        {
            id: failedDel.id,
            kind: "delete",
            base: { text: "刪除失敗", checked: false, category: "交通" },
            patch: {},
            rev: 1,
            attempts: 1,
            status: "failed",
            lastError: "沒有權限修改這個待辦",
        },
    ];

    const overlay = overlayTodos(
        [pendingDel, inflightDel, failedDel],
        entries,
        { ownerEmail: OWNER },
    );

    assert.deepEqual(
        overlay.items.map((item) => item.id),
        [failedDel.id],
    );
    assert.equal(overlay.statusById[failedDel.id], "failed");
    assert.equal(overlay.statusById[pendingDel.id], "pending");
    assert.equal(overlay.statusById[inflightDel.id], "inflight");

    // Discarding the failed delete returns the item cleanly with no error status.
    const afterDiscard = overlayTodos(
        [failedDel],
        discardOutboxEntry(entries, failedDel.id).filter(
            (entry) => entry.id === failedDel.id,
        ),
    );
    assert.equal(afterDiscard.items.length, 1);
    assert.equal(afterDiscard.statusById[failedDel.id], undefined);
});

test("reconcileSyncResponse drops empty-patch entries on per-op invalid and forbidden rev races", () => {
    const itemA = makeTodo({ id: "t-invalid-revert", text: "原字 A" });
    const itemB = makeTodo({ id: "t-forbidden-revert", text: "原字 B" });

    const currentEntries: TodoOutboxEntry[] = [
        {
            id: itemA.id,
            kind: "patch",
            base: { text: "原字 A", checked: false, category: "交通" },
            patch: {},
            rev: 2,
            attempts: 0,
            status: "inflight",
            lastError: null,
        },
        {
            id: itemB.id,
            kind: "patch",
            base: { text: "原字 B", checked: false, category: "交通" },
            patch: {},
            rev: 2,
            attempts: 0,
            status: "inflight",
            lastError: null,
        },
    ];

    const sentEntries = [
        {
            id: itemA.id,
            rev: 1,
            opId: "op-inv",
            kind: "patch" as const,
            sentFields: ["text" as const],
        },
        {
            id: itemB.id,
            rev: 1,
            opId: "op-forb",
            kind: "patch" as const,
            sentFields: ["checked" as const],
        },
    ];

    const reconciled = reconcileSyncResponse(
        [itemA, itemB],
        currentEntries,
        sentEntries,
        {
            syncedAt: "2026-11-28T06:00:00.000Z",
            results: [
                {
                    opId: "op-inv",
                    id: itemA.id,
                    status: "invalid",
                    message: "text 不可為空",
                },
                {
                    opId: "op-forb",
                    id: itemB.id,
                    status: "forbidden",
                },
            ],
        },
    );

    assert.deepEqual(reconciled.entries, []);
    assert.deepEqual(reconciled.failedIds, []);
});

test("overlayTodos rebases non-inflight patch entries onto refetched base and drops redundant patches", () => {
    const refetchedBase: TodoItem[] = [
        makeTodo({ id: "b-same", text: "一樣", checked: true, category: "交通" }),
        makeTodo({ id: "b-other-field", text: "新文字", checked: false, category: "交通" }),
        makeTodo({ id: "b-partial", text: "舊文字", checked: true, category: "交通" }),
        makeTodo({ id: "b-inflight", text: "伺服器字", checked: true, category: "交通" }),
    ];

    const entries: TodoOutboxEntry[] = [
        {
            // Device 2 already checked b-same -> patch becomes empty and drops
            id: "b-same",
            kind: "patch",
            base: { text: "一樣", checked: false, category: "交通" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
            opId: "op-same",
        },
        {
            // Device 2 changed text -> base rebases to text:"新文字", patch & opId preserved
            id: "b-other-field",
            kind: "patch",
            base: { text: "舊文字", checked: false, category: "交通" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
            opId: "op-other",
        },
        {
            // Device 2 already checked b-partial -> patch narrows to { text: "本地字" }, rev bumps & opId clears
            id: "b-partial",
            kind: "patch",
            base: { text: "舊文字", checked: false, category: "交通" },
            patch: { text: "本地字", checked: true },
            rev: 1,
            attempts: 0,
            status: "pending",
            lastError: null,
            opId: "op-partial",
        },
        {
            // Inflight entry must remain untouched until sync response reconciles it
            id: "b-inflight",
            kind: "patch",
            base: { text: "舊字", checked: false, category: "交通" },
            patch: { checked: true },
            rev: 1,
            attempts: 0,
            status: "inflight",
            lastError: null,
            opId: "op-inflight",
        },
    ];

    const overlaid = overlayTodos(refetchedBase, entries, { ownerEmail: OWNER });
    const byId = new Map(overlaid.reconciledEntries.map((e) => [e.id, e]));

    assert.equal(byId.has("b-same"), false);
    assert.equal(overlaid.statusById["b-same"], undefined);

    const otherField = byId.get("b-other-field");
    assert.ok(otherField);
    assert.deepEqual(otherField.base, {
        text: "新文字",
        checked: false,
        category: "交通",
    });
    assert.deepEqual(otherField.patch, { checked: true });
    assert.equal(otherField.rev, 1);
    assert.equal(otherField.opId, "op-other");

    const partial = byId.get("b-partial");
    assert.ok(partial);
    assert.deepEqual(partial.base, {
        text: "舊文字",
        checked: true,
        category: "交通",
    });
    assert.deepEqual(partial.patch, { text: "本地字" });
    assert.equal(partial.rev, 2);
    assert.equal(partial.opId, undefined);

    const inflight = byId.get("b-inflight");
    assert.deepEqual(inflight, entries[3]);
});

test("reconcileSyncFailure and reconcileSyncResponse emit explicit revert patch on transient failure after in-flight revert", () => {
    const baseItem = makeTodo({
        id: "t-timeout-revert",
        text: "買車票",
        checked: false,
        category: "交通",
    });
    const entryRev1 = applyLocalChange(
        undefined,
        { type: "patch", id: baseItem.id, patch: { checked: true } },
        baseItem,
    )!;
    const built = buildSyncBatches([entryRev1], {
        generateOpId: () => "op-send-1",
    });
    const inflightRev1: TodoOutboxEntry = {
        ...built.entriesWithOpIds[0],
        status: "inflight",
    };

    // User unchecks back to base while op-send-1 is in flight -> rev 2, empty patch
    const revertedRev2 = applyLocalChange(
        inflightRev1,
        { type: "patch", id: baseItem.id, patch: { checked: false } },
        baseItem,
    )!;
    assert.deepEqual(revertedRev2.patch, {});
    assert.equal(revertedRev2.rev, 2);

    // 1. Whole-request TIMEOUT -> must NOT drop; keeps explicit { checked: false } patch
    const timeoutRes = reconcileSyncFailure(
        [revertedRev2],
        built.batches[0].sent,
        { code: "TIMEOUT", message: "Request timed out" },
        { now: 50_000, random: () => 0.5 },
    );
    assert.equal(timeoutRes.entries.length, 1);
    assert.equal(timeoutRes.entries[0].status, "pending");
    assert.equal(timeoutRes.entries[0].attempts, 1);
    assert.equal(timeoutRes.entries[0].nextAttemptAt, 55_000);
    assert.equal(timeoutRes.entries[0].opId, undefined);
    assert.deepEqual(timeoutRes.entries[0].patch, { checked: false });
    assert.deepEqual(timeoutRes.transientIds, [baseItem.id]);

    // 2. HTTP 200 missing per-op result (transient) -> same explicit revert patch
    const missingRes = reconcileSyncResponse(
        [baseItem],
        [revertedRev2],
        built.batches[0].sent,
        { syncedAt: "2026-11-28T06:00:00.000Z", results: [] },
        { now: 60_000, random: () => 0.5 },
    );
    assert.equal(missingRes.entries.length, 1);
    assert.equal(missingRes.entries[0].status, "pending");
    assert.deepEqual(missingRes.entries[0].patch, { checked: false });
    assert.deepEqual(missingRes.transientIds, [baseItem.id]);

    // 3. 401 auth rejection (server never applied op) -> empty patch still drops cleanly
    const authRes = reconcileSyncFailure(
        [revertedRev2],
        built.batches[0].sent,
        { status: 401, code: "UNAUTHORIZED" },
        { now: 70_000 },
    );
    assert.deepEqual(authRes.entries, []);

    // 4. Partial in-flight revert: sent { text: "新字", checked: true }, reverted checked only
    const twoFieldEntry = applyLocalChange(
        undefined,
        {
            type: "patch",
            id: baseItem.id,
            patch: { text: "新字", checked: true },
        },
        baseItem,
    )!;
    const builtTwo = buildSyncBatches([twoFieldEntry], {
        generateOpId: () => "op-send-2",
    });
    const partialReverted = applyLocalChange(
        { ...builtTwo.entriesWithOpIds[0], status: "inflight" },
        { type: "patch", id: baseItem.id, patch: { checked: false } },
        baseItem,
    )!;
    assert.deepEqual(partialReverted.patch, { text: "新字" });

    const partialTimeout = reconcileSyncFailure(
        [partialReverted],
        builtTwo.batches[0].sent,
        { code: "TIMEOUT" },
        { now: 80_000, random: () => 0.5 },
    );
    assert.deepEqual(partialTimeout.entries[0].patch, {
        text: "新字",
        checked: false,
    });
});
