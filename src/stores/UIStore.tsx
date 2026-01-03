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
    formDefaultDate: Date;
    openExpenseForm: (expense?: Expense | null, defaultDate?: Date) => void;
    closeExpenseForm: () => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [showForm, setShowForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [formDefaultDate, setFormDefaultDate] = useState(new Date());

    const openExpenseForm = useCallback((expense: Expense | null = null, defaultDate?: Date) => {
        setEditingExpense(expense);
        if (expense) {
            setFormDefaultDate(new Date(expense.date));
        } else {
            setFormDefaultDate(defaultDate || new Date());
        }
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
            formDefaultDate,
            openExpenseForm,
            closeExpenseForm,
        }),
        [
            showForm,
            editingExpense,
            formDefaultDate,
            openExpenseForm,
            closeExpenseForm,
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
