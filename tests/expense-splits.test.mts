import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateExpenseSplit } from "../src/utils/expenseSplits.ts";

function specificSplit(amount: string, amounts: Record<string, string>) {
    return evaluateExpenseSplit({
        amount,
        exchangeRate: 1,
        method: { kind: "specific", amounts },
    });
}

test("specified decimal shares add up exactly before conversion", () => {
    assert.deepEqual(specificSplit("0.30", { a: "0.10", b: "0.20", c: "" }), {
        kind: "valid",
        summary: "0.30",
        splits: { a: 0.1, b: 0.2 },
    });
});

test("specified shares report real differences across decimal precisions", () => {
    assert.deepEqual(specificSplit("0.30", { a: "0.10", b: "0.19" }), {
        kind: "mismatch",
        summary: "0.29",
        direction: "under",
        difference: "0.01",
    });
    assert.deepEqual(specificSplit("0.30", { a: "0.10", b: "0.21" }), {
        kind: "mismatch",
        summary: "0.31",
        direction: "over",
        difference: "0.01",
    });
    assert.deepEqual(specificSplit("3e-1", { a: "0.10", b: "0.201" }), {
        kind: "mismatch",
        summary: "0.301",
        direction: "over",
        difference: "0.001",
    });
});

test("equal splitting requires a participant and succeeds corrected", () => {
    const expense = { amount: "0.30", exchangeRate: 1 };
    assert.deepEqual(
        evaluateExpenseSplit({
            ...expense,
            method: { kind: "equally", participants: [] },
        }),
        { kind: "no-participants", summary: null },
    );
    assert.deepEqual(
        evaluateExpenseSplit({
            ...expense,
            method: { kind: "equally", participants: ["b"] },
        }),
        { kind: "valid", summary: null, splits: { b: 0.3 } },
    );
});

test("switching away from an overallocated specified split allows equal splitting", () => {
    const expense = { amount: "0.31", exchangeRate: 1 };
    const amounts = { a: "0.30", b: "0.20" };
    assert.equal(specificSplit(expense.amount, amounts).kind, "mismatch");
    assert.deepEqual(
        evaluateExpenseSplit({
            ...expense,
            method: { kind: "equally", participants: ["a", "b"] },
        }),
        { kind: "valid", summary: null, splits: { a: 0.16, b: 0.15 } },
    );
});

test("a single beneficiary receives the full amount at the existing conversion precision", () => {
    assert.deepEqual(
        evaluateExpenseSplit({
            amount: "10.51",
            exchangeRate: 0.317,
            method: { kind: "single", email: "companion@example.test" },
        }),
        { kind: "valid", summary: null, splits: { "companion@example.test": 3.332 } },
    );
});
