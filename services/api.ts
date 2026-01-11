import {
    AddExpenseRequest,
    AppScriptResponse,
    Expense,
    ExpensesResponse,
    isSuccess,
    SheetConfig,
} from "../src/types";

let refreshPromise = null;
let _refreshHandler = null;

// call by Context, to load the logic in the hook
export const setRefreshHandler = (handler) => {
  _refreshHandler = handler;
};

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

async function processResponse<T>(response: Response): Promise<T> {
    console.log("🚀 Processing response:", response);
    if (!response.ok) {
        const err = new Error(`Failed to fetch: ${response.statusText}`);
        console.log("🚀 Processing response error", err.message);
        throw err;
    }

    const result: AppScriptResponse<T> & { errorCode?: string } = await response.json();
    console.log("🚀 Fetched result:", result);

    if (isSuccess(result)) {
        return result.result;
    } else {
        if (result.errorCode === 'TOKEN_EXPIRED') {
            throw new Error('TOKEN_EXPIRED');
        }
        throw new Error(result.error || "Unknown error from server");
    }
}


export const api = {
    async getSheetConfig(accessToken: string): Promise<SheetConfig> {
        const gasUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL;
        if (!gasUrl) {
            throw new Error("Missing NEXT_PUBLIC_APP_SCRIPT_URL env variable.");
        }

        const response = await fetch(gasUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "getConfig",
                access_token: accessToken,
            }),
        });
        return processResponse<SheetConfig>(response);
    },

    async addExpense(expense: AddExpenseRequest, accessToken: string): Promise<string> {
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
                access_token: accessToken,
            }),
        });
        return processResponse<string>(response);
    },

    async getExpenses(userEmail: string, accessToken: string): Promise<Expense[]> {
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
                access_token: accessToken,
            }),
        });
        console.log("🚀 Fetched expenses response:", response);
        return processResponse<Expense[]>(response);
    },

    async deleteExpenses(timestamp: string, accessToken: string): Promise<number[] | string> {
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
                access_token: accessToken,
            }),
        });
        return processResponse<number[] | string>(response);
    },
};
