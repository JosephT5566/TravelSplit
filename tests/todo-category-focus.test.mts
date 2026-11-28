import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isTodoCategoryRegionVisible } from "../src/utils/todoList.ts";

const visible = (focusWithin: boolean, textDraft: string, hasCategoryError: boolean) =>
    isTodoCategoryRegionVisible({ focusWithin, textDraft, hasCategoryError });

test("category block is hidden when idle: no focus, empty or blank draft, no error", () => {
    assert.equal(visible(false, "", false), false);
    assert.equal(visible(false, "   ", false), false);
});

test("category block shows for focus-within, a non-blank text draft, or a category error", () => {
    assert.equal(visible(true, "", false), true);
    assert.equal(visible(false, "牙刷", false), true);
    assert.equal(visible(false, "", true), true);
    assert.equal(visible(true, "牙刷", true), true);
});

test("TodoAddRow wires the collapsible region to the form focus, outside pointerdown and Escape", () => {
    const source = read("components/todos/TodoAddRow.tsx");
    assert.match(source, /isTodoCategoryRegionVisible\(/);
    assert.match(source, /aria-controls=\{categoryRegionId\}/);
    // form-level focus tracking, not input-only blur
    assert.match(source, /onFocus=\{\(\) => setIsEngaged\(true\)\}/);
    assert.match(source, /onPointerDown=\{\(\) => setIsEngaged\(true\)\}/);
    assert.match(source, /document\.addEventListener\("pointerdown"/);
    assert.equal(/onBlur=\{[^}]*setIsEngaged\(false\)/.test(source), true);
    // collapsed controls are out of the tab order
    assert.match(source, /setAttribute\("inert", ""\)/);
    assert.match(source, /ref=\{setCategoryRegionNode\}/);
    assert.match(source, /"grid-rows-\[0fr\] opacity-0"/);
    // reduced motion
    assert.match(source, /motion-reduce:transition-none/);
    // blur with no related target must never collapse (iOS taps don't focus buttons)
    assert.match(source, /next instanceof Node && !event\.currentTarget\.contains\(next\)/);
});

function read(path: string) {
    return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
