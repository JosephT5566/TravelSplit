import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { shouldShowTodoRefresh } from "../src/utils/todoList.ts";

const base = {
    hasData: false,
    isError: false,
    error: null as unknown,
    isOfflineNoCache: false,
    isInitialLoading: false,
};
const read = (path: string) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shouldShowTodoRefresh is true whenever data exists, including an empty list and a failed refetch", () => {
    assert.equal(shouldShowTodoRefresh({ ...base, hasData: true }), true);
    assert.equal(
        shouldShowTodoRefresh({
            ...base,
            hasData: true,
            isError: true,
            error: new Error("boom"),
        }),
        true,
    );
});

test("shouldShowTodoRefresh is false for first load, offline-without-cache, and the 403 non-member screen", () => {
    assert.equal(shouldShowTodoRefresh({ ...base, isInitialLoading: true }), false);
    assert.equal(shouldShowTodoRefresh({ ...base, isOfflineNoCache: true }), false);
    assert.equal(
        shouldShowTodoRefresh({
            ...base,
            isError: true,
            error: { code: "FORBIDDEN", status: 403 },
        }),
        false,
    );
});

test("shouldShowTodoRefresh stays available on a non-403 load error without data", () => {
    assert.equal(
        shouldShowTodoRefresh({ ...base, isError: true, error: new Error("x") }),
        true,
    );
});

test("TodoRefreshButton is icon-only, labelled, and keeps focus while busy", () => {
    const source = read("components/todos/TodoRefreshButton.tsx");
    assert.match(source, /aria-label="重新整理"/);
    assert.match(source, /size-11/);
    assert.match(source, /aria-disabled=/);
    assert.match(source, /animate-spin motion-reduce:animate-none/);
    assert.equal(/\sdisabled=\{/.test(source), false);
});

test("TodoList renders the refresh button before the export button and refetches only the viewed list", () => {
    const source = read("components/todos/TodoList.tsx");
    const refreshAt = source.indexOf("<TodoRefreshButton");
    const exportAt = source.indexOf("<TodoExportButton");
    assert.ok(refreshAt > 0 && exportAt > refreshAt);
    assert.match(source, /const \{ flushNow, refetch \} = todoView;/);
    assert.match(source, /isCancelledError/);
    assert.equal(source.includes("invalidateQueries"), false);
});
