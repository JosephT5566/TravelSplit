import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("public/sw.js shellUrls precaches todos.html alongside core shell routes", () => {
    const swSource = readFileSync(
        new URL("../public/sw.js", import.meta.url),
        "utf8",
    );
    const match = swSource.match(/const\s+shellUrls\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(match, "Expected shellUrls array literal in public/sw.js");

    const entries = Array.from(
        match[1].matchAll(/["']([^"']*)["']/g),
        (entry) => entry[1],
    );

    assert.ok(entries.includes("index.html"), "Expected index.html in shellUrls");
    assert.ok(
        entries.includes("summary.html"),
        "Expected summary.html in shellUrls",
    );
    assert.ok(entries.includes("todos.html"), "Expected todos.html in shellUrls");
    assert.ok(entries.includes("plan.html"), "Expected plan.html in shellUrls");
});
