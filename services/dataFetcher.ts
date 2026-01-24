import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Expense, SheetConfig, AddExpenseRequest } from "../src/types";
import { api } from "./api";
import { useAuthState } from "../src/stores/AuthStore";
import { EXPENSES_KEY, SHEET_CONFIG_KEY } from "./cacheKeys";
import logger from "@/src/utils/logger";

// AppConfig hooks
export const useGetSheetConfig = () => {
    const { isSignedIn } = useAuthState();

    return useQuery<SheetConfig, Error>({
        queryKey: [SHEET_CONFIG_KEY],
        queryFn: () => api.getSheetConfig(),
        enabled: isSignedIn,
    });
};

// Expenses hooks
export const useExpensesQuery = () => {
    const { user, isSignedIn } = useAuthState();

    return useQuery<Expense[], Error>({
        queryKey: [EXPENSES_KEY, user?.email],
        queryFn: () => {
            if (!user?.email) {
                return Promise.resolve([]);
            }
            return api.getExpenses(user.email);
        },
        enabled: isSignedIn && !!user?.email,
        retry: 3,
    });
};

export const useAddExpense = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthState();

    return useMutation<string, Error, AddExpenseRequest>({
        mutationFn: (newExpense) => api.addExpense(newExpense),
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
            const response = await api.deleteExpenses(timestamp);
            return { response, timestamp };
        },
        onSuccess: (resp) => {
            logger.log("Deleted expense with timestamp:", resp.timestamp);
            if (typeof resp.response === "string") {
                logger.warn("Delete expense warning:", resp.response);
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
