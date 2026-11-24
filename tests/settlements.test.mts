import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateSettlements } from "../src/utils/settlements.ts";

const users = { a: "A", b: "B", c: "C" };
const aPaid = { payer: "A", splitsJson: { a: 50, b: 50 } };
const bPaid = { payer: "B", splitsJson: { a: 50, b: 50 } };

test("payer and participant see opposite signs for the same debt", () => {
    assert.deepEqual(calculateSettlements({ expenses: [aPaid], currentUserEmail: "a", users }), [
        { email: "b", balance: 50 },
    ]);
    assert.deepEqual(calculateSettlements({ expenses: [aPaid], currentUserEmail: "b", users }), [
        { email: "a", balance: -50 },
    ]);
    assert.deepEqual(calculateSettlements({ expenses: [bPaid], currentUserEmail: "a", users }), [
        { email: "b", balance: -50 },
    ]);
    assert.deepEqual(calculateSettlements({ expenses: [bPaid], currentUserEmail: "b", users }), [
        { email: "a", balance: 50 },
    ]);
});

test("equal expenses paid by opposite users cancel for both", () => {
    for (const currentUserEmail of ["a", "b"]) {
        assert.deepEqual(calculateSettlements({ expenses: [aPaid, bPaid], currentUserEmail, users }), []);
    }
});

test("an unrelated expense does not change existing balances", () => {
    const unrelated = { payer: "B", splitsJson: { b: 50, c: 50 } };
    assert.deepEqual(calculateSettlements({ expenses: [aPaid, unrelated], currentUserEmail: "a", users }), [
        { email: "b", balance: 50 },
    ]);
});

test("a payer can cover other members without taking a share", () => {
    const expense = { payer: "A", splitsJson: { b: 50, c: 50 } };
    assert.deepEqual(calculateSettlements({ expenses: [expense], currentUserEmail: "a", users }), [
        { email: "b", balance: 50 },
        { email: "c", balance: 50 },
    ]);
});

test("a participant owes only their share, and only to the payer", () => {
    const expense = { payer: "B", splitsJson: { a: 30, b: 20, c: 50 } };
    assert.deepEqual(calculateSettlements({ expenses: [expense], currentUserEmail: "a", users }), [
        { email: "b", balance: -30 },
    ]);
});

test("rounding the net avoids a zero amount with a payment direction", () => {
    const expenses = [
        { payer: "A", splitsJson: { b: 0.1 } },
        { payer: "A", splitsJson: { b: 0.2 } },
        { payer: "B", splitsJson: { a: 0.3 } },
    ];
    assert.deepEqual(calculateSettlements({ expenses, currentUserEmail: "a", users }), []);
});

test("older rows with an unknown payer or participant are safe to read", () => {
    const unknownPayer = { payer: "Former Member", splitsJson: { a: 90, b: 10 } };
    const unknownParticipant = { payer: "A", splitsJson: { b: 50, former: 50 } };
    assert.deepEqual(calculateSettlements({
        expenses: [unknownPayer, unknownParticipant],
        currentUserEmail: "a",
        users,
    }), [{ email: "b", balance: 50 }]);
});
