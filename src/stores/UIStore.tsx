"use client";

import React, {
    createContext,
    useContext,
    useState,
    useMemo,
    useCallback,
} from "react";
import { Expense } from "../types";

interface UIContextValue {
    showForm: boolean;
    editingExpense: Expense | null;
    currentDate: Date;
    openExpenseForm: (expense?: Expense | null) => void;
    closeExpenseForm: () => void;
    setCurrentDate: (date: Date) => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [showForm, setShowForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    const openExpenseForm = useCallback((expense: Expense | null = null) => {
        setEditingExpense(expense);
        setShowForm(true);
    }, []);

    const closeExpenseForm = useCallback(() => {
        setShowForm(false);
        setEditingExpense(null);
    }, []);

    const value = useMemo(
        () => ({
            showForm,
            editingExpense,
            currentDate,
            openExpenseForm,
            closeExpenseForm,
            setCurrentDate,
        }),
        [
            showForm,
            editingExpense,
            currentDate,
            openExpenseForm,
            closeExpenseForm,
            setCurrentDate,
        ]
    );

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error("useUI must be used within a UIProvider");
    }
    return context;
}
