"use client";

import React from "react";
import { ExpenseSearch } from "../../components/ExpenseSearch";
import { useExpenses } from "../../src/stores/ExpensesStore";
import { useUI } from "../../src/stores/UIStore";

const SearchPageContent: React.FC = () => {
    const { expenses, deleteExpense } = useExpenses();
    const { openExpenseForm } = useUI();

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen animate-in fade-in duration-200">
            {/* <ExpenseSearch
                expenses={expenses}
                onEdit={openExpenseForm}
                onDelete={deleteExpense}
            /> */}
        </div>
    );
};

export default SearchPageContent;
