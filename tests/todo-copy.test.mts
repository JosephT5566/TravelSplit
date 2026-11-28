import assert from "node:assert/strict";
import { test } from "node:test";
import {
    buildCopyCandidates,
    buildCopyItems,
    buildMemberOptions,
    chunkCopyItems,
    classifyCopyError,
    groupCopyCandidatesByCategory,
    isInvalidParamsError,
    resolveCopyCategories,
    summarizeCopyResult,
    TODO_COPY_BATCH_SIZE,
    toggleGroupSelection,
} from "../src/utils/todoCopy.ts";

test("buildMemberOptions places current user first as 我, keeps others in key order, and falls back to email local part", () => {
    const users = {
        "bo@example.test": "小柏",
        "an@example.test": "小安",
        "mi@example.test": "小米",
        "empty-name@example.test": "   ",
        "   ": "忽略空白鍵",
        "": "忽略空鍵",
    };

    const options = buildMemberOptions(users, "an@example.test");

    assert.deepEqual(options, [
        {
            email: "an@example.test",
            label: "我",
            displayName: "小安",
            isMe: true,
        },
        {
            email: "bo@example.test",
            label: "小柏",
            displayName: "小柏",
            isMe: false,
        },
        {
            email: "mi@example.test",
            label: "小米",
            displayName: "小米",
            isMe: false,
        },
        {
            email: "empty-name@example.test",
            label: "empty-name",
            displayName: "empty-name",
            isMe: false,
        },
    ]);
});

test("buildMemberOptions still returns current user when users lacks currentEmail or is empty", () => {
    assert.deepEqual(
        buildMemberOptions({ "bo@example.test": "小柏" }, "an@example.test"),
        [
            {
                email: "an@example.test",
                label: "我",
                displayName: "an",
                isMe: true,
            },
            {
                email: "bo@example.test",
                label: "小柏",
                displayName: "小柏",
                isMe: false,
            },
        ],
    );

    assert.deepEqual(buildMemberOptions({}, "an@example.test"), [
        {
            email: "an@example.test",
            label: "我",
            displayName: "an",
            isMe: true,
        },
    ]);

    assert.deepEqual(buildMemberOptions(undefined, "an@example.test"), [
        {
            email: "an@example.test",
            label: "我",
            displayName: "an",
            isMe: true,
        },
    ]);
});

test("buildCopyCandidates sorts by createdAt stably and flags case-sensitive normalized duplicates", () => {
    const source = [
        { id: "t3", text: "換日幣", createdAt: "2026-11-27T03:00:00.000Z" },
        { id: "t1", text: "確認護照效期", createdAt: "2026-11-27T01:00:00.000Z" },
        { id: "t2a", text: "JR Pass", createdAt: "2026-11-27T02:00:00.000Z" },
        { id: "t2b", text: "jr pass", createdAt: "2026-11-27T02:00:00.000Z" },
        { id: "t2c", text: "預約\n租車", createdAt: "2026-11-27T02:00:00.000Z" },
    ];
    const myItems = [
        { text: "  確認護照效期  " },
        { text: "JR Pass" },
        { text: "預約 租車" },
    ];

    const candidates = buildCopyCandidates(source, myItems);

    assert.deepEqual(candidates, [
        {
            id: "t1",
            text: "確認護照效期",
            createdAt: "2026-11-27T01:00:00.000Z",
            sourceCategory: "",
            category: "",
            categoryMatchKind: "uncategorized",
            isDuplicate: true,
        },
        {
            id: "t2a",
            text: "JR Pass",
            createdAt: "2026-11-27T02:00:00.000Z",
            sourceCategory: "",
            category: "",
            categoryMatchKind: "uncategorized",
            isDuplicate: true,
        },
        {
            id: "t2b",
            text: "jr pass",
            createdAt: "2026-11-27T02:00:00.000Z",
            sourceCategory: "",
            category: "",
            categoryMatchKind: "uncategorized",
            isDuplicate: false,
        },
        {
            id: "t2c",
            text: "預約\n租車",
            createdAt: "2026-11-27T02:00:00.000Z",
            sourceCategory: "",
            category: "",
            categoryMatchKind: "uncategorized",
            isDuplicate: true,
        },
        {
            id: "t3",
            text: "換日幣",
            createdAt: "2026-11-27T03:00:00.000Z",
            sourceCategory: "",
            category: "",
            categoryMatchKind: "uncategorized",
            isDuplicate: false,
        },
    ]);

    // Original array is untouched
    assert.equal(source[0].id, "t3");

    // Undefined myItems flags nothing
    const withoutMine = buildCopyCandidates(source, undefined);
    assert.deepEqual(
        withoutMine.map((item) => ({ id: item.id, isDuplicate: item.isDuplicate })),
        [
            { id: "t1", isDuplicate: false },
            { id: "t2a", isDuplicate: false },
            { id: "t2b", isDuplicate: false },
            { id: "t2c", isDuplicate: false },
            { id: "t3", isDuplicate: false },
        ],
    );
});

