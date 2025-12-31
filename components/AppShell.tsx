"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { LoginView } from "./LoginView";
import { useAuth } from "../src/stores/AuthStore";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useUI } from "../src/stores/UIStore";
import { Expense } from "../src/types";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { user, isInitialized } = useAuth();
    const { addExpense, updateExpense } = useExpenses();
    const {
        editingExpense,
        closeExpenseForm,
        openExpenseForm,
    } = useUI();

    const handleSaveExpense = async (expense: Expense) => {
        if (editingExpense) {
            await updateExpense(expense);
        } else {
            await addExpense(expense);
        }
        closeExpenseForm();
    };

    if (!isInitialized) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }
    
    if (!user) {
        return <LoginView />;
    }

    return (
        <div className="min-h-screen bg-background text-text-main font-sans transition-colors duration-300">
            <Layout onAddClick={() => openExpenseForm()}>
                {children}
            </Layout>

            {/* {showForm && user && (
                <ExpenseForm
                    initialData={editingExpense}
                    defaultDate={currentDate}
                    currentUser={user}
                    onSave={handleSaveExpense}
                    onCancel={closeExpenseForm}
                />
            )} */}
        </div>
    );
}

