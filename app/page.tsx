"use client";

import React from "react";
import { ExpenseList } from "../components/ExpenseList";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useUI } from "../src/stores/UIStore";
import { useConfig } from "../src/stores/ConfigStore";
import { useAuth } from "../src/stores/AuthStore";
import { ExpenseForm } from "../components/ExpenseForm";
import { Expense } from "../src/types";

const MainPage: React.FC = () => {
    const { expenses, deleteExpense, addExpense, updateExpense } = useExpenses();
    const { showForm, editingExpense, openExpenseForm, closeExpenseForm } = useUI();
    const { config } = useConfig();
    const { user } = useAuth();

    const handleSaveExpense = async (expense: Expense) => {
        if (editingExpense) {
            await updateExpense(expense);
        } else {
            await addExpense(expense);
        }
        closeExpenseForm();
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <ExpenseList
                expenses={expenses}
                onEdit={openExpenseForm}
                onDelete={deleteExpense}
                baseCurrency={config?.baseCurrency || "TWD"}
                onAdd={openExpenseForm}
            />

            {showForm && user && (
                <ExpenseForm
                    initialData={editingExpense}
                    currentUser={user}
                    onSave={handleSaveExpense}
                    onCancel={closeExpenseForm}
                />
            )}
        </div>
    );
};

export default MainPage;