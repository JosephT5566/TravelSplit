"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { storage } from "../../services/storage";
import { api } from "../../services/api";
import { Expense, ApiState } from "../types";
import { useAuth } from "./AuthStore";
import { useConfig } from "./ConfigStore";

interface ExpensesContextValue {
    expenses: Expense[];
    apiState: ApiState;
    refreshExpenses: (options?: { force?: boolean }) => Promise<void>;
    addExpense: (expense: Expense) => Promise<void>;
    updateExpense: (expense: Expense) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(
    undefined
);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [apiState, setApiState] = useState<ApiState>({
        isLoading: false,
        error: null,
        lastUpdated: null,
    });
    const refreshInFlight = useRef<Promise<void> | null>(null);
    const isMountedRef = useRef(true);

    const { user } = useAuth();
    const { config } = useConfig();

    useEffect(() => {
        const loadStoredData = async () => {
            const storedExpenses = await storage.getExpenses();
            if (storedExpenses) {
                setExpenses(storedExpenses);
            }
            const lastUpdated = await storage.getLastUpdated();
            if (lastUpdated) {
                setApiState((prev) => ({ ...prev, lastUpdated }));
            }
        };
        loadStoredData();

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const refreshExpenses = useCallback(async (options?: { force?: boolean }) => {
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        if (refreshInFlight.current) {
            return refreshInFlight.current;
        }

        if (apiState.isLoading) {
            return;
        }

        const isCacheFresh = apiState.lastUpdated && Date.now() - apiState.lastUpdated < CACHE_DURATION;
        if (options?.force !== true && isCacheFresh) {
            return;
        }

        if (!config?.gasUrl || !user?.email) {
            return;
        }

        const refreshPromise = (async () => {
            setApiState((prev) => ({ ...prev, isLoading: true, error: null }));
            try {
                const data = await api.getExpenses(user.email);
                if (!isMountedRef.current) return;

                setExpenses(data);
                await storage.saveExpenses(data);
                const now = Date.now();
                await storage.saveLastUpdated(now);
                setApiState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: null,
                    lastUpdated: now,
                }));
            } catch (err: unknown) {
                if (!isMountedRef.current) return;
                const message = err instanceof Error ? err.message : "Failed to refresh expenses";
                setApiState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: message,
                }));
                console.error(err);
            } finally {
                refreshInFlight.current = null;
            }
        })();

        refreshInFlight.current = refreshPromise;
        return refreshPromise;
    }, [config, user, apiState.isLoading, apiState.lastUpdated]);

    const addExpense = useCallback(
        async (expense: Expense) => {
            if (!user) {
                return;
            }
            const newExpenses = [expense, ...expenses];
            setExpenses(newExpenses);
            await storage.saveExpenses(newExpenses);

            try {
                await api.syncTransaction(user.email, "add", expense);
                await refreshExpenses({ force: true });
            } catch (err) {
                console.error("Failed to add expense:", err);
            }
        },
        [expenses, user, refreshExpenses]
    );

    const updateExpense = useCallback(
        async (expense: Expense) => {
            if (!user) return;
            const newExpenses = expenses.map((e) =>
                e.timestamp === expense.timestamp ? expense : e
            );
            setExpenses(newExpenses);
            await storage.saveExpenses(newExpenses);

            try {
                await api.syncTransaction(user.email, "edit", expense);
                await refreshExpenses({ force: true });
            } catch (err) {
                console.error("Failed to update expense:", err);
            }
        },
        [expenses, user, refreshExpenses]
    );

    const deleteExpense = useCallback(
        async (timestamp: string) => {
            if (!user) return;
            const expenseToDelete = expenses.find(
                (e) => e.timestamp === timestamp
            );
            if (!expenseToDelete) return;

            const newExpenses = expenses.filter(
                (e) => e.timestamp !== timestamp
            );
            setExpenses(newExpenses);
            await storage.saveExpenses(newExpenses);

            try {
                await api.syncTransaction(
                    user.email,
                    "delete",
                    expenseToDelete
                );
                await refreshExpenses({ force: true });
            } catch (err) {
                console.error("Failed to delete expense:", err);
            }
        },
        [expenses, user, refreshExpenses]
    );

    const value = useMemo(
        () => ({
            expenses,
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
