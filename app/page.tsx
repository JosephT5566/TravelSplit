"use client";

import React, { useState, useRef, useEffect } from "react";
import { ExpenseList } from "../components/ExpenseList";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useConfig } from "../src/stores/ConfigStore";
import { useAuth } from "../src/stores/AuthStore";
import { ExpenseForm } from "../components/ExpenseForm";
import { Expense } from "../src/types";

const MainPage: React.FC = () => {
    const {
        expenses,
        deleteExpense,
        addExpense,
        updateExpense,
        refreshExpenses,
        apiState,
    } = useExpenses();
    const { config } = useConfig();
    const { user } = useAuth();
    const [expense, setExpense] = useState<Partial<Expense> | null>(
        null
    );

    const dialogRef = useRef<HTMLDialogElement>(null);

    const openExpenseForm = (expense?: Expense) => {
        if (expense) {
            setExpense(expense);
        } else {
            setExpense(null);
        }
        dialogRef.current?.showModal();
    };

    const closeExpenseForm = () => {
        dialogRef.current?.close();
    };

    const handleSaveExpense = async (expense: Expense) => {
        if (expense && expense.timestamp) {
            await updateExpense(expense);
        } else {
            await addExpense(expense);
        }
        closeExpenseForm();
    };

    const handleDialogClose = () => {
        setExpense(null);
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <ExpenseList
                expenses={expenses}
                onOpenExpenseForm={openExpenseForm}
                onDelete={deleteExpense}
                baseCurrency={config?.baseCurrency || "TWD"}
                onRefresh={refreshExpenses}
                isRefreshing={apiState.isLoading}
            />

            {user && (
                <dialog
                    ref={dialogRef}
                    onClose={handleDialogClose}
                    className="p-0 m-0 border-none modal bg-transparent fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    closedby="any"
                >
                    <ExpenseForm
                        initialData={expense}
                        currentUser={user}
                        onSave={handleSaveExpense}
                        onCancel={closeExpenseForm}
                    />
                </dialog>
            )}
        </div>
    );
};

export default MainPage;