test("buildCopyItems keeps only selected items in source order with checked=false and no extra fields", () => {
    const candidates = [
        { id: "a", text: "確認護照效期", ownerEmail: "bo@example.test", checked: true },
        { id: "b", text: "預約 3/14 租車", ownerEmail: "bo@example.test", checked: false },
        { id: "c", text: "買旅平險", ownerEmail: "bo@example.test", checked: true },
    ];

    const items = buildCopyItems(candidates, new Set(["c", "a"]));

    assert.deepEqual(items, [
        { text: "確認護照效期", checked: false },
        { text: "買旅平險", checked: false },
    ]);
    for (const item of items) {
        assert.deepEqual(Object.keys(item).sort(), ["checked", "text"]);
        assert.equal(item.checked, false);
    }

    assert.deepEqual(buildCopyItems(candidates, new Set()), []);
});

test("chunkCopyItems splits at default batch size 100 across boundary lengths", () => {
    assert.equal(TODO_COPY_BATCH_SIZE, 100);
    assert.deepEqual(chunkCopyItems([]), []);

    const makeItems = (count: number) =>
        Array.from({ length: count }, (_, idx) => idx + 1);

    assert.deepEqual(
        chunkCopyItems(makeItems(1)).map((chunk) => chunk.length),
        [1],
    );
    assert.deepEqual(
        chunkCopyItems(makeItems(99)).map((chunk) => chunk.length),
        [99],
    );
    assert.deepEqual(
        chunkCopyItems(makeItems(100)).map((chunk) => chunk.length),
        [100],
    );
    const chunks101 = chunkCopyItems(makeItems(101));
    assert.deepEqual(
        chunks101.map((chunk) => chunk.length),
        [100, 1],
    );
    assert.equal(chunks101[1][0], 101);

    const chunks250 = chunkCopyItems(makeItems(250));
    assert.deepEqual(
        chunks250.map((chunk) => chunk.length),
        [100, 100, 50],
    );
    assert.equal(chunks250[2][49], 250);

    assert.throws(() => chunkCopyItems([1], 0), RangeError);
    assert.throws(() => chunkCopyItems([1], -5), RangeError);
});

