import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Expense } from "../src/types";
import { format, addDays } from "date-fns";
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Calendar,
    Edit2,
    Trash2,
} from "lucide-react";

interface Props {
    expenses: Expense[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onEdit: (e: Expense) => void;
    onDelete: (id: string) => void;
    baseCurrency: string;
}

export const ExpenseList: React.FC<Props> = ({
    expenses,
    currentDate,
    onDateChange,
    onEdit,
    onDelete,
    baseCurrency,
}) => {
    const router = useRouter();
    const dateStr = format(currentDate, "yyyy-MM-dd");

    const dailyExpenses = useMemo(() => {
        return expenses.filter((e) => e.date === dateStr);
    }, [expenses, dateStr]);

    const dailyTotal = useMemo(() => {
        return dailyExpenses.reduce((acc, curr) => {
            const amount = curr.amount;
            return acc - amount;
        }, 0);
    }, [dailyExpenses]);

    return (
        <div className="pb-20">
            {/* Date Navigator */}
            <div className="bg-surface shadow-sm mb-4 rounded-xl overflow-hidden border border-border">
                <div className="flex items-center justify-between p-2">
                    <button
                        onClick={() => onDateChange(addDays(currentDate, -1))}
                        className="p-2 rounded-full hover:bg-background text-text-muted transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="flex flex-col items-center relative">
                        <label className="text-lg font-bold flex items-center gap-2 cursor-pointer hover:text-primary transition-colors text-text-main">
                            {format(currentDate, "EEE, MMM d")}
                            <input
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                value={dateStr}
                                onChange={(e) => {
                                    if (e.target.valueAsDate)
                                        onDateChange(e.target.valueAsDate);
                                }}
                            />
                        </label>
                        <span className="text-xs text-text-muted">
                            {format(currentDate, "yyyy")}
                        </span>
                    </div>

                    <button
                        onClick={() => onDateChange(addDays(currentDate, 1))}
                        className="p-2 rounded-full hover:bg-background text-text-muted transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                {/* Daily Summary Bar */}
                <div className="px-4 py-2 bg-background border-t border-border flex justify-between items-center text-sm">
                    <span className="text-text-muted">Daily Total</span>
                    <span
                        className="font-bold text-red-500"
                    >
                        -
                        {baseCurrency} {Math.abs(dailyTotal).toFixed(1)}
                    </span>
                </div>
            </div>

            {/* Action Bar (Search) */}
            <div className="flex justify-end mb-2 px-2">
                <button
                    onClick={() => router.push("/search")}
                    className="text-sm flex items-center gap-1 text-primary font-medium bg-surface border border-border px-3 py-1.5 rounded-full hover:bg-background"
                >
                    <Search size={14} /> Search All
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
                            className="bg-surface p-4 rounded-xl shadow flex justify-between items-center border border-border hover:border-primary transition-all"
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
                                {/* {exp.remark && (
                                    <p className="text-xs text-text-muted mt-1 italic">
                                        "{exp.remark}"
                                    </p>
                                )} */}
                            </div>

                            <div className="text-right pl-2">
                                <p
                                    className="text-lg font-bold text-red-500"
                                >
                                    -{exp.amount}
                                </p>
                                <p className="text-xs text-text-muted font-medium">
                                    {exp.currency}
                                </p>

                                <div className="flex gap-3 justify-end mt-2 opacity-50 hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(exp);
                                        }}
                                        className="text-text-muted hover:text-primary"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (exp.timestamp) {
                                                onDelete(exp.timestamp);
                                            }
                                        }}
                                        className="text-text-muted hover:text-red-500"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
