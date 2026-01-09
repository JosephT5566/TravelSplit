import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Expense,
    User,
    SheetConfig,
    AddExpenseRequest,
} from "../src/types";
import { api } from "./api";
import { useAuthState } from "../src/stores/AuthStore";

const SHEET_CONFIG_KEY = "tripsplit_sheet_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";

// AppConfig hooks
export const useGetSheetConfig = () => {
    const { user } = useAuthState();
    return useQuery<SheetConfig, Error>({
        queryKey: [SHEET_CONFIG_KEY],
        queryFn: async (): Promise<SheetConfig> => {
            if (!user?.idToken) {
                throw new Error("User not authenticated");
            }
            return await api.getSheetConfig(user.idToken);
        },
        enabled: !!user?.idToken,
    });
};

// User hooks
export const useUser = () => {
    return useQuery<User, Error>({
        queryKey: [USER_KEY],
        queryFn: async (): Promise<User> => {
            // Fetch user data from cache with key.
            // If not found or expired, return default user.

            // This query function is a placeholder and should not be called,
            // as user data is set by useSaveUser mutation.
            // The query is disabled if no user data is in cache.
            return { email: "", name: "", idToken: "" };
        },
        gcTime: 1000 * 60 * 60 * 24, // 1 day
    });
};

export const useSaveUser = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, User>({
        mutationFn: async (newUser) => {
            queryClient.setQueryData([USER_KEY], newUser);
        },
    });
};

export const useClearUser = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, void>({
        mutationFn: async () => {
            queryClient.setQueryData([USER_KEY], undefined);
        },
    });
};

// Expenses hooks
export const useExpensesQuery = () => {
    const { user } = useAuthState();
    return useQuery<Expense[], Error>({
        queryKey: [EXPENSES_KEY, user?.email],
        queryFn: () => {
            if (!user?.email || !user?.idToken) {
                return Promise.resolve([]);
            }
            console.log("🚀 Fetching expenses api for user:", user.email);
            return api.getExpenses(user.email, user.idToken);
        },
        enabled: !!user?.email && !!user?.idToken,
    });
};

export const useAddExpense = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthState();

    return useMutation<string, Error, AddExpenseRequest>({
        mutationFn: async (newExpense) => {
            if (!user?.idToken) {
                throw new Error("User not authenticated");
            }
            return await api.addExpense(newExpense, user.idToken);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [EXPENSES_KEY, user?.email],
            });
        },
    });
};

export const useDeleteExpense = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthState();

    return useMutation<
        { response: string | number[]; timestamp: string },
        Error,
        string
    >({
        mutationFn: async (timestamp) => {
            if (!user?.idToken) {
                throw new Error("User not authenticated");
            }
            const response = await api.deleteExpenses(timestamp, user.idToken);
            return { response, timestamp };
        },
        onSuccess: (resp) => {
            if (typeof resp.response === "string") {
                console.warn("Delete expense warning:", resp.response);
                return;
            }
            queryClient.setQueryData<Expense[]>(
                [EXPENSES_KEY, user?.email],
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