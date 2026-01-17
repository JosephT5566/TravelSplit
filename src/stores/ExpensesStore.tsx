"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useExpensesQuery } from "../../services/dataFetcher";
import { Expense, ApiState } from "../types";
import { queryClient } from "../../services/queryClient";
import { EXPENSES_KEY } from "../../services/cacheKeys";

interface ExpensesContextValue {
    expenses: Expense[];
    apiState: ApiState;
    refreshExpenses: (options?: { force?: boolean }) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(
    undefined
);

export function clearExpensesCache() {
    queryClient.removeQueries({ queryKey: [EXPENSES_KEY] });
}

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
    const {
        data: expenses,
        isFetching,
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
        await refetch();
    }, [refetch]);

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
