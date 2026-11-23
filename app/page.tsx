"use client";

import React, { useRef, useState } from "react";
import { ExpenseList } from "../components/ExpenseList";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useAuthState } from "../src/stores/AuthStore";
import { ExpenseForm } from "../components/ExpenseForm";
import { AddExpenseRequest, Expense } from "../src/types";
import ExpenseDetail from "@/components/ExpenseDetail";
import { useAddExpense } from "@/services/dataFetcher";
import { useSelectedSheetId } from "@/src/hooks/useSelectedSheetId";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

function ExpensePage({
    sheetId,
    userEmail,
}: {
    sheetId: string;
    userEmail: string;
}) {
    const { expenses, refreshExpenses, apiState } = useExpenses();
    const [expense, setExpense] = useState<Expense | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showSaved, setShowSaved] = useState(false);
    const savedNoticeRef = useRef<HTMLParagraphElement>(null);
    const submitLock = useRef<"idle" | "saving" | "saved" | "unknown">("idle");
    const {
        mutate: addExpense,
        reset: resetAddExpense,
        isPending,
        isError,
        data: result,
    } = useAddExpense(sheetId, userEmail);
    const submitState = isPending ? "saving" : isError ? "unknown" : result ?? "idle";

    const openExpenseForm = (expense?: Expense) => {
        if (submitLock.current === "saving") return;
        submitLock.current = "idle";
        resetAddExpense();
        setShowSaved(false);
        setExpense(expense ?? null);
        setIsDialogOpen(true);
    };

    const closeExpenseForm = () => {
        if (submitLock.current !== "saving") setIsDialogOpen(false);
    };

    const saveExpense = (request: AddExpenseRequest) => {
        if (submitLock.current !== "idle") return;

        submitLock.current = "saving";
        addExpense(request, {
            onSuccess: (result) => {
                if (result === "saved") {
                    setIsDialogOpen(false);
                    setShowSaved(true);
                }
            },
            onSettled: (result) => {
                submitLock.current = result === "rejected" ? "idle" : result ?? "unknown";
            },
        });
    };

    const renderContent = () => {
        return expense == null ? (
            <ExpenseForm
                onCancel={closeExpenseForm}
                onSave={saveExpense}
                submitState={submitState}
                userEmail={userEmail}
                isDialogOpen={isDialogOpen}
                selectedDate={currentDate}
            />
        ) : (
            <ExpenseDetail expense={expense} onCancel={closeExpenseForm} />
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <p
                ref={savedNoticeRef}
                role="status"
                tabIndex={showSaved ? -1 : undefined}
                className="mx-4 my-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-main empty:sr-only focus:outline-2 focus:outline-offset-2 focus:outline-current"
            >
                {showSaved ? "支出已儲存" : ""}
            </p>
            <ExpenseList
                expenses={expenses}
                onOpenExpenseForm={openExpenseForm}
                onRefresh={refreshExpenses}
                isRefreshing={apiState.isFetching}
                onCurrentDateChange={setCurrentDate}
            />

            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open) closeExpenseForm();
                }}
            >
                <DialogContent
                    showCloseButton={!isPending}
                    className="sm:max-w-2xl bg-surface max-h-[80vh] overflow-auto"
                    onCloseAutoFocus={(event) => {
                        if (showSaved) {
                            event.preventDefault();
                            savedNoticeRef.current?.focus();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {expense ? "編輯支出" : "新增支出"}
                        </DialogTitle>
                        <DialogDescription className="hidden">
                            {expense
                                ? "在此查看和編輯支出詳情。"
                                : "填寫下列表單以新增支出。"}
                        </DialogDescription>
                    </DialogHeader>
                    {renderContent()}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function MainPage() {
    const { user } = useAuthState();
    const sheetId = useSelectedSheetId();

    if (!user || !sheetId) return null;

    return (
        <ExpensePage
            key={JSON.stringify([sheetId, user.email])}
            sheetId={sheetId}
            userEmail={user.email}
        />
    );
}
