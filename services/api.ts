import { Expense, TransactionType } from "../types";

// Mock response structure from GAS
interface GasResponse {
    status: "success" | "error";
    data?: any[];
    message?: string;
}

export const getMockExpenses = (): Expense[] => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    return [
        {
            id: "mock-1",
            timestamp: new Date().toISOString(),
            date: fmt(today),
            day: today.toLocaleDateString("en-US", { weekday: "long" }),
            category: "Food",
            item: "Welcome Dinner (Sushi)",
            type: TransactionType.EXPENSE,
            amount: 12000,
            currency: "JPY",
            payer: "demo@tripsplit.app",
            settled: false,
            remark: "Team dinner",
            exchangeRate: 0.22,
            personalNote: "Amazing fatty tuna!",
        },
        {
            id: "mock-2",
            timestamp: new Date().toISOString(),
            date: fmt(today),
            day: today.toLocaleDateString("en-US", { weekday: "long" }),
            category: "Transport",
            item: "Airport Express",
            type: TransactionType.EXPENSE,
            amount: 500,
            currency: "TWD",
            payer: "demo@tripsplit.app",
            settled: true,
            remark: "",
            exchangeRate: 1,
        },
        {
            id: "mock-3",
            timestamp: new Date().toISOString(),
            date: fmt(today),
            day: today.toLocaleDateString("en-US", { weekday: "long" }),
            category: "Shopping",
            item: "Uniqlo Haul",
            type: TransactionType.EXPENSE,
            amount: 3500,
            currency: "TWD",
            payer: "demo@tripsplit.app",
            settled: false,
            remark: "Gifts for family",
            exchangeRate: 1,
        },
        {
            id: "mock-4",
            timestamp: new Date().toISOString(),
            date: fmt(today),
            day: today.toLocaleDateString("en-US", { weekday: "long" }),
            category: "Others",
            item: "Refund for Shared Taxi",
            type: TransactionType.INCOME,
            amount: 200,
            currency: "TWD",
            payer: "friend@test.com",
            settled: true,
            remark: "",
            exchangeRate: 1,
        },
    ];
};

export const api = {
    /**
     * Fetches expenses from the Google Apps Script endpoint.
     * Expects the GAS to return JSON with column mapping.
     */
    async fetchExpenses(gasUrl: string, userEmail: string): Promise<Expense[]> {
        // Append action and user for simple validation/logging on GAS side
        const url = `${gasUrl}?action=read&user=${encodeURIComponent(
            userEmail
        )}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const json: GasResponse = await response.json();
        if (json.status === "error") {
            throw new Error(json.message || "Unknown error from server");
        }

        // Transform generic sheet rows to Expense objects
        // Assuming GAS returns an array of objects matching our schema loosely
        // In a real scenario, we might need to map array indices to keys
        return (json.data || []).map((row: any) => ({
            id: row.id || crypto.randomUUID(),
            timestamp: row.timestamp,
            date: row.date,
            day: row.day,
            category: row.category,
            item: row.item,
            type:
                row.amount >= 0
                    ? TransactionType.INCOME
                    : TransactionType.EXPENSE, // Logic based on amount sign from Sheet
            amount: Math.abs(row.amount),
            currency: row.currency,
            payer: row.payer,
            personalNote: row.personalNote,
            settled: row.settled === true || row.settled === "TRUE",
            remark: row.remark,
            exchangeRate: Number(row.exchangeRate) || 1,
        }));
    },

    /**
     * Sends a create/update/delete command to GAS
     */
    async syncTransaction(
        gasUrl: string,
        userEmail: string,
        action: "add" | "edit" | "delete",
        expense: Expense
    ): Promise<void> {
        // GAS usually requires POST data to be stringified or sent as form-data
        // Since this is a simple fetch, we use text/plain to avoid CORS preflight complexity in some GAS setups,
        // or standard JSON if the GAS script handles OPTIONS correctly.
        // Here we assume a robust GAS setup supporting JSON.

        // Convert 'type' back to signed amount for the sheet
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
            mode: "no-cors", // GAS often requires no-cors for simple POSTs if not perfectly configured, but this prevents reading response.
            // If the user's GAS is set up to return JSON with CORS headers:
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        // Note: With 'no-cors', we can't check response.ok.
        // If the user configures GAS correctly with CORS, remove 'mode: no-cors' and check below.
        // For this generic app, we will assume standard fetch.

        // If we assume a perfect world with CORS enabled GAS:
        // const json = await response.json();
        // if (json.status === 'error') throw new Error(json.message);
    },
};
