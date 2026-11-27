import assert from "node:assert/strict";
import { test } from "node:test";
import {
    getCompletionStats,
    getTextCounter,
    getTodoErrorKind,
    getTodoErrorMessage,
    isForbiddenError,
    isNotFoundError,
    isOfflineError,
    normalizeTodoText,
    sanitizeTodoLineBreaks,
    sortTodos,
    TODO_TEXT_MAX_LENGTH,
    validateTodoText,
} from "../src/utils/todoList.ts";

test("sortTodos orders by createdAt oldest first without mutating input", () => {
    const input = [
        { id: "c", createdAt: "2026-11-27T03:00:00.000Z", checked: false },
        { id: "a", createdAt: "2026-11-27T01:00:00.000Z", checked: true },
        { id: "b", createdAt: "2026-11-27T02:00:00.000Z", checked: false },
    ];
    const snapshot = input.map((item) => ({ ...item }));

    const sorted = sortTodos(input);

    assert.notEqual(sorted, input);
    assert.deepEqual(input, snapshot);
    assert.deepEqual(
        sorted.map((item) => item.id),
        ["a", "b", "c"],
    );
});

test("sortTodos never regroups by checked state", () => {
    const items = [
        { id: "done-older", createdAt: "2026-11-27T01:00:00.000Z", checked: true },
        { id: "open-middle", createdAt: "2026-11-27T02:00:00.000Z", checked: false },
        { id: "done-newer", createdAt: "2026-11-27T03:00:00.000Z", checked: true },
        { id: "open-newest", createdAt: "2026-11-27T04:00:00.000Z", checked: false },
    ];

    const sorted = sortTodos(items);
    assert.deepEqual(
        sorted.map((item) => item.id),
        ["done-older", "open-middle", "done-newer", "open-newest"],
    );

    const toggled = items.map((item) =>
        item.id === "open-middle" ? { ...item, checked: true } : item,
    );
    assert.deepEqual(
        sortTodos(toggled).map((item) => item.id),
        ["done-older", "open-middle", "done-newer", "open-newest"],
    );
});

test("sortTodos preserves input order for tied timestamps and unparsable dates", () => {
    const tied = [
        { id: "first", createdAt: "2026-11-27T01:00:00.000Z" },
        { id: "second", createdAt: "2026-11-27T01:00:00.000Z" },
        { id: "third", createdAt: "2026-11-27T01:00:00.000Z" },
    ];
    assert.deepEqual(
        sortTodos(tied).map((item) => item.id),
        ["first", "second", "third"],
    );

    const allInvalid = [
        { id: "bad-1", createdAt: "not-a-date" },
        { id: "bad-2", createdAt: "" },
        { id: "bad-3", createdAt: "yesterday" },
    ];
    assert.deepEqual(
        sortTodos(allInvalid).map((item) => item.id),
        ["bad-1", "bad-2", "bad-3"],
    );

    const mixed = [
        { id: "bad-1", createdAt: "invalid" },
        { id: "valid-2", createdAt: "2026-11-27T02:00:00.000Z" },
        { id: "bad-2", createdAt: "" },
        { id: "valid-1", createdAt: "2026-11-27T01:00:00.000Z" },
    ];
    assert.deepEqual(
        sortTodos(mixed).map((item) => item.id),
        ["valid-1", "valid-2", "bad-1", "bad-2"],
    );
});

test("getCompletionStats computes completed, total, and integer percent", () => {
    assert.deepEqual(getCompletionStats([]), {
        completed: 0,
        total: 0,
        percent: 0,
    });
    assert.deepEqual(
        getCompletionStats([
            { checked: true },
            { checked: false },
            { checked: false },
        ]),
        { completed: 1, total: 3, percent: 33 },
    );
    assert.deepEqual(
        getCompletionStats([
            { checked: true },
            { checked: true },
            { checked: false },
        ]),
        { completed: 2, total: 3, percent: 67 },
    );
    assert.deepEqual(
        getCompletionStats([{ checked: true }, { checked: true }]),
        { completed: 2, total: 2, percent: 100 },
    );
});

test("normalizeTodoText and sanitizeTodoLineBreaks convert line breaks to spaces without collapsing internal spaces", () => {
    assert.equal(normalizeTodoText("  訂 3/15 晚餐餐廳  "), "訂 3/15 晚餐餐廳");
    assert.equal(normalizeTodoText("第一行\n第二行"), "第一行 第二行");
    assert.equal(normalizeTodoText("第一行\r\n第二行\r第三行"), "第一行 第二行 第三行");
    assert.equal(normalizeTodoText("a\u2028b\u2029c"), "a b c");
    assert.equal(normalizeTodoText("a  b   c"), "a  b   c");
    assert.equal(normalizeTodoText("a\n\nb"), "a  b");
    assert.equal(sanitizeTodoLineBreaks("  keep \n edges  "), "  keep   edges  ");
});

test("validateTodoText checks 0, whitespace-only, 1, 500, and 501 boundaries", () => {
    assert.equal(TODO_TEXT_MAX_LENGTH, 500);
    assert.deepEqual(validateTodoText(""), { ok: false, reason: "empty" });
    assert.deepEqual(validateTodoText("   \t\r\n  "), {
        ok: false,
        reason: "empty",
    });
    assert.deepEqual(validateTodoText("a"), { ok: true, text: "a" });
    assert.deepEqual(validateTodoText("  訂 3/15 晚餐餐廳  "), {
        ok: true,
        text: "訂 3/15 晚餐餐廳",
    });

    const exactly500 = "字".repeat(500);
    assert.deepEqual(validateTodoText(exactly500), {
        ok: true,
        text: exactly500,
    });
    assert.deepEqual(validateTodoText(`  ${exactly500}  `), {
        ok: true,
        text: exactly500,
    });

    const length501 = "字".repeat(501);
    assert.deepEqual(validateTodoText(length501), {
        ok: false,
        reason: "too_long",
    });
});

