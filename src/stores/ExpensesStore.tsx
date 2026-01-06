"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import {
    useExpensesQuery,
    useSaveExpenses,
    useAddExpense,
} from "../../services/dataFetcher";
import {
    Expense,
    ApiState,
    AddExpenseRequest,
} from "../types";
import { useAuthState } from "./AuthStore";

interface ExpensesContextValue {
    expenses: Expense[];
    apiState: ApiState;
    refreshExpenses: (options?: { force?: boolean }) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(
    undefined
);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthState();
    const {
        data: expenses,
        isLoading,
        error,
        refetch,
    } = useExpensesQuery(user?.email);
    const { mutateAsync: saveExpenses } = useSaveExpenses();
    const { mutateAsync: addExpenseMutation, isPending: isAddingExpense } = useAddExpense(user?.email);

    const apiState: ApiState = useMemo(
        () => ({
            isLoading,
            error: error?.message || null,
            lastUpdated: null, // This can be improved with query's dataUpdatedAt
        }),
        [isLoading, error]
    );

    const refreshExpenses = useCallback(async () => {
        await refetch();
    }, [refetch]);

    const deleteExpense = useCallback(
        async (timestamp: string) => {
            const expenseToDelete = (expenses || []).find(
                (e) => e.timestamp === timestamp
            );
            if (!expenseToDelete) return;

            const newExpenses = (expenses || []).filter(
                (e) => e.timestamp !== timestamp
            );
            await saveExpenses(newExpenses);
            // try {
            //     await api.syncTransaction(
            //         user.email,
            //         "delete",
            //         expenseToDelete
            //     );
            //     await refreshExpenses();
            // } catch (err) {
            //     console.error("Failed to delete expense:", err);
            // }
        },
        [expenses, user, saveExpenses, refreshExpenses]
    );

    const value = useMemo(
        () => ({
            expenses: expenses || [],
            apiState,
            refreshExpenses,
            deleteExpense,
        }),
        [
            expenses,
            apiState,
            refreshExpenses,
            deleteExpense,
        ]
    );

    return (
        <ExpensesContext.Provider value={value}>
            {children}
        </ExpensesContext.Provider>
    );
}

export function useExpenses() {
    const context = useContext(ExpensesContext);
    if (!context) {
        throw new Error("useExpenses must be used within an ExpensesProvider");
    }
    return context;
}
