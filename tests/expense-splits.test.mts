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

test("a single beneficiary receives the full amount at the common conversion precision", () => {
    assert.deepEqual(
        evaluateExpenseSplit({
            amount: "10.51",
            exchangeRate: 0.317,
            method: { kind: "single", email: "companion@example.test" },
        }),
        { kind: "valid", summary: null, splits: { "companion@example.test": 3.33 } },
    );
});

test("all split modes round the same half-cent total once", () => {
    const expense = { amount: "3", exchangeRate: 0.215 };
    assert.deepEqual(
        evaluateExpenseSplit({ ...expense, method: { kind: "single", email: "a" } }),
        { kind: "valid", summary: null, splits: { a: 0.65 } },
    );
    const splits = { a: 0.22, b: 0.22, c: 0.21 };
    assert.deepEqual(
        evaluateExpenseSplit({
            ...expense,
            method: { kind: "equally", participants: ["c", "b", "a"] },
        }),
        { kind: "valid", summary: null, splits },
    );
    assert.deepEqual(
        evaluateExpenseSplit({
            ...expense,
            method: { kind: "specific", amounts: { b: "1", a: "1", c: "1" } },
        }),
        { kind: "valid", summary: "3.00", splits },
    );
});

test("specified shares receive leftover cents in fractional remainder order", () => {
    assert.deepEqual(
        evaluateExpenseSplit({
            amount: "10",
            exchangeRate: 0.003,
            method: { kind: "specific", amounts: { a: "1", b: "5", c: "4" } },
        }),
        { kind: "valid", summary: "10.00", splits: { a: 0, b: 0.02, c: 0.01 } },
    );
});

test("an equal split keeps all selected members when only one cent is available", () => {
    assert.deepEqual(
        evaluateExpenseSplit({
            amount: "0.01",
            exchangeRate: 1,
            method: { kind: "equally", participants: ["c", "a", "b"] },
        }),
        { kind: "valid", summary: null, splits: { a: 0.01, b: 0, c: 0 } },
    );
});

test("invalid rates and duplicate participants cannot produce a valid split", () => {
    for (const exchangeRate of [0, -1, Infinity, NaN]) {
        assert.equal(evaluateExpenseSplit({
            amount: "1",
            exchangeRate,
            method: { kind: "equally", participants: ["a", "b"] },
        }).kind, "invalid-splits");
    }
    assert.equal(evaluateExpenseSplit({
        amount: "1",
        exchangeRate: 1,
        method: { kind: "equally", participants: ["a", "a"] },
    }).kind, "invalid-splits");
});
