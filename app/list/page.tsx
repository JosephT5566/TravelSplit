"use client";

import React from "react";
// import { ExpenseList } from "../../components/ExpenseList";
import { useExpenses } from "../../src/stores/ExpensesStore";
import { useUI } from "../../src/stores/UIStore";
import { useConfig } from "../../src/stores/ConfigStore";

const ListPageContent: React.FC = () => {
    const { expenses, deleteExpense } = useExpenses();
    const { currentDate, setCurrentDate, openExpenseForm } = useUI();
    const { config } = useConfig();

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {/* <ExpenseList
                expenses={expenses}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onEdit={openExpenseForm}
                onDelete={deleteExpense}
                baseCurrency={config?.baseCurrency || "TWD"}
            /> */}
        </div>
    );
};

export default ListPageContent;
