"use client";

import React, {
    createContext,
    useContext,
    useCallback,
    useMemo,
} from "react";
import { useExpensesQuery, useSaveExpenses } from "../../services/dataFetcher";
import { api } from "../../services/api";
import { Expense, ApiState, AddExpenseRequest } from "../types";
import { useAuth, useAuthState } from "./AuthStore";

interface ExpensesContextValue {
    expenses: Expense[];
    apiState: ApiState;
    refreshExpenses: (options?: { force?: boolean }) => Promise<void>;
    addExpense: (expense: AddExpenseRequest) => Promise<void>;
    updateExpense: (expense: Expense) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(
    undefined
);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthState();
    const { data: expenses, isLoading, error, refetch } = useExpensesQuery(user?.email);
    const { mutateAsync: saveExpenses } = useSaveExpenses();

    const apiState: ApiState = useMemo(() => ({
        isLoading,
        error: error?.message || null,
        lastUpdated: null, // This can be improved with query's dataUpdatedAt
    }), [isLoading, error]);

    const refreshExpenses = useCallback(async () => {
        await refetch();
    }, [refetch]);

    const addExpense = useCallback(
        async (expense: AddExpenseRequest) => {
            if (!user) return;
            try {
                const result = await api.addExpense(expense);
                console.log("Added expense:", result);
                // await refreshExpenses();
            } catch (err) {
                console.error("Failed to add expense:", err);
            }
        },
        [user, refreshExpenses]
    );

    const updateExpense = useCallback(
        async (expense: Expense) => {
            if (!user) return;
            const newExpenses = (expenses || []).map((e) =>
                e.timestamp === expense.timestamp ? expense : e
            );
            await saveExpenses(newExpenses);
            try {
                await api.syncTransaction(user.email, "edit", expense);
                await refreshExpenses();
            } catch (err) {
                console.error("Failed to update expense:", err);
            }
        },
        [expenses, user, saveExpenses, refreshExpenses]
    );

    const deleteExpense = useCallback(
        async (timestamp: string) => {
            if (!user) return;
            const expenseToDelete = (expenses || []).find(
                (e) => e.timestamp === timestamp
            );
            if (!expenseToDelete) return;

            const newExpenses = (expenses || []).filter(
                (e) => e.timestamp !== timestamp
            );
            await saveExpenses(newExpenses);
            try {
                await api.syncTransaction(
                    user.email,
                    "delete",
                    expenseToDelete
                );
                await refreshExpenses();
            } catch (err) {
                console.error("Failed to delete expense:", err);
            }
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
