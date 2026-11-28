import assert from "node:assert/strict";
import { test } from "node:test";
import {
    countUnicodeCodePoints,
    getCategoryCounter,
    getCompletionStats,
    getTextCounter,
    getTodoCategories,
    getTodoErrorKind,
    getTodoErrorMessage,
    groupTodosByCategory,
    isForbiddenError,
    isNotFoundError,
    isOfflineError,
    normalizeTodoCategory,
    normalizeTodoText,
    sanitizeTodoLineBreaks,
    snapToExistingCategory,
    sortTodos,
    TODO_CATEGORY_MAX_LENGTH,
    TODO_TEXT_MAX_LENGTH,
    truncateUnicodeCodePoints,
    UNCATEGORIZED_LABEL,
    validateTodoCategory,
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

test("normalizeTodoCategory handles empty, whitespace, line breaks, 未分類, case preservation, and overlong legacy values", () => {
    assert.equal(TODO_CATEGORY_MAX_LENGTH, 30);
    assert.equal(UNCATEGORIZED_LABEL, "未分類");

    assert.equal(normalizeTodoCategory(undefined), "");
    assert.equal(normalizeTodoCategory(null), "");
    assert.equal(normalizeTodoCategory(""), "");
    assert.equal(normalizeTodoCategory("   \t\r\n  "), "");
    assert.equal(normalizeTodoCategory("未分類"), "");
    assert.equal(normalizeTodoCategory("  未分類  "), "");
    assert.equal(normalizeTodoCategory("\n未分類\r\n"), "");

    assert.equal(normalizeTodoCategory("  行李  "), "行李");
    assert.equal(normalizeTodoCategory("第一\n第二\r\n第三\r第四"), "第一 第二 第三 第四");
    assert.equal(normalizeTodoCategory("a\u2028b\u2029c"), "a b c");
    assert.equal(normalizeTodoCategory("a  b   c"), "a  b   c");
    assert.equal(normalizeTodoCategory("Food"), "Food");
    assert.equal(normalizeTodoCategory("food"), "food");

    // Display normalization never truncates overlong legacy values.
    const overlong = "長".repeat(35);
    assert.equal(normalizeTodoCategory(`  ${overlong}\n`), overlong);
});

test("validateTodoCategory and code-point helpers enforce 30 Unicode code points including emoji/surrogates", () => {
    assert.equal(countUnicodeCodePoints("行李"), 2);
    assert.equal(countUnicodeCodePoints("😀".repeat(30)), 30);
    assert.equal("😀".repeat(30).length, 60);
    assert.equal(truncateUnicodeCodePoints("😀".repeat(31), 30), "😀".repeat(30));
    assert.equal(truncateUnicodeCodePoints("行李", 0), "");

    assert.deepEqual(validateTodoCategory(undefined), { ok: true, category: "" });
    assert.deepEqual(validateTodoCategory(""), { ok: true, category: "" });
    assert.deepEqual(validateTodoCategory("   "), { ok: true, category: "" });
    assert.deepEqual(validateTodoCategory("未分類"), { ok: true, category: "" });

    const exact30Cjk = "字".repeat(30);
    assert.deepEqual(validateTodoCategory(`  ${exact30Cjk}  `), {
        ok: true,
        category: exact30Cjk,
    });
    assert.deepEqual(validateTodoCategory("字".repeat(31)), {
        ok: false,
        reason: "too_long",
    });

    const exact30Emoji = "🎒".repeat(30);
    assert.deepEqual(validateTodoCategory(exact30Emoji), {
        ok: true,
        category: exact30Emoji,
    });
    assert.deepEqual(validateTodoCategory("🎒".repeat(31)), {
        ok: false,
        reason: "too_long",
    });
});

test("getCategoryCounter applies 24, 28, and 30 thresholds", () => {
    assert.equal(getCategoryCounter(0), null);
    assert.equal(getCategoryCounter(23), null);
    assert.deepEqual(getCategoryCounter(24), {
        label: "24 / 30",
        level: "normal",
    });
    assert.deepEqual(getCategoryCounter(27), {
        label: "27 / 30",
        level: "normal",
    });
    assert.deepEqual(getCategoryCounter(28), {
        label: "28 / 30",
        level: "warn",
    });
    assert.deepEqual(getCategoryCounter(29), {
        label: "29 / 30",
        level: "warn",
    });
    assert.deepEqual(getCategoryCounter(30), {
        label: "已達上限 30 / 30",
        level: "limit",
    });
});

test("snapToExistingCategory matches case-insensitively after normalization without merging synonyms", () => {
    const existing = ["行李", "Food", "JR Pass"];

    assert.equal(snapToExistingCategory("food", existing), "Food");
    assert.equal(snapToExistingCategory("  FOOD\n ", existing), "Food");
    assert.equal(snapToExistingCategory("jr pass", existing), "JR Pass");
    assert.equal(snapToExistingCategory("行李", existing), "行李");
    assert.equal(snapToExistingCategory("行李箱", existing), "行李箱");
    assert.equal(snapToExistingCategory("交通", existing), "交通");
    assert.equal(snapToExistingCategory("未分類", existing), "");
    assert.equal(snapToExistingCategory("   ", existing), "");
    assert.equal(snapToExistingCategory(undefined, existing), "");
});

test("getTodoCategories returns unique non-empty categories in earliest-item group order", () => {
    const items = [
        { createdAt: "2026-11-27T01:00:00.000Z" },
        { createdAt: "2026-11-27T04:00:00.000Z", category: "購物" },
        { createdAt: "2026-11-27T02:00:00.000Z", category: "行李" },
        { createdAt: "2026-11-27T03:00:00.000Z", category: "  證件\n" },
        { createdAt: "2026-11-27T05:00:00.000Z", category: "行李" },
        { createdAt: "2026-11-27T06:00:00.000Z", category: "未分類" },
    ];

    assert.deepEqual(getTodoCategories(items), ["行李", "證件", "購物"]);
});

test("groupTodosByCategory hides header when all items are uncategorized, including legacy items without category", () => {
    assert.deepEqual(groupTodosByCategory([]), []);

    const uncategorizedOnly = [
        { id: "u2", createdAt: "2026-11-27T02:00:00.000Z", checked: true, category: "" },
        { id: "u1", createdAt: "2026-11-27T01:00:00.000Z", checked: false },
        { id: "u3", createdAt: "2026-11-27T03:00:00.000Z", checked: false, category: "未分類" },
        { id: "u4", createdAt: "2026-11-27T04:00:00.000Z", checked: true, category: "   " },
    ];

    const groups = groupTodosByCategory(uncategorizedOnly);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].key, "");
    assert.equal(groups[0].label, "未分類");
    assert.equal(groups[0].isUncategorized, true);
    assert.equal(groups[0].showHeader, false);
    assert.equal(groups[0].completed, 2);
    assert.equal(groups[0].total, 4);
    assert.deepEqual(
        groups[0].items.map((item) => item.id),
        ["u1", "u2", "u3", "u4"],
    );
});

