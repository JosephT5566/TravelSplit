import {
    AddExpenseRequest,
    Expense,
    SheetConfig,
    User,
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
        if (result.error?.code === "TOKEN_EXPIRED" || result.error?.code === "TOKEN_INVALID") {
            throw new Error("TOKEN_EXPIRED");
        }
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

    async addExpense(expense: AddExpenseRequest): Promise<string> {
        logger.log("🚀 addExpense called with: ", expense);
        const url = getGcfUrl("/add");

        const response = await apiFetch(url, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(expense),
            headers: {
                "Content-Type": "application/json",
            },
        });
        return processGcfResponse<string>(response);
    },

    async getExpenses(userEmail: string): Promise<Expense[]> {
        logger.log("🚀 getExpenses called for: ", userEmail);
        const url = new URL(getGcfUrl("/data"));
        url.searchParams.append("email", userEmail);

        const response = await apiFetch(url.toString(), {
            method: "GET",
            credentials: "include",
        });
        return processGcfResponse<Expense[]>(response);
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