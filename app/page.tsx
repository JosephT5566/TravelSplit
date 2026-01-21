"use client";

import React, { useState, useRef, useEffect } from "react";
import { ExpenseList } from "../components/ExpenseList";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useAuthState } from "../src/stores/AuthStore";
import { ExpenseForm } from "../components/ExpenseForm";
import { Expense } from "../src/types";
import ExpenseDetail from "@/components/ExpenseDetail";

const MainPage: React.FC = () => {
    const { expenses, refreshExpenses, apiState } = useExpenses();
    const { user } = useAuthState();
    const [expense, setExpense] = useState<Expense | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const clickOutside = (e: MouseEvent) => {
            if (e.target === dialogRef.current) {
                e.stopPropagation();
                dialogRef.current?.close();
            }
        };

        const handleDialogClosed = () => {
            setIsDialogOpen(false);
        };

        dialogRef.current?.addEventListener("click", clickOutside);
        dialogRef.current?.addEventListener("close", handleDialogClosed);

        return () => {
            dialogRef.current?.removeEventListener("click", clickOutside);
            dialogRef.current?.removeEventListener("close", handleDialogClosed);
        };
    }, []);

    const openExpenseForm = (expense?: Expense) => {
        if (expense) {
            console.log("Editing expense:", expense);
            setExpense(expense);
        } else {
            setExpense(null);
        }
        setIsDialogOpen(true);
        dialogRef.current?.showModal();
    };

    const closeExpenseForm = () => {
        dialogRef.current?.close();
    };

    const handleDialogClose = () => {
        setExpense(null);
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <ExpenseList
                expenses={expenses}
                onOpenExpenseForm={openExpenseForm}
                onRefresh={refreshExpenses}
                isRefreshing={apiState.isFetching}
                onCurrentDateChange={setCurrentDate}
            />

            {user && (
                <dialog ref={dialogRef} onClose={handleDialogClose}>
                    {expense == null ? (
                        <ExpenseForm
                            onCancel={closeExpenseForm}
                            isDialogOpen={isDialogOpen}
                            selectedDate={currentDate}
                        />
                    ) : (
                        <ExpenseDetail
                            expense={expense}
                            onCancel={closeExpenseForm}
                        />
                    )}
                </dialog>
            )}
        </div>
    );
};

export default MainPage;
