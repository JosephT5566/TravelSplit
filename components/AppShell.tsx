"use client";

import React from "react";
import { Layout } from "./Layout";
import { LoginView } from "./LoginView";
import { useAuth } from "../src/stores/AuthStore";
import { useUI } from "../src/stores/UIStore";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { user, isInitialized } = useAuth();
    const {
        openExpenseForm,
    } = useUI();

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

