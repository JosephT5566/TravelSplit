import {
    Expense,
    ExpensesResponse,
    isSuccess,
    TransactionType,
} from "../src/types";

export const getMockExpenses = (): Expense[] => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    return [
        {
            timestamp: new Date().toISOString(),
            date: fmt(today),
            category: "Food",
            itemName: "Welcome Dinner (Sushi)",
            amount: 12000,
            currency: "JPY",
            payer: "demo@tripsplit.app",
            // settled: false,
            splitsJson: "",
        },
        {
            timestamp: new Date().toISOString(),
            date: fmt(today),
            category: "Transport",
            itemName: "Airport Express",
            amount: 500,
            currency: "TWD",
            payer: "demo@tripsplit.app",
            // settled: true,
            splitsJson: "",
        },
        {
            timestamp: new Date().toISOString(),
            date: fmt(today),
            category: "Shopping",
            itemName: "Uniqlo Haul",
            amount: 3500,
            currency: "TWD",
            payer: "demo@tripsplit.app",
            // settled: false,
            splitsJson: "",
        },
        {
            timestamp: new Date().toISOString(),
            date: fmt(today),
            category: "Others",
            itemName: "Refund for Shared Taxi",
            amount: 200,
            currency: "TWD",
            payer: "friend@test.com",
            // settled: true,
            splitsJson: "",
        },
    ];
};

export const api = {
    async getExpenses(userEmail: string): Promise<Expense[]> {
        const gasUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL;
        if (!gasUrl) {
            throw new Error("Missing NEXT_PUBLIC_APP_SCRIPT_URL env variable.");
        }

        const response = await fetch(gasUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "getExpenses",
                payload: { email: userEmail },
            }),
            headers: {
                "Content-Type": "application/json",
            },
            redirect: "follow",
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result: ExpensesResponse = await response.json();

        if (isSuccess(result)) {
            return result.result;
        } else {
            throw new Error(result.error || "Unknown error from server");
        }
    },

    async syncTransaction(
        userEmail: string,
        action: "add" | "edit" | "delete",
        expense: Expense
    ): Promise<void> {
        const gasUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL;
        if (!gasUrl) {
            throw new Error("Missing NEXT_PUBLIC_APP_SCRIPT_URL env variable.");
        }

        const signedAmount =
            expense.type === TransactionType.EXPENSE
                ? -Math.abs(expense.amount)
                : Math.abs(expense.amount);

        const payload = {
            action,
            user: userEmail,
            data: {
                ...expense,
                amount: signedAmount,
            },
        };

        const response = await fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
    },
};
