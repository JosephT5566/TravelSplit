import React, { useMemo } from "react";
import { Expense } from "../src/types";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { ExpenseListItem } from "./ExpenseListItem";

interface DayViewProps {
    date: Date;
    expenses: Expense[];
    onOpenExpenseForm: (expense?: Expense) => void;
}

export const DayView: React.FC<DayViewProps> = ({
    date,
    expenses,
    onOpenExpenseForm,
}) => {
    const dailyExpenses = useMemo(() => {
        const formattedCurrentDate = format(date, "yyyy-MM-dd");
        return expenses.filter((e) => {
            if (!e || !e.date) {
                return false;
            }
            const d = new Date(e.date);
            if (isNaN(d.getTime())) {
                return false;
            }
            return format(d, "yyyy-MM-dd") === formattedCurrentDate;
        });
    }, [expenses, date]);

    return (
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
                    <ExpenseListItem
                        key={exp.timestamp}
                        expense={exp}
                        onOpenExpenseForm={onOpenExpenseForm}
                    />
                ))
            )}
        </div>
    );
};
