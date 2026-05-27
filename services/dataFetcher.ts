import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Expense,
    SheetConfig,
    AddExpenseRequest,
    AddExpenseResponse,
    DeleteExpenseResponse,
} from "../src/types";
import { api, mapRawExpenseToExpense } from "./api";
import { useAuthState } from "../src/stores/AuthStore";
import { useConfig } from "../src/stores/ConfigStore";
import { EXPENSES_KEY, SHEET_CONFIG_KEY } from "./cacheKeys";
import logger from "@/src/utils/logger";
import {
    getActiveSheetIdOrNull,
    isSheetSelectionRequired,
} from "@/src/utils/sheetSelection";
import { useSelectedSheetId } from "@/src/hooks/useSelectedSheetId";

// AppConfig hooks
export const useGetSheetConfig = () => {
    const { isSignedIn } = useAuthState();
    const selectedSheetId = useSelectedSheetId();
    const canFetchSheetConfig =
        isSignedIn && (!isSheetSelectionRequired() || !!selectedSheetId);

    return useQuery<SheetConfig, Error>({
        queryKey: [SHEET_CONFIG_KEY, selectedSheetId],
        queryFn: () => api.getSheetConfig(selectedSheetId || undefined),
        enabled: canFetchSheetConfig,
    });
};

// Expenses hooks
export const useExpensesQuery = () => {
    const { user, isSignedIn } = useAuthState();
    const { sheetConfig } = useConfig();
    const selectedSheetId = useSelectedSheetId();

    return useQuery<Expense[], Error>({
        queryKey: [EXPENSES_KEY, selectedSheetId, user?.email],
        queryFn: () => {
            if (!user?.email || !sheetConfig?.users) {
                return Promise.resolve([]);
            }
            return api.getExpenses(user.email, sheetConfig.users);
        },
        enabled:
            isSignedIn &&
            !!selectedSheetId &&
            !!user?.email &&
            !!sheetConfig?.users,
        retry: 3,
    });
};

export const useAddExpense = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthState();
    const { sheetConfig } = useConfig();

    return useMutation<AddExpenseResponse, Error, AddExpenseRequest>({
        mutationFn: (newExpense) => api.addExpense(newExpense),
        onSuccess: (data) => {
            if (!sheetConfig?.users) {
                queryClient.invalidateQueries({
                    queryKey: [
                        EXPENSES_KEY,
                        getActiveSheetIdOrNull(),
                        user?.email,
                    ],
                });
                return;
            }
            const addedExpense = mapRawExpenseToExpense(
                data.newRecord,
                user?.email || "",
                sheetConfig.users
            );

            queryClient.setQueryData<Expense[]>(
                [EXPENSES_KEY, getActiveSheetIdOrNull(), user?.email],
                (old) => {
                    if (!Array.isArray(old)) {
                        return [addedExpense];
                    }
                    return [...old, addedExpense];
                }
            );
        },
    });
};

export const useDeleteExpense = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthState();

    return useMutation<DeleteExpenseResponse, Error, string>({
        mutationFn: async (timestamp) => {
            return api.deleteExpenses(timestamp);
        },
        onSuccess: (response) => {
            logger.log("Deleted expense response:", response);
            const { deletedTimestamp } = response;
            const queryKey = [
                EXPENSES_KEY,
                getActiveSheetIdOrNull(),
                user?.email,
            ];
            queryClient.setQueryData<Expense[]>(
                queryKey,
                (old) => {
                    if (!Array.isArray(old)) {
                        return old;
                    }
                    return old.filter(
                        (expense) => expense.timestamp !== deletedTimestamp
                    );
                }
            );
        },
    });
};
