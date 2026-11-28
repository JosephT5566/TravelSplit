import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("components/Layout.tsx bottom navigation uses Traditional Chinese labels and aria-label", () => {
    const layoutSource = readFileSync(
        new URL("../components/Layout.tsx", import.meta.url),
        "utf8",
    )
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

    const navArrayMatch = layoutSource.match(
        /const\s+navigation\s*=\s*\[([\s\S]*?)\];/,
    );
    assert.ok(navArrayMatch, "Expected navigation array literal in Layout.tsx");

    const items = Array.from(
        navArrayMatch[1].matchAll(
            /\{\s*href:\s*["']([^"']+)["']\s*,\s*label:\s*["']([^"']+)["']\s*,\s*Icon:\s*([A-Za-z0-9_]+)\s*,?\s*\}/g,
        ),
        (match) => ({
            href: match[1],
            label: match[2],
            icon: match[3],
        }),
    );

    assert.deepEqual(items, [
        { href: "/", label: "支出", icon: "List" },
        { href: "/summary", label: "統計", icon: "PieChart" },
        { href: "/todos", label: "待辦", icon: "ListChecks" },
        { href: "/plan", label: "行程", icon: "NotebookPen" },
    ]);

    assert.match(layoutSource, /<nav[\s\S]*?aria-label="主要導覽"/);
    assert.equal(layoutSource.includes("Main navigation"), false);
});