test("classifyCopyError and isInvalidParamsError distinguish definitely-not-sent from unconfirmed errors", () => {
    // Definitely not sent: OFFLINE and 4xx with explicit error code
    assert.equal(classifyCopyError({ code: "OFFLINE" }), "definitely-not-sent");
    assert.equal(
        classifyCopyError({ code: "FORBIDDEN", status: 403 }),
        "definitely-not-sent",
    );
    assert.equal(
        classifyCopyError({ code: "INVALID_PARAMS", status: 400 }),
        "definitely-not-sent",
    );
    assert.equal(
        classifyCopyError({ code: "INVALID_SHEET_LAYOUT", status: 422 }),
        "definitely-not-sent",
    );
    assert.equal(
        classifyCopyError({ code: "UNAUTHORIZED", status: 401 }),
        "definitely-not-sent",
    );

    // Unconfirmed: 5xx, 408 timeout, unreadable/invalid response, missing code, network/TypeError, null
    assert.equal(
        classifyCopyError({ code: "INTERNAL_SERVER_ERROR", status: 500 }),
        "unconfirmed",
    );
    assert.equal(
        classifyCopyError({ code: "BAD_GATEWAY", status: 502 }),
        "unconfirmed",
    );
    assert.equal(
        classifyCopyError({ code: "INVALID_RESPONSE", status: 200 }),
        "unconfirmed",
    );
    assert.equal(
        classifyCopyError({ code: "INVALID_RESPONSE", status: 400 }),
        "unconfirmed",
    );
    assert.equal(
        classifyCopyError({ code: "REQUEST_TIMEOUT", status: 408 }),
        "unconfirmed",
    );
    assert.equal(classifyCopyError({ status: 400 }), "unconfirmed");
    assert.equal(classifyCopyError(new TypeError("Failed to fetch")), "unconfirmed");
    assert.equal(classifyCopyError(null), "unconfirmed");

    // 400 INVALID_PARAMS helper
    assert.equal(isInvalidParamsError({ code: "INVALID_PARAMS", status: 400 }), true);
    assert.equal(isInvalidParamsError({ status: 400 }), true);
    assert.equal(isInvalidParamsError({ code: "FORBIDDEN", status: 403 }), false);
    assert.equal(isInvalidParamsError({ code: "INTERNAL_SERVER_ERROR", status: 500 }), false);
});

test("summarizeCopyResult formats success, partial, and failure messages without leaking details", () => {
    const secret = "PRIVATE_TODO_AND_STACK_TRACE";

    // Full success
    assert.deepEqual(summarizeCopyResult({ total: 5, copied: 5 }), {
        status: "success",
        message: "已複製 5 項到我的清單",
        remaining: 0,
    });

    // Partial failure (unconfirmed 500)
    const partial500 = summarizeCopyResult({
        total: 120,
        copied: 100,
        error: { code: "INTERNAL_SERVER_ERROR", status: 500, message: secret },
    });
    assert.equal(partial500.status, "partial");
    assert.equal(partial500.remaining, 20);
    assert.equal(partial500.classification, "unconfirmed");
    assert.ok(partial500.message.includes("已複製 100 / 120 項"));
    assert.ok(partial500.message.includes("20"));
    assert.ok(partial500.detail?.includes("請先到我的清單確認，再決定是否重試"));
    assert.equal(partial500.message.includes(secret), false);
    assert.equal(partial500.detail?.includes(secret), false);

    // Partial failure (definitely-not-sent offline)
    const partialOffline = summarizeCopyResult({
        total: 120,
        copied: 100,
        error: { code: "OFFLINE", message: secret },
    });
    assert.equal(partialOffline.status, "partial");
    assert.equal(partialOffline.classification, "definitely-not-sent");
    assert.ok(partialOffline.message.includes("已複製 100 / 120 項"));
    assert.ok(partialOffline.detail?.includes("目前離線"));

    // Full failure: 403 FORBIDDEN
    const fail403 = summarizeCopyResult({
        total: 3,
        copied: 0,
        error: { code: "FORBIDDEN", status: 403, message: secret },
    });
    assert.equal(fail403.status, "failed");
    assert.equal(fail403.classification, "definitely-not-sent");
    assert.ok(fail403.message.includes("沒有權限"));
    assert.equal(fail403.message.includes(secret), false);

    // Full failure: OFFLINE
    const failOffline = summarizeCopyResult({
        total: 3,
        copied: 0,
        error: { code: "OFFLINE" },
    });
    assert.equal(failOffline.status, "failed");
    assert.equal(failOffline.message, "目前離線，無法複製待辦");

    // Full failure: 500 / network (unconfirmed)
    const fail500 = summarizeCopyResult({
        total: 3,
        copied: 0,
        error: { code: "INTERNAL_SERVER_ERROR", status: 500, message: secret },
    });
    assert.equal(fail500.status, "failed");
    assert.equal(fail500.classification, "unconfirmed");
    assert.ok(fail500.message.includes("請先到我的清單確認，再決定是否重試"));
    assert.equal(fail500.message.includes(secret), false);

    // Full failure: 400 INVALID_PARAMS (definitely not sent)
    const fail400 = summarizeCopyResult({
        total: 3,
        copied: 0,
        error: { code: "INVALID_PARAMS", status: 400, message: secret },
    });
    assert.equal(fail400.status, "failed");
    assert.equal(fail400.classification, "definitely-not-sent");
    assert.equal(fail400.message, "無法複製待辦，請重試");
});

