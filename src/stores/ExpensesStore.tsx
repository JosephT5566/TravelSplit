"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useExpensesQuery, useSaveExpenses } from "../../services/dataFetcher";
import { api } from "../../services/api";
import {
    Expense,
    ApiState,
    AddExpenseRequest,
    EditExpenseRequest,
} from "../types";
import { useAuth, useAuthState } from "./AuthStore";

interface ExpensesContextValue {
    expenses: Expense[];
    apiState: ApiState;
    refreshExpenses: (options?: { force?: boolean }) => Promise<void>;
    addExpense: (expense: AddExpenseRequest) => Promise<void>;
    updateExpense: (expense: EditExpenseRequest) => Promise<void>;
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

    const addExpense = useCallback(
        async (expense: AddExpenseRequest) => {
            try {
                const result = await api.addExpense(expense);
                console.log("Added expense:", result);
                // await refreshExpenses();
            } catch (err) {
                console.error("Failed to add expense:", err);
            }
        },
        [refreshExpenses]
    );

    const updateExpense = useCallback(
        async (expense: EditExpenseRequest) => {
            const newExpenses = (expenses || []).map((e) =>
                e.timestamp === expense.timestamp
                    ? { ...expense, splitsJson: JSON.parse(expense.splitsJson) } // transfer to type Expense
                    : e
            );
            await saveExpenses(newExpenses);
            try {
                // await api.syncTransaction(user.email, "edit", expense);
                await refreshExpenses();
            } catch (err) {
                console.error("Failed to update expense:", err);
            }
        },
        [expenses, saveExpenses, refreshExpenses]
    );

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
            addExpense,
            updateExpense,
            deleteExpense,
        }),
        [
            expenses,
            apiState,
            refreshExpenses,
            addExpense,
            updateExpense,
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
