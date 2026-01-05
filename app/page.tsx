"use client";

import React, { useState, useRef, useEffect } from "react";
import { ExpenseList } from "../components/ExpenseList";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useConfig } from "../src/stores/ConfigStore";
import { useAuth } from "../src/stores/AuthStore";
import { ExpenseForm } from "../components/ExpenseForm";
import {
    AddExpenseRequest,
    EditExpenseRequest,
    Expense,
    isAddExpenseRequest,
} from "../src/types";

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
    const [expense, setExpense] = useState<Expense | null>(null);

    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const clickOutside = (e: MouseEvent) => {
            if (e.target === dialogRef.current) {
                e.stopPropagation();
                dialogRef.current?.close();
            }
        };

        dialogRef.current?.addEventListener("click", clickOutside);

        return () => {
            dialogRef.current?.removeEventListener("click", clickOutside);
        };
    }, []);

    const openExpenseForm = (expense?: Expense) => {
        if (expense) {
            console.log("Editing expense:", expense);
            setExpense(expense);
        } else {
            setExpense(null);
        }
        dialogRef.current?.showModal();
    };

    const closeExpenseForm = () => {
        dialogRef.current?.close();
    };

    const handleSaveExpense = async (
        expense: AddExpenseRequest | EditExpenseRequest
    ) => {
        if (!isAddExpenseRequest(expense)) {
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
                >
                    <ExpenseForm
                        initialData={expense}
                        onSave={handleSaveExpense}
                        onCancel={closeExpenseForm}
                    />
                </dialog>
            )}
        </div>
    );
};

export default MainPage;