test("resolveCopyCategories snaps to my existing categories case-insensitively, truncates >30 code points, and keeps first batch spelling", () => {
    const longEmoji = "🍜".repeat(31);
    const longWithTrailingSpace = `${"a".repeat(29)} b`;

    const source = [
        { id: "1", createdAt: "2026-11-27T01:00:00.000Z", category: "行李" },
        { id: "2", createdAt: "2026-11-27T02:00:00.000Z", category: "  food\n " },
        { id: "3", createdAt: "2026-11-27T03:00:00.000Z", category: "Cafe" },
        { id: "4", createdAt: "2026-11-27T04:00:00.000Z", category: "cafe" },
        { id: "5", createdAt: "2026-11-27T05:00:00.000Z", category: longEmoji },
        { id: "6", createdAt: "2026-11-27T06:00:00.000Z", category: longWithTrailingSpace },
        { id: "7", createdAt: "2026-11-27T07:00:00.000Z", category: "未分類" },
        { id: "8", createdAt: "2026-11-27T08:00:00.000Z" },
    ];
    const myItems = [
        { createdAt: "2026-11-26T01:00:00.000Z", category: "行李" },
        { createdAt: "2026-11-26T02:00:00.000Z", category: "Food" },
    ];

    const resolved = resolveCopyCategories(source, myItems);

    assert.deepEqual(resolved.get("行李"), {
        sourceCategory: "行李",
        targetCategory: "行李",
        matchKind: "exact",
    });
    assert.deepEqual(resolved.get("food"), {
        sourceCategory: "food",
        targetCategory: "Food",
        matchKind: "merged",
    });
    assert.deepEqual(resolved.get("Cafe"), {
        sourceCategory: "Cafe",
        targetCategory: "Cafe",
        matchKind: "new",
    });
    assert.deepEqual(resolved.get("cafe"), {
        sourceCategory: "cafe",
        targetCategory: "Cafe",
        matchKind: "new",
    });
    assert.deepEqual(resolved.get(longEmoji), {
        sourceCategory: longEmoji,
        targetCategory: "🍜".repeat(30),
        matchKind: "new",
    });
    assert.deepEqual(resolved.get(longWithTrailingSpace), {
        sourceCategory: longWithTrailingSpace,
        targetCategory: "a".repeat(29),
        matchKind: "new",
    });
    assert.deepEqual(resolved.get(""), {
        sourceCategory: "",
        targetCategory: "",
        matchKind: "uncategorized",
    });

    // When myItems is undefined, matchKind is "unknown" (never falsely "new" or "merged").
    const withoutMine = resolveCopyCategories(source, undefined);
    assert.equal(withoutMine.get("行李")?.matchKind, "unknown");
    assert.equal(withoutMine.get("food")?.targetCategory, "food");
    assert.equal(withoutMine.get("cafe")?.targetCategory, "Cafe");
    assert.equal(withoutMine.get("")?.matchKind, "uncategorized");
});

