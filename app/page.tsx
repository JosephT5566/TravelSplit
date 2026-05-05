"use client";

import React, { useState } from "react";
import { ExpenseList } from "../components/ExpenseList";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useAuthState } from "../src/stores/AuthStore";
import { ExpenseForm } from "../components/ExpenseForm";
import { Expense } from "../src/types";
import ExpenseDetail from "@/components/ExpenseDetail";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

const MainPage: React.FC = () => {
    const { expenses, refreshExpenses, apiState } = useExpenses();
    const { user } = useAuthState();
    const [expense, setExpense] = useState<Expense | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    const openExpenseForm = (expense?: Expense) => {
        if (expense) {
            setExpense(expense);
        } else {
            setExpense(null);
        }
        setIsDialogOpen(true);
    };

    const closeExpenseForm = () => {
        setIsDialogOpen(false);
    };

    const renderContent = () => {
        return expense == null ? (
            <ExpenseForm
                onCancel={closeExpenseForm}
                isDialogOpen={isDialogOpen}
                selectedDate={currentDate}
            />
        ) : (
            <ExpenseDetail expense={expense} onCancel={closeExpenseForm} />
        );
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
                <Drawer
                    open={isDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            closeExpenseForm();
                        }
                    }}
                >
                    <DrawerContent>
                        <DrawerTitle>
                            {expense ? "Edit Expense" : "Add Expense"}
                        </DrawerTitle>
                        {renderContent()}
                    </DrawerContent>
                </Drawer>
            )}
        </div>
    );
};

export default MainPage;