test("getTextCounter applies 400, 480, and 500 thresholds", () => {
    assert.equal(getTextCounter(0), null);
    assert.equal(getTextCounter(399), null);
    assert.deepEqual(getTextCounter(400), {
        label: "400 / 500",
        level: "normal",
    });
    assert.deepEqual(getTextCounter(479), {
        label: "479 / 500",
        level: "normal",
    });
    assert.deepEqual(getTextCounter(480), {
        label: "480 / 500",
        level: "warn",
    });
    assert.deepEqual(getTextCounter(499), {
        label: "499 / 500",
        level: "warn",
    });
    assert.deepEqual(getTextCounter(500), {
        label: "已達上限 500 / 500",
        level: "limit",
    });
});

test("getTodoErrorMessage and predicates map every code/action and never leak server messages", () => {
    const secretServerMessage = "SECRET_SERVER_STACK_TRACE_AND_PRIVATE_TODO_TEXT";

    const offlineErr = { code: "OFFLINE", message: secretServerMessage };
    assert.equal(getTodoErrorKind(offlineErr), "offline");
    assert.equal(isOfflineError(offlineErr), true);
    assert.equal(
        getTodoErrorMessage(offlineErr, "create"),
        "目前離線，無法修改待辦",
    );
    assert.equal(
        getTodoErrorMessage(offlineErr, "update"),
        "目前離線，無法修改待辦",
    );
    assert.equal(
        getTodoErrorMessage(offlineErr, "delete"),
        "目前離線，無法修改待辦",
    );

    const forbiddenErr = {
        code: "FORBIDDEN",
        status: 403,
        message: secretServerMessage,
    };
    assert.equal(getTodoErrorKind(forbiddenErr), "forbidden");
    assert.equal(isForbiddenError(forbiddenErr), true);
    assert.equal(
        getTodoErrorMessage(forbiddenErr, "load"),
        "你不是這個旅程的成員，無法查看待辦",
    );
    assert.equal(
        getTodoErrorMessage(forbiddenErr, "create"),
        "沒有權限修改這個待辦",
    );
    assert.equal(
        getTodoErrorMessage(forbiddenErr, "update"),
        "沒有權限修改這個待辦",
    );
    assert.equal(
        getTodoErrorMessage(forbiddenErr, "delete"),
        "沒有權限修改這個待辦",
    );

    const notFoundErr = {
        code: "NOT_FOUND",
        status: 404,
        message: secretServerMessage,
    };
    assert.equal(getTodoErrorKind(notFoundErr), "not_found");
    assert.equal(isNotFoundError(notFoundErr), true);
    assert.equal(
        getTodoErrorMessage(notFoundErr, "update"),
        "這個待辦已不存在",
    );
    assert.equal(
        getTodoErrorMessage(notFoundErr, "delete"),
        "這個待辦已不存在",
    );

    const layoutErr = {
        code: "INVALID_SHEET_LAYOUT",
        status: 422,
        message: secretServerMessage,
    };
    assert.equal(getTodoErrorKind(layoutErr), "invalid_sheet_layout");
    assert.equal(
        getTodoErrorMessage(layoutErr, "load"),
        "試算表格式有問題，請聯絡旅程管理員",
    );
    assert.equal(
        getTodoErrorMessage(layoutErr, "create"),
        "試算表格式有問題，請聯絡旅程管理員",
    );

    const unauthorizedErr = {
        code: "UNAUTHORIZED",
        status: 401,
        message: secretServerMessage,
    };
    assert.equal(getTodoErrorKind(unauthorizedErr), "unauthorized");
    assert.equal(
        getTodoErrorMessage(unauthorizedErr, "update"),
        "登入已過期，請重新登入",
    );

    // Status-only fallback when code is absent
    assert.equal(getTodoErrorKind({ status: 403 }), "forbidden");
    assert.equal(getTodoErrorKind({ status: 404 }), "not_found");
    assert.equal(getTodoErrorKind({ status: 422 }), "invalid_sheet_layout");
    assert.equal(getTodoErrorKind({ status: 401 }), "unauthorized");

    // Unknown / 500 / non-object errors
    const serverErr = new Error(secretServerMessage);
    assert.equal(getTodoErrorKind(serverErr), "unknown");
    assert.equal(getTodoErrorKind({ code: "INTERNAL_SERVER_ERROR", status: 500 }), "unknown");
    assert.equal(getTodoErrorKind(null), "unknown");
    assert.equal(getTodoErrorMessage(serverErr, "load"), "無法完成，請重試");
    assert.equal(getTodoErrorMessage(serverErr, "create"), "無法完成，請重試");
    assert.equal(getTodoErrorMessage(serverErr, "update"), "無法完成，請重試");
    assert.equal(getTodoErrorMessage(serverErr, "delete"), "無法完成，請重試");

    // Verify no mapping leaks server message text
    const samples = [
        offlineErr,
        forbiddenErr,
        notFoundErr,
        layoutErr,
        unauthorizedErr,
        serverErr,
        { code: "INTERNAL_SERVER_ERROR", status: 500, message: secretServerMessage },
    ];
    for (const err of samples) {
        for (const action of ["load", "create", "update", "delete"] as const) {
            const msg = getTodoErrorMessage(err, action);
            assert.equal(msg.includes(secretServerMessage), false);
        }
    }
});