test("buildCopyCandidates checks duplicates by text only (ignoring category) and buildCopyItems carries resolved categories in source order", () => {
    const source = [
        { id: "s3", text: "買伴手禮", createdAt: "2026-11-27T03:00:00.000Z", category: "交通" },
        { id: "s1", text: "護照", createdAt: "2026-11-27T01:00:00.000Z", category: "證件" },
        { id: "s2", text: "湯咖哩", createdAt: "2026-11-27T02:00:00.000Z", category: "food" },
        { id: "s4", text: "開 eSIM", createdAt: "2026-11-27T04:00:00.000Z" },
    ];
    const myItems = [
        // Same text as s1, but in a different category -> still duplicate!
        { text: "護照", category: "行李", createdAt: "2026-11-26T01:00:00.000Z" },
        // Different text in Food -> not duplicate, but food snaps to Food!
        { text: "拉麵", category: "Food", createdAt: "2026-11-26T02:00:00.000Z" },
    ];

    const candidates = buildCopyCandidates(source, myItems);
    assert.deepEqual(
        candidates.map((c) => ({
            id: c.id,
            sourceCategory: c.sourceCategory,
            category: c.category,
            categoryMatchKind: c.categoryMatchKind,
            isDuplicate: c.isDuplicate,
        })),
        [
            { id: "s1", sourceCategory: "證件", category: "證件", categoryMatchKind: "new", isDuplicate: true },
            { id: "s2", sourceCategory: "food", category: "Food", categoryMatchKind: "merged", isDuplicate: false },
            { id: "s3", sourceCategory: "交通", category: "交通", categoryMatchKind: "new", isDuplicate: false },
            { id: "s4", sourceCategory: "", category: "", categoryMatchKind: "uncategorized", isDuplicate: false },
        ],
    );

    // Payload preserves source creation order (s1, s2, s3, s4), always checked=false, omits category when empty.
    const payload = buildCopyItems(candidates, new Set(["s4", "s2", "s1", "s3"]));
    assert.deepEqual(payload, [
        { text: "護照", checked: false, category: "證件" },
        { text: "湯咖哩", checked: false, category: "Food" },
        { text: "買伴手禮", checked: false, category: "交通" },
        { text: "開 eSIM", checked: false },
    ]);
    assert.equal("category" in payload[3], false);

    // Direct call to buildCopyItems also truncates >30 code points and resolves first batch spelling.
    const directPayload = buildCopyItems(
        [
            { id: "a", text: "一", category: "Cafe" },
            { id: "b", text: "二", category: "cafe" },
            { id: "c", text: "三", category: "🚗".repeat(31) },
            { id: "d", text: "四", category: "未分類" },
        ],
        new Set(["a", "b", "c", "d"]),
    );
    assert.deepEqual(directPayload, [
        { text: "一", checked: false, category: "Cafe" },
        { text: "二", checked: false, category: "Cafe" },
        { text: "三", checked: false, category: "🚗".repeat(30) },
        { text: "四", checked: false },
    ]);
});

test("groupCopyCandidatesByCategory groups by source spelling in read-only order and hides header when all uncategorized", () => {
    const source = [
        { id: "u1", text: "未分類項目", createdAt: "2026-11-27T00:30:00.000Z" },
        { id: "f1", text: "湯咖哩", createdAt: "2026-11-27T02:00:00.000Z", category: "food" },
        { id: "d1", text: "護照", createdAt: "2026-11-27T01:00:00.000Z", category: "證件" },
        { id: "f2", text: "海鮮丼", createdAt: "2026-11-27T03:00:00.000Z", category: "food" },
    ];
    const myItems = [
        { text: "拉麵", category: "Food", createdAt: "2026-11-26T01:00:00.000Z" },
    ];

    const candidates = buildCopyCandidates(source, myItems);
    const groups = groupCopyCandidatesByCategory(candidates);

    assert.deepEqual(
        groups.map((g) => ({
            key: g.key,
            label: g.label,
            isUncategorized: g.isUncategorized,
            showHeader: g.showHeader,
            total: g.total,
            ids: g.items.map((item) => item.id),
        })),
        [
            { key: "證件", label: "證件", isUncategorized: false, showHeader: true, total: 1, ids: ["d1"] },
            { key: "food", label: "food", isUncategorized: false, showHeader: true, total: 2, ids: ["f1", "f2"] },
            { key: "", label: "未分類", isUncategorized: true, showHeader: true, total: 1, ids: ["u1"] },
        ],
    );

    const flatCandidates = buildCopyCandidates(
        [
            { id: "a", text: "一", createdAt: "2026-11-27T01:00:00.000Z" },
            { id: "b", text: "二", createdAt: "2026-11-27T02:00:00.000Z", category: "未分類" },
        ],
        [],
    );
    const flatGroups = groupCopyCandidatesByCategory(flatCandidates);
    assert.equal(flatGroups.length, 1);
    assert.equal(flatGroups[0].isUncategorized, true);
    assert.equal(flatGroups[0].showHeader, false);
});

