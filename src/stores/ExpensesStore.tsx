"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { storage } from "../../services/storage";
import { api } from "../../services/api";
import { Expense, ApiState } from "../types";
import { useAuth } from "./AuthStore";
import { useConfig } from "./ConfigStore";

interface ExpensesContextValue {
    expenses: Expense[];
    apiState: ApiState;
    refreshExpenses: () => Promise<void>;
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

    const { user } = useAuth();
    const { config } = useConfig();

    useEffect(() => {
        const loadStoredExpenses = async () => {
            const storedExpenses = await storage.getExpenses();
            if (storedExpenses) {
                setExpenses(storedExpenses);
            }
        };
        loadStoredExpenses();
    }, []);

    const refreshExpenses = useCallback(async () => {
        if (!config?.gasUrl || !user?.email) return;

        setApiState((prev) => ({ ...prev, isLoading: true, error: null }));
        try {
            const data = await api.getExpenses(user.email);
            setExpenses(data);
            await storage.saveExpenses(data);
            setApiState((prev) => ({
                ...prev,
                isLoading: false,
                lastUpdated: Date.now(),
            }));
        } catch (err: any) {
            setApiState((prev) => ({
                ...prev,
                isLoading: false,
                error: err.message,
            }));
            console.error(err);
        }
    }, [config, user]);

    const addExpense = useCallback(async (expense: Expense) => {
        if (!user) return;
        const newExpenses = [expense, ...expenses];
        setExpenses(newExpenses);
        await storage.saveExpenses(newExpenses);

        try {
            await api.syncTransaction(user.email, "add", expense);
            await refreshExpenses();
        } catch (err) {
            console.error("Failed to add expense:", err);
        }
    }, [expenses, user, refreshExpenses]);

    const updateExpense = useCallback(async (expense: Expense) => {
        if (!user) return;
        const newExpenses = expenses.map(e => e.id === expense.id ? expense : e);
        setExpenses(newExpenses);
        await storage.saveExpenses(newExpenses);

        try {
            await api.syncTransaction(user.email, "edit", expense);
            await refreshExpenses();
        } catch (err) {
            console.error("Failed to update expense:", err);
        }
    }, [expenses, user, refreshExpenses]);

    const deleteExpense = useCallback(async (id: string) => {
        if (!user) return;
        const expenseToDelete = expenses.find(e => e.id === id);
        if (!expenseToDelete) return;

        const newExpenses = expenses.filter(e => e.id !== id);
        setExpenses(newExpenses);
        await storage.saveExpenses(newExpenses);

        try {
            await api.syncTransaction(user.email, "delete", expenseToDelete);
            await refreshExpenses();
        } catch (err) {
            console.error("Failed to delete expense:", err);
        }
    }, [expenses, user, refreshExpenses]);

    const value = useMemo(
        () => ({
            expenses,
            apiState,
            refreshExpenses,
            addExpense,
            updateExpense,
            deleteExpense,
        }),
        [expenses, apiState, refreshExpenses, addExpense, updateExpense, deleteExpense]
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
