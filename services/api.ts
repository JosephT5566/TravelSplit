import {
    AddExpenseRequest,
    Expense,
    SheetConfig,
    User,
    RawExpense,
    AddExpenseResponse,
} from "../src/types";
import logger from "@/src/utils/logger";
import { apiFetch } from "./fetcher";

async function processGcfResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        // The fetcher will handle token expiry, but we leave this as a fallback.
        if (response.status === 401 || response.status === 403) {
            throw new Error("TOKEN_EXPIRED");
        }
        const err = new Error(`Failed to fetch: ${response.statusText}`);
        logger.log("🚀 Fail to fetch api", err.message);
        throw err;
    }

    const result = await response.json();
    logger.log("🚀 Fetched result:", result);

    if (result.success) {
        return result.data as T;
    } else {
        throw new Error(result.error?.message || "Unknown error from server");
    }
}

// Special handler for /me which might not be wrapped in the GCF response format
async function processUserResponse(response: Response): Promise<User> {
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    // Assumes the /me endpoint returns the User object directly
    return response.json();
}

const getGcfUrl = (path: string) => {
    const gcfUrl = process.env.NEXT_PUBLIC_TRAVEL_SPLIT_GCF;
    if (!gcfUrl) {
        throw new Error("Missing NEXT_PUBLIC_TRAVEL_SPLIT_GCF env variable.");
    }
    const sheetId = process.env.NEXT_PUBLIC_SHEET_ID;
    if (!sheetId) {
        throw new Error("Missing NEXT_PUBLIC_SHEET_ID env variable.");
    }
    const url = new URL(`${gcfUrl}${path}`);
    url.searchParams.append("sheetId", sheetId);
    return url.toString();
};

// Maps raw expense data to the Expense type - EXPORTED for use in dataFetcher.ts
export function mapRawExpenseToExpense(
    raw: RawExpense,
    currentUserEmail: string,
    users: Record<string, string>,
): Expense {
    const splitsJson: Record<string, number> = {};
    const knownColumns = [
        "時間戳記",
        "日期",
        "星期",
        "類別",
        "品項",
        "金額",
        "貨幣",
        "匯率",
        "付款人",
        "個人小記",
        "已結算",
    ];
    const swappedUsers = Object.fromEntries(
        Object.entries(users).map(([key, value]) => [value, key]),
    );

    splitsJson[currentUserEmail] = parseFloat(raw["個人小記"]) || 0;

    for (const key in raw) {
        if (
            !knownColumns.includes(key) &&
            raw[key] !== null &&
            raw[key] !== ""
        ) {
            const amount = parseFloat(raw[key] as string);

            if (!isNaN(amount)) {
                // The key is a nickname, find the corresponding email
                const email = swappedUsers[key];
                if (email) {
                    splitsJson[email] = amount;
                }
            }
        }
    }

    return {
        timestamp: raw["時間戳記"],
        date: raw["日期"],
        itemName: raw["品項"],
        category: raw["類別"],
        payer: raw["付款人"],
        amount: parseFloat(raw["金額"]),
        currency: raw["貨幣"],
        exchangeRate: parseFloat(raw["匯率"]) || 1,
        splitsJson,
    };
}

export const api = {
    async getSheetConfig(): Promise<SheetConfig> {
        const url = getGcfUrl("/setting");
        const response = await apiFetch(url, {
            method: "GET",
            credentials: "include",
        });
        logger.log("🚀 getSheetConfig response:", response);
        return processGcfResponse<SheetConfig>(response);
    },

    async addExpense(expense: AddExpenseRequest): Promise<AddExpenseResponse> {
        logger.log("🚀 addExpense called with: ", expense);
        const url = getGcfUrl("/add");

        const response = await apiFetch(url, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ payload: expense }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        return processGcfResponse<AddExpenseResponse>(response);
    },

    async getExpenses(
        userEmail: string,
        users: Record<string, string>,
    ): Promise<Expense[]> {
        logger.log("🚀 getExpenses called for: ", userEmail);
        const url = new URL(getGcfUrl("/data"));
        url.searchParams.append("email", userEmail);

        const response = await apiFetch(url.toString(), {
            method: "GET",
            credentials: "include",
        });

        // The API now returns a raw format that needs conversion.
        const rawExpenses = await processGcfResponse<RawExpense[]>(response);
        return rawExpenses.map((raw) => mapRawExpenseToExpense(raw, userEmail, users));
    },

    async deleteExpenses(timestamp: string): Promise<string> {
        logger.log("🚀 deleteExpenses called for: ", timestamp);
        const url = new URL(getGcfUrl("/delete"));
        url.searchParams.append("timestamp", timestamp);

        const response = await apiFetch(url.toString(), {
            method: "DELETE",
            credentials: "include",
        });
        return processGcfResponse<string>(response);
    },

    async getCurrentUser(): Promise<User> {
        const proxyUrl = process.env.NEXT_PUBLIC_AUTH_PROXY;
        if (!proxyUrl) {
            throw new Error("Missing NEXT_PUBLIC_AUTH_PROXY env variable.");
        }
        const response = await fetch(`${proxyUrl}/auth/travel-split/me`, {
            method: "GET",
            credentials: "include",
        });
        logger.log("🚀 Fetched /me response:", response);

        return processUserResponse(response);
    },
};