test("groupTodosByCategory orders groups by earliest createdAt, keeps 未分類 last, preserves intra-group order, and computes per-group stats", () => {
    const items = [
        // Oldest item overall is uncategorized, yet 未分類 must stay last.
        { id: "none-1", createdAt: "2026-11-27T00:30:00.000Z", checked: false },
        { id: "shop-2", createdAt: "2026-11-27T05:00:00.000Z", checked: false, category: "購物" },
        { id: "docs-1", createdAt: "2026-11-27T02:00:00.000Z", checked: true, category: "證件" },
        { id: "luggage-2", createdAt: "2026-11-27T04:00:00.000Z", checked: false, category: "行李" },
        { id: "luggage-1", createdAt: "2026-11-27T01:00:00.000Z", checked: true, category: "  行李  " },
        { id: "shop-1", createdAt: "2026-11-27T03:00:00.000Z", checked: true, category: "購物" },
        { id: "docs-2", createdAt: "2026-11-27T02:30:00.000Z", checked: true, category: "證件" },
        { id: "none-2", createdAt: "2026-11-27T06:00:00.000Z", checked: true, category: "未分類" },
    ];
    const snapshot = items.map((item) => ({ ...item }));

    const groups = groupTodosByCategory(items);

    assert.deepEqual(items, snapshot);
    assert.deepEqual(
        groups.map((g) => ({
            key: g.key,
            label: g.label,
            isUncategorized: g.isUncategorized,
            showHeader: g.showHeader,
            completed: g.completed,
            total: g.total,
            ids: g.items.map((item) => item.id),
        })),
        [
            {
                key: "行李",
                label: "行李",
                isUncategorized: false,
                showHeader: true,
                completed: 1,
                total: 2,
                ids: ["luggage-1", "luggage-2"],
            },
            {
                key: "證件",
                label: "證件",
                isUncategorized: false,
                showHeader: true,
                completed: 2,
                total: 2,
                ids: ["docs-1", "docs-2"],
            },
            {
                key: "購物",
                label: "購物",
                isUncategorized: false,
                showHeader: true,
                completed: 1,
                total: 2,
                ids: ["shop-1", "shop-2"],
            },
            {
                key: "",
                label: "未分類",
                isUncategorized: true,
                showHeader: true,
                completed: 1,
                total: 2,
                ids: ["none-1", "none-2"],
            },
        ],
    );

    // Toggling checked never alters group order or intra-group item order.
    const toggled = items.map((item) =>
        item.id === "luggage-1" ? { ...item, checked: false } : item,
    );
    const toggledGroups = groupTodosByCategory(toggled);
    assert.deepEqual(
        toggledGroups.map((g) => g.key),
        ["行李", "證件", "購物", ""],
    );
    assert.deepEqual(
        toggledGroups[0].items.map((item) => item.id),
        ["luggage-1", "luggage-2"],
    );
    assert.equal(toggledGroups[0].completed, 0);

    // Single categorized group still shows its header.
    const singleCategorized = groupTodosByCategory([
        { id: "only-1", createdAt: "2026-11-27T01:00:00.000Z", checked: false, category: "行李" },
    ]);
    assert.equal(singleCategorized.length, 1);
    assert.equal(singleCategorized[0].showHeader, true);

    // Tied timestamps preserve input order for groups.
    const tiedGroups = groupTodosByCategory([
        { id: "b1", createdAt: "2026-11-27T01:00:00.000Z", checked: false, category: "Beta" },
        { id: "a1", createdAt: "2026-11-27T01:00:00.000Z", checked: false, category: "Alpha" },
    ]);
    assert.deepEqual(
        tiedGroups.map((g) => g.key),
        ["Beta", "Alpha"],
    );
});

test("snapToExistingCategory prefers an exact match over an earlier case variant", () => {
    const existing = ["food", "Food", "FOOD"];
    assert.equal(snapToExistingCategory("Food", existing), "Food");
    assert.equal(snapToExistingCategory("food", existing), "food");
    assert.equal(snapToExistingCategory("FOOD", existing), "FOOD");
    assert.equal(snapToExistingCategory("FoOd", existing), "food");
});

test("getTodoCategories omits legacy categories longer than 30 code points", () => {
    const long = "🎒".repeat(31);
    const items = [
        { createdAt: "2026-11-27T01:00:00.000Z", category: long },
        { createdAt: "2026-11-27T02:00:00.000Z", category: "行李" },
        { createdAt: "2026-11-27T03:00:00.000Z", category: "a".repeat(30) },
    ];
    assert.deepEqual(getTodoCategories(items), ["行李", "a".repeat(30)]);
});
