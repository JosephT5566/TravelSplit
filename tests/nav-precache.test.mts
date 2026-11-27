import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("public/sw.js shellUrls precaches todos.html alongside the existing shell pages", () => {
    const swSource = readFileSync(
        new URL("../public/sw.js", import.meta.url),
        "utf8",
    )
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const match = swSource.match(/const\s+shellUrls\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(match, "Expected shellUrls array literal in public/sw.js");

    const entries = Array.from(
        match[1].matchAll(/["']([^"']*)["']/g),
        (entry) => entry[1],
    );

    assert.deepEqual(entries, [
        "",
        "index.html",
        "summary.html",
        "todos.html",
        "plan.html",
        "2026-shimanami.html",
        "select-sheet.html",
        "offline.html",
    ]);
});
