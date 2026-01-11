import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Expense, User, SheetConfig, AddExpenseRequest } from "../src/types";
import { api } from "./api";
import { useAuthState, useAuthActions } from "../src/stores/AuthStore";
import { useGoogleAuth } from "../src/stores/GoogleAuthStore";

const SHEET_CONFIG_KEY = "tripsplit_sheet_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";

// Reusable hook to create an auto-refreshing query function
function useAuthedQueryFn<T>(queryFn: (accessToken: string) => Promise<T>) {
    const { saveUser } = useAuthActions();
    const { user: persistedUser } = useAuthState();
    const { refreshToken, logout } = useGoogleAuth();

    return useCallback(async () => {
        try {
            if (!persistedUser?.accessToken) {
                throw new Error("User not authenticated");
            }
            return await queryFn(persistedUser.accessToken);
        } catch (error: any) {
            if (error.message.includes("TOKEN_EXPIRED")) {
                console.log(
                    "Token expired on query, refreshing and retrying..."
                );
                try {
                    const newUser = await refreshToken();
                    console.log("🚀 Token refreshed successfully:", newUser);
                    saveUser(newUser);
                    return await queryFn(newUser.accessToken);
                } catch (refreshError) {
                    console.error(
                        "Failed to refresh token, signing out.",
                        refreshError
                    );
                    logout();
                    throw refreshError;
                }
            }
            throw error;
        }
    }, [persistedUser, queryFn, refreshToken, logout]);
}

// Reusable hook to create an auto-refreshing mutation function
function useAuthedMutationFn<TRespData, TVariables>(
    mutationFn: (
        variables: TVariables,
        accessToken: string
    ) => Promise<TRespData>
) {
    const { saveUser } = useAuthActions();
    const { user: persistedUser } = useAuthState();
    const { refreshToken, logout } = useGoogleAuth();

    return useCallback(
        async (variables: TVariables) => {
            try {
                if (!persistedUser?.accessToken) {
                    throw new Error("User not authenticated");
                }
                return await mutationFn(variables, persistedUser.accessToken);
            } catch (error: any) {
                if (error.message.includes("TOKEN_EXPIRED")) {
                    console.log(
                        "Token expired on mutation, refreshing and retrying..."
                    );
                    try {
                        const newUser = await refreshToken();
                        console.log(
                            "🚀 Token refreshed successfully:",
                            newUser
                        );
                        saveUser(newUser);
                        return await mutationFn(variables, newUser.accessToken);
                    } catch (refreshError) {
                        console.error(
                            "Failed to refresh token, signing out.",
                            refreshError
                        );
                        logout();
                        throw refreshError;
                    }
                }
                throw error;
            }
        },
        [persistedUser, mutationFn, refreshToken, logout]
    );
}

// AppConfig hooks
export const useGetSheetConfig = () => {
    const { user: persistedUser } = useAuthState();
    const { isGsiScriptReady } = useGoogleAuth();

    const authedQueryFn = useAuthedQueryFn((accessToken) =>
        api.getSheetConfig(accessToken)
    );

    return useQuery<SheetConfig, Error>({
        queryKey: [SHEET_CONFIG_KEY],
        queryFn: authedQueryFn,
        enabled: !!persistedUser?.accessToken && isGsiScriptReady,
    });
};

// Expenses hooks
export const useExpensesQuery = () => {
    const { user: persistedUser } = useAuthState();
    const { isGsiScriptReady } = useGoogleAuth();

    const authedQueryFn = useAuthedQueryFn((accessToken) => {
        if (!persistedUser?.email) {
            // This should not happen if query is enabled, but as a safeguard
            return Promise.resolve([]);
        }
        return api.getExpenses(persistedUser.email, accessToken);
    });

    return useQuery<Expense[], Error>({
        queryKey: [EXPENSES_KEY, persistedUser?.email],
        queryFn: authedQueryFn,
        enabled:
            !!persistedUser?.email &&
            !!persistedUser?.accessToken &&
            isGsiScriptReady,
    });
};

export const useAddExpense = () => {
    const queryClient = useQueryClient();
    const { user: persistedUser } = useAuthState();

    const authedMutationFn = useAuthedMutationFn<string, AddExpenseRequest>(
        (newExpense, accessToken) => api.addExpense(newExpense, accessToken)
    );

    return useMutation<string, Error, AddExpenseRequest>({
        mutationFn: authedMutationFn,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [EXPENSES_KEY, persistedUser?.email],
            });
        },
    });
};

export const useDeleteExpense = () => {
    const queryClient = useQueryClient();
    const { user: persistedUser } = useAuthState();

    const authedMutationFn = useAuthedMutationFn<string | number[], string>(
        (timestamp, accessToken) => api.deleteExpenses(timestamp, accessToken)
    );

    return useMutation<
        { response: string | number[]; timestamp: string },
        Error,
        string
    >({
        mutationFn: async (timestamp) => {
            const response = await authedMutationFn(timestamp);
            return { response, timestamp };
        },
        onSuccess: (resp) => {
            if (typeof resp.response === "string") {
                console.warn("Delete expense warning:", resp.response);
                return;
            }
            queryClient.setQueryData<Expense[]>(
                [EXPENSES_KEY, persistedUser?.email],
                (old) => {
                    if (!Array.isArray(old)) {
                        return old;
                    }
                    return old.filter(
                        (expense) => expense.timestamp !== resp.timestamp
                    );
                }
            );
        },
    });
};
