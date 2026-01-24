import {
    AddExpenseRequest,
    AppScriptResponse,
    Expense,
    isSuccess,
    SheetConfig,
    User,
} from "../src/types";
import logger from "@/src/utils/logger";

// Handle case where result might be the object directly (if proxy transformed it or it's a direct API)
async function processApiResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error("TOKEN_EXPIRED");
        }
        const err = new Error(`Failed to fetch: ${response.statusText}`);
        logger.log("🚀 Fail to fetch api", err.message);
        throw err;
    }

    const result: AppScriptResponse<T> & { errorCode?: string } =
        await response.json();
    logger.log("🚀 Fetched result:", result);

    if (isSuccess(result)) {
        return result.result;
    } else {
        if (result.errorCode === "TOKEN_EXPIRED") {
            throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(result.error || "Unknown error from server");
    }
}

// Special handler for /me which might not be wrapped in AppScriptResponse if served directly by proxy logic
async function processUserResponse(response: Response): Promise<User> {
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
    }

    const data = await response.json();

    // Check if it matches AppScriptResponse structure
    if (data && typeof data === "object" && "ok" in data && "result" in data) {
        if (data.ok) {
            return data.result as User;
        } else {
            throw new Error(data.error || "Failed to get user");
        }
    }

    // Otherwise assume it is the User object directly (standard proxy response)
    return data as User;
}

const getProxyUrl = () => {
    const proxyUrl = process.env.NEXT_PUBLIC_AUTH_PROXY;
    if (!proxyUrl) {
        throw new Error("Missing NEXT_PUBLIC_AUTH_PROXY env variable.");
    }
    return `${proxyUrl}/auth/travel-split/api`;
};

export const api = {
    async getSheetConfig(): Promise<SheetConfig> {
        const url = getProxyUrl();
        const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
                action: "getConfig",
            }),
        });
        return processApiResponse<SheetConfig>(response);
    },

    async addExpense(expense: AddExpenseRequest): Promise<string> {
        logger.log("🚀 addExpense called with: ", expense);
        const url = getProxyUrl();

        const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
                action: "addExpense",
                payload: expense,
            }),
        });
        return processApiResponse<string>(response);
    },

    async getExpenses(userEmail: string): Promise<Expense[]> {
        logger.log("🚀 getExpenses called for: ", userEmail);
        const url = getProxyUrl();

        const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
                action: "getExpenses",
                payload: { userEmail },
            }),
        });
        return processApiResponse<Expense[]>(response);
    },

    async deleteExpenses(timestamp: string): Promise<number[] | string> {
        logger.log("🚀 deleteExpenses called for: ", timestamp);
        const url = getProxyUrl();

        const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
                action: "deleteExpense",
                payload: { timestamp },
            }),
        });
        return processApiResponse<number[] | string>(response);
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

        return processUserResponse(response);
    },
};
