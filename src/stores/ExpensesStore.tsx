"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useExpensesQuery } from "../../services/dataFetcher";
import { Expense, ApiState } from "../types";
import { queryClient } from "../../services/queryClient";
import { clearUserQueryCaches } from "../../services/todoCache";

interface ExpensesContextValue {
    expenses: Expense[];
    apiState: ApiState;
    refreshExpenses: (options?: { force?: boolean }) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(
    undefined
);

export function clearExpensesCache() {
    clearUserQueryCaches(queryClient);
}

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
    const {
        data: expenses,
        isFetching,
        isEnabled,
        error,
        refetch,
    } = useExpensesQuery();

    const apiState: ApiState = useMemo(
        () => ({
            isFetching,
            error: error?.message || null,
            lastUpdated: null, // This can be improved with query's dataUpdatedAt
        }),
        [isFetching, error]
    );

    const refreshExpenses = useCallback(async () => {
        if (isEnabled) {
            await refetch();
        }
    }, [isEnabled, refetch]);

    const value = useMemo(
        () => ({
            expenses: expenses || [],
            apiState,
            refreshExpenses,
        }),
        [expenses, apiState, refreshExpenses]
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
