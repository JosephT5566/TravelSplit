import type { Expense, SheetConfig } from "../types";

export function calculateSettlements({
    expenses,
    currentUserEmail,
    users,
}: {
    expenses: readonly Pick<Expense, "payer" | "splitsJson">[];
    currentUserEmail: string;
    users: SheetConfig["users"];
}) {
    const emailByName = new Map(
        Object.entries(users).map(([email, name]) => [name, email]),
    );
    const balances = new Map(
        Object.keys(users)
            .filter((email) => email !== currentUserEmail)
            .map((email) => [email, 0]),
    );

    for (const { payer, splitsJson } of expenses) {
        const payerEmail = emailByName.get(payer);
        if (!payerEmail || !splitsJson) {
            continue;
        }

        if (payerEmail === currentUserEmail) {
            for (const [email, share] of Object.entries(splitsJson)) {
                const balance = balances.get(email);
                if (balance !== undefined) {
                    balances.set(email, balance + share);
                }
            }
        } else {
            // A participant owes their own share to the payer.
            const balance = balances.get(payerEmail) ?? 0;
            balances.set(payerEmail, balance - (splitsJson[currentUserEmail] ?? 0));
        }
    }

    return Array.from(balances, ([email, total]) => ({
        email,
        // Round the net amount once, at the precision shown in the summary.
        balance: Number(total.toFixed(2)),
    })).filter(({ balance }) => balance !== 0);
}
