import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";
import {
    Expense,
    SheetConfig,
    AddExpenseRequest,
    ExpenseWriteResult,
    DeleteExpenseResponse,
} from "../src/types";
import { api } from "./api";
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
        queryFn: ({ signal }) => {
            if (!selectedSheetId || !user?.email || !sheetConfig?.users) {
                return Promise.resolve([]);
            }
            return api.getExpenses(
                user.email,
                sheetConfig.users,
                selectedSheetId,
                signal,
            );
        },
        enabled:
            isSignedIn &&
            !!selectedSheetId &&
            !!user?.email &&
            !!sheetConfig?.users,
        retry: 3,
    });
};

export const useAddExpense = (sheetId: string, userEmail: string) => {
    const queryClient = useQueryClient();
    const isActive = useRef(false);
    useLayoutEffect(() => {
        isActive.current = true;
        return () => {
            isActive.current = false;
        };
    }, []);

    return useMutation<ExpenseWriteResult, Error, AddExpenseRequest>({
        mutationFn: (expense) =>
            api.addExpense(expense, sheetId, () =>
                isActive.current && getActiveSheetIdOrNull() === sheetId,
            ),
        networkMode: "always",
        retry: false,
        onSuccess: (result) => {
            if (result !== "saved") return;

            // /data is authoritative for which expenses this user can see.
            const filter = {
                queryKey: [EXPENSES_KEY, sheetId, userEmail],
                exact: true,
            };
            void queryClient.cancelQueries(filter)
                .then(() => queryClient.invalidateQueries(filter))
                .catch((error) => logger.error("Could not refresh saved expenses.", error));
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
