import assert from "node:assert/strict";
import { test } from "node:test";
import {
    buildCopyCandidates,
    buildCopyItems,
    buildMemberOptions,
    chunkCopyItems,
    classifyCopyError,
    isInvalidParamsError,
    summarizeCopyResult,
    TODO_COPY_BATCH_SIZE,
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
        { id: "t1", text: "確認護照效期", isDuplicate: true },
        { id: "t2a", text: "JR Pass", isDuplicate: true },
        { id: "t2b", text: "jr pass", isDuplicate: false },
        { id: "t2c", text: "預約\n租車", isDuplicate: true },
        { id: "t3", text: "換日幣", isDuplicate: false },
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
