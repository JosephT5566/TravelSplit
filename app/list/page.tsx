"use client";

import React from "react";
import { ExpenseList } from "../../components/ExpenseList";
import { useAppContext } from "../../components/AppContext";

const ListPageContent: React.FC = () => {
    const {
        expenses,
        currentDate,
        setCurrentDate,
        openEditForm,
        handleDeleteExpense,
        config,
    } = useAppContext();

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <ExpenseList
                expenses={expenses}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onEdit={openEditForm}
                onDelete={handleDeleteExpense}
                baseCurrency={config?.baseCurrency || "TWD"}
            />
        </div>
    );
};

export default ListPageContent;
