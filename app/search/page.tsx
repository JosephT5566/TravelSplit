"use client";

import React from "react";
import { ExpenseSearch } from "../../components/ExpenseSearch";
import { useAppContext } from "../../components/AppContext";

const SearchPageContent: React.FC = () => {
    const { expenses, openEditForm, handleDeleteExpense } = useAppContext();

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen animate-in fade-in duration-200">
            <ExpenseSearch
                expenses={expenses}
                onEdit={openEditForm}
                onDelete={handleDeleteExpense}
            />
        </div>
    );
};

export default SearchPageContent;
