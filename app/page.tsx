"use client";

import React, { useEffect, useRef, useState } from "react";
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
    const [keyboardViewport, setKeyboardViewport] = useState<{
        height: number;
        top: number;
    } | null>(null);
    const addingExpense = isDialogOpen && expense === null;
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

    useEffect(() => {
        const viewport = window.visualViewport;
        if (!addingExpense || !viewport) return;

        const updateViewport = () => {
            // The mobile keyboard shrinks the visual viewport without resizing the layout viewport.
            const obscuredHeight = document.documentElement.clientHeight - viewport.height;
            const keyboardOpen = viewport.scale === 1 && obscuredHeight > 120;
            setKeyboardViewport((previous) => {
                if (!keyboardOpen) return null;
                const { height, offsetTop: top } = viewport;
                if (previous?.height === height && previous.top === top) return previous;
                return { height, top };
            });
        };

        updateViewport();
        viewport.addEventListener("resize", updateViewport);
        viewport.addEventListener("scroll", updateViewport);
        return () => {
            viewport.removeEventListener("resize", updateViewport);
            viewport.removeEventListener("scroll", updateViewport);
            setKeyboardViewport(null);
        };
    }, [addingExpense]);

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
                keyboardOpen={keyboardViewport !== null}
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
                    className={
                        expense
                            ? "sm:max-w-2xl bg-surface max-h-[80vh] overflow-auto"
                            : "sm:max-w-2xl bg-surface max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-clip p-0 transition-none"
                    }
                    style={
                        addingExpense && keyboardViewport
                            ? {
                                  top: keyboardViewport.top + keyboardViewport.height / 2,
                                  maxHeight: keyboardViewport.height - 16,
                              }
                            : undefined
                    }
                    onCloseAutoFocus={(event) => {
                        if (showSaved) {
                            event.preventDefault();
                            savedNoticeRef.current?.focus();
                        }
                    }}
                >
                    <DialogHeader className={expense ? undefined : "px-4 py-3 pr-12"}>
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