test("toggleGroupSelection handles none, partial, and all selected without mutating input or affecting other groups", () => {
    const initial = new Set(["other-1"]);
    const groupIds = ["g-1", "g-2-dup", "g-3"];

    // None selected -> selects every item in group (including duplicates)
    const afterSelectAll = toggleGroupSelection(initial, groupIds);
    assert.notEqual(afterSelectAll, initial);
    assert.deepEqual([...initial], ["other-1"]);
    assert.deepEqual([...afterSelectAll].sort(), ["g-1", "g-2-dup", "g-3", "other-1"]);

    // Partial selection -> selects every item in group (including duplicates)
    const partial = new Set(["other-1", "g-1"]);
    const afterPartial = toggleGroupSelection(partial, groupIds);
    assert.deepEqual([...afterPartial].sort(), ["g-1", "g-2-dup", "g-3", "other-1"]);

    // All selected -> deselects only items in this group
    const afterDeselectAll = toggleGroupSelection(afterSelectAll, groupIds);
    assert.deepEqual([...afterDeselectAll], ["other-1"]);

    // Empty group -> unchanged copy
    const afterEmpty = toggleGroupSelection(initial, []);
    assert.deepEqual([...afterEmpty], ["other-1"]);
});

test("resolveCopyCategories does not merge into a truncated legacy >30-code-point category in my list", () => {
    const legacy = "a".repeat(35);
    const source = [
        { id: "s1", createdAt: "2026-11-27T01:00:00.000Z", category: "A".repeat(30) },
    ];
    const myItems = [
        { createdAt: "2026-11-26T01:00:00.000Z", category: legacy },
        { createdAt: "2026-11-26T02:00:00.000Z", category: "Food" },
    ];
    const resolved = resolveCopyCategories(source, myItems);
    assert.deepEqual(resolved.get("A".repeat(30)), {
        sourceCategory: "A".repeat(30),
        targetCategory: "A".repeat(30),
        matchKind: "new",
    });
});

test("resolveCopyCategories prefers exact spelling when my list has multiple case variants", () => {
    const source = [
        { id: "s1", createdAt: "2026-11-27T01:00:00.000Z", category: "Food" },
        { id: "s2", createdAt: "2026-11-27T02:00:00.000Z", category: "food" },
    ];
    const myItems = [
        { createdAt: "2026-11-26T01:00:00.000Z", category: "food" },
        { createdAt: "2026-11-26T02:00:00.000Z", category: "Food" },
    ];
    const resolved = resolveCopyCategories(source, myItems);
    assert.equal(resolved.get("Food")?.targetCategory, "Food");
    assert.equal(resolved.get("Food")?.matchKind, "exact");
    assert.equal(resolved.get("food")?.targetCategory, "food");
    assert.equal(resolved.get("food")?.matchKind, "exact");
});

test("buildCopyCandidates keeps a selected item's own new spelling; unselected siblings do not hijack it", () => {
    const source = [
        { id: "s1", text: "護照", createdAt: "2026-11-27T01:00:00.000Z", category: "Cafe" },
        { id: "s2", text: "找咖啡廳", createdAt: "2026-11-27T02:00:00.000Z", category: "cafe" },
    ];
    const candidates = buildCopyCandidates(source, []);
    assert.equal(candidates.find((c) => c.id === "s1")?.category, "Cafe");
    assert.equal(candidates.find((c) => c.id === "s2")?.category, "cafe");
    assert.equal(candidates.find((c) => c.id === "s2")?.categoryMatchKind, "new");

    const payload = buildCopyItems(candidates, new Set(["s2"]));
    assert.deepEqual(payload, [
        { text: "找咖啡廳", checked: false, category: "cafe" },
    ]);

    const both = buildCopyItems(candidates, new Set(["s1", "s2"]));
    assert.deepEqual(both.map((item) => item.category), ["Cafe", "Cafe"]);
});
