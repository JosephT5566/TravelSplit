import {
    AddExpenseRequest,
    AppScriptResponse,
    Expense,
    ExpensesResponse,
    isSuccess,
    SheetConfig,
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
            exchangeRate: 0.2,
            payer: "demo@tripsplit.app",
            // settled: false,
            splitsJson: {},
        },
        {
            timestamp: new Date().toISOString(),
            date: fmt(today),
            category: "Transport",
            itemName: "Airport Express",
            amount: 500,
            currency: "TWD",
            exchangeRate: 1,
            payer: "demo@tripsplit.app",
            // settled: true,
            splitsJson: {},
        },
        {
            timestamp: new Date().toISOString(),
            date: fmt(today),
            category: "Shopping",
            itemName: "Uniqlo Haul",
            amount: 3500,
            exchangeRate: 1,
            currency: "TWD",
            payer: "demo@tripsplit.app",
            // settled: false,
            splitsJson: {},
        },
        {
            timestamp: new Date().toISOString(),
            date: fmt(today),
            category: "Others",
            itemName: "Refund for Shared Taxi",
            amount: 200,
            exchangeRate: 1,
            currency: "TWD",
            payer: "friend@test.com",
            // settled: true,
            splitsJson: {},
        },
    ];
};

export const api = {
    async getSheetConfig(idToken: string): Promise<SheetConfig> {
        const gasUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL;
        if (!gasUrl) {
            throw new Error("Missing NEXT_PUBLIC_APP_SCRIPT_URL env variable.");
        }

        const response = await fetch(gasUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "getConfig",
                id_token: idToken,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result: AppScriptResponse<SheetConfig> = await response.json();
        console.log("🚀 Fetched sheet config result:", result);

        if (isSuccess(result)) {
            return result.result;
        } else {
            throw new Error(result.error || "Unknown error from server");
        }
    },

    async addExpense(expense: AddExpenseRequest, idToken: string): Promise<string> {
        console.log("🚀 addExpense called with: ", expense);

        const gasUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL;
        if (!gasUrl) {
            throw new Error("Missing NEXT_PUBLIC_APP_SCRIPT_URL env variable.");
        }

        const response = await fetch(gasUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "addExpense",
                payload: expense,
                id_token: idToken,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result: AppScriptResponse<string> = await response.json();
        console.log("🚀 Added expense result:", result);

        if (isSuccess(result)) {
            return result.result;
        } else {
            throw new Error(result.error || "Unknown error from server");
        }
    },

    async getExpenses(userEmail: string, idToken: string): Promise<Expense[]> {
        console.log("🚀 getExpenses called for: ", userEmail);

        const gasUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL;
        if (!gasUrl) {
            throw new Error("Missing NEXT_PUBLIC_APP_SCRIPT_URL env variable.");
        }

        const response = await fetch(gasUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "getExpenses",
                payload: { userEmail },
                id_token: idToken,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result: ExpensesResponse = await response.json();
        console.log("🚀 Fetched expenses:", result);

        if (isSuccess(result)) {
            return result.result;
        } else {
            throw new Error(result.error || "Unknown error from server");
        }
    },

    async deleteExpenses(timestamp: string, idToken: string): Promise<number[] | string> {
        console.log("🚀 deleteExpenses called for: ", timestamp);

        const gasUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL;
        if (!gasUrl) {
            throw new Error("Missing NEXT_PUBLIC_APP_SCRIPT_URL env variable.");
        }

        const response = await fetch(gasUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "deleteExpense",
                payload: { timestamp },
                id_token: idToken,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result: AppScriptResponse<number[] | string> =
            await response.json();
        console.log("🚀 Fetched expenses:", result);

        if (isSuccess(result)) {
            return result.result;
        } else {
            throw new Error(result.error || "Unknown error from server");
        }
    },
};
