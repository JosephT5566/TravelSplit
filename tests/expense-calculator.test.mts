import assert from "node:assert/strict";
import test from "node:test";
import { calculateExpenseAmount } from "../src/utils/expenseCalculator.ts";

test("expense calculator respects precedence and left-to-right evaluation", () => {
    assert.deepEqual(calculateExpenseAmount("450+120×2"), { kind: "amount", amount: "690" });
    assert.deepEqual(calculateExpenseAmount("10−2×3+1"), { kind: "amount", amount: "5" });
    assert.deepEqual(calculateExpenseAmount("24÷3×2"), { kind: "amount", amount: "16" });
});

test("expense calculator preserves exact decimals and rounds repeating results", () => {
    assert.deepEqual(calculateExpenseAmount("0.1+0.2"), { kind: "amount", amount: "0.3" });
    assert.deepEqual(calculateExpenseAmount("1÷8"), { kind: "amount", amount: "0.125" });
    assert.deepEqual(calculateExpenseAmount("2÷3"), { kind: "amount", amount: "0.67" });
    assert.deepEqual(calculateExpenseAmount("1÷3×3"), { kind: "amount", amount: "1" });
    assert.deepEqual(calculateExpenseAmount("1e+3+.25"), { kind: "amount", amount: "1000.25" });
});

test("expense calculator rejects results that cannot be applied", () => {
    assert.deepEqual(calculateExpenseAmount(""), { kind: "empty" });
    assert.deepEqual(calculateExpenseAmount("1+"), { kind: "incomplete" });
    assert.deepEqual(calculateExpenseAmount("1.2.3"), { kind: "incomplete" });
    assert.deepEqual(calculateExpenseAmount("1÷0"), { kind: "divide-by-zero" });
    assert.deepEqual(calculateExpenseAmount("1−2"), { kind: "invalid-amount" });
    assert.deepEqual(calculateExpenseAmount("1÷300"), { kind: "invalid-amount" });
    assert.deepEqual(calculateExpenseAmount("1e+308×9"), { kind: "invalid-amount" });
});
