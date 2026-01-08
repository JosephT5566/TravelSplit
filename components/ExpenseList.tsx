import React, { useMemo, useState, useRef, useEffect } from "react";
import { Expense } from "../src/types";
import { format, addDays, formatDate } from "date-fns";
import {
    ArrowLeft,
    ArrowRight,
    Calendar,
    Trash2,
    Plus,
    RefreshCw,
    Loader2,
} from "lucide-react";
import { useAuthState } from "@/src/stores/AuthStore";
import { useDeleteExpense } from "../services/dataFetcher";
import { useConfig } from "@/src/stores/ConfigStore";

interface Props {
    expenses: Expense[];
    onOpenExpenseForm: (expense?: Expense) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
}

export const ExpenseList: React.FC<Props> = ({
    expenses,
    onOpenExpenseForm,
    onRefresh,
    isRefreshing,
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const { user } = useAuthState();
    const { sheetConfig } = useConfig();
    const dateInputRef = useRef<HTMLInputElement>(null);
    const minDateStr = sheetConfig?.startDate
        ? format(new Date(sheetConfig?.startDate), "yyyy-MM-dd")
        : undefined;
    const isToday =
        format(currentDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

    const { mutateAsync: deleteExpenseMutation, isPending: isDeletingExpense } =
        useDeleteExpense(user?.email);

    const dailyExpenses = useMemo(() => {
        const formattedCurrentDate = format(currentDate, "yyyy-MM-dd");

        return expenses.filter((e) => {
            if (!e || !e.date) {
                return false;
            }
            const d = new Date(e.date);
            // Check if the date is valid
            if (isNaN(d.getTime())) {
                return false;
            }
            return format(d, "yyyy-MM-dd") === formattedCurrentDate;
        });
    }, [expenses, currentDate]);

    const dailyTotal = useMemo(() => {
        return dailyExpenses.reduce((acc, curr) => {
            if (!user) {
                return acc;
            }
            const amount = curr.splitsJson[user.email] || 0;
            return acc + amount;
        }, 0);
    }, [dailyExpenses]);

    return (
        <div className="pb-20">
            {/* Date Navigator */}
            <div className="bg-surface shadow-sm mb-4 rounded-xl overflow-hidden border border-border">
                <div className="flex items-center justify-between p-2">
                    <button
                        onClick={() => setCurrentDate(addDays(currentDate, -1))}
                        className="p-2 rounded-full hover:bg-background text-primary transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>

                    <div
                        className="flex flex-col items-center relative"
                        onClick={() => dateInputRef.current?.showPicker()}
                    >
                        <label className="text-lg font-bold flex items-center gap-2 cursor-pointer hover:text-primary transition-colors text-text-main">
                            {format(currentDate, "MMM dd, E")}
                            <input
                                type="date"
                                ref={dateInputRef}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                min={minDateStr}
                                max={formatDate(new Date(), "yyyy-MM-dd")}
                                value={dateStr}
                                onChange={(e) => {
                                    if (!e.target.value) {
                                        // clear date
                                        setCurrentDate(new Date());
                                    }
                                    if (e.target.valueAsDate) {
                                        setCurrentDate(e.target.valueAsDate);
                                    }
                                }}
                            />
                        </label>
                        <span className="text-xs text-text-muted">
                            {format(currentDate, "yyyy")}
                        </span>
                    </div>

                    <button
                        onClick={() => setCurrentDate(addDays(currentDate, 1))}
                        className="p-2 rounded-full hover:bg-background text-primary transition-colors disabled:opacity-50"
                        disabled={isToday}
                    >
                        <ArrowRight size={24} />
                    </button>
                </div>

                {/* Daily Summary Bar */}
                <div className="px-4 py-2 bg-background border-t border-border flex justify-between items-center text-sm">
                    <span className="text-text-muted">Daily Total</span>
                    <span className="font-bold text-accent">
                        {`${dailyTotal.toFixed(1)} TWD`}
                    </span>
                </div>
            </div>

            {/* Action Bar (Refresh) */}
            <div className="flex justify-end mb-2 px-2 gap-2">
                <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="text-sm flex items-center gap-1 text-primary font-medium bg-surface border border-border px-3 py-1.5 rounded-full hover:bg-background disabled:opacity-50"
                >
                    <RefreshCw
                        size={14}
                        className={isRefreshing ? "animate-spin" : ""}
                    />
                    Refresh
                </button>
            </div>

            {/* List */}
            <div className="space-y-3">
                {dailyExpenses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 border border-border">
                            <Calendar size={24} />
                        </div>
                        <p>No expenses for this day.</p>
                        <p className="text-xs mt-1">Tap + to add one.</p>
                    </div>
                ) : (
                    dailyExpenses.map((exp) => (
                        <div
                            key={exp.timestamp}
                            className="bg-surface p-4 rounded-xl shadow flex justify-between items-center border border-border hover:border-primary transition-all cursor-pointer"
                            onClick={() => onOpenExpenseForm(exp)}
                        >
                            <div className="flex-1">
                                <div className="flex items-center justify-between pr-4">
                                    <h4 className="font-semibold text-text-main">
                                        {exp.itemName}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 rounded bg-background text-text-muted border border-border">
                                        {exp.category}
                                    </span>
                                    <span className="text-xs text-text-muted">
                                        {exp.payer.split("@")[0]}
                                    </span>
                                </div>
                            </div>

                            <div className="text-right pl-2">
                                {user && (
                                    <>
                                        <span className="text-lg font-bold text-accent">
                                            {exp.splitsJson[user.email]}
                                        </span>
                                        <span className="text-xs text-text-muted font-medium pl-1">
                                            TWD
                                        </span>
                                    </>
                                )}

                                <div className="flex gap-3 justify-end mt-2 opacity-50 hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!exp.timestamp) {
                                                return;
                                            }
                                            if (confirm("真的要刪嗎？")) {
                                                console.log(
                                                    "Deleting expense with timestamp:",
                                                    exp.timestamp
                                                );
                                                deleteExpenseMutation(
                                                    exp.timestamp
                                                );
                                            }
                                        }}
                                        className="flex gap-1 text-text-muted hover:text-red-500"
                                        disabled={isDeletingExpense}
                                    >
                                        {isDeletingExpense && (
                                            <Loader2
                                                className="animate-spin"
                                                size={16}
                                            />
                                        )}
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <button
                onClick={() => onOpenExpenseForm()}
                className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-fg rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-transform hover:scale-105 active:scale-95 z-40"
                aria-label="Add Expense"
            >
                <Plus size={28} />
            </button>
        </div>
    );
};
