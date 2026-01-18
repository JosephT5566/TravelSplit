import React, { useRef, useMemo } from "react";
import { format, addDays, isToday, isSameDay } from "date-fns";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Expense } from "../src/types";
import { useConfig } from "../src/stores/ConfigStore";

interface DateNavigatorProps {
    currentDate: Date;
    goToDate: (date: Date) => void;
    minDateStr?: string;
    maxDateStr?: string;
    expenses: Expense[];
    user: any;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
    currentDate,
    goToDate,
    minDateStr,
    maxDateStr,
    expenses,
    user
}) => {
    const { sheetConfig } = useConfig();
    const dateInputRef = useRef<HTMLInputElement>(null);
    const formattedCurrentDate = format(currentDate, "yyyy-MM-dd");

    const dailyTotal = useMemo(() => {
        const formattedDate = format(currentDate, "yyyy-MM-dd");
        const dailyExpenses = expenses.filter((e) => {
            if (!e || !e.date) return false;
            const d = new Date(e.date);
            if (isNaN(d.getTime())) return false;
            return format(d, "yyyy-MM-dd") === formattedDate;
        });

        return dailyExpenses.reduce((acc, curr) => {
            if (!user) return acc;
            const amount = curr.splitsJson[user.email] || 0;
            return acc + amount;
        }, 0);
    }, [expenses, currentDate, user]);

    const isNextDisabled = useMemo(() => {
        if (!sheetConfig.endDate) {
            return isToday(currentDate);
        }
        console.log("is same day:", isSameDay(currentDate, new Date(sheetConfig.endDate)));
        return isSameDay(currentDate, new Date(sheetConfig.endDate));
    }, [currentDate, sheetConfig.endDate]);

    const isPrevDisabled = useMemo(() => {
        if (!sheetConfig.startDate) {
            return false; // Or some other logic if startDate is not guaranteed
        }
        return isSameDay(currentDate, new Date(sheetConfig.startDate));
    }, [currentDate, sheetConfig.startDate]);


    return (
        <div className="m-4 bg-surface shadow-sm mb-4 rounded-xl overflow-hidden border border-border">
            <div className="flex items-center justify-between p-2">
                <button
                    onClick={() => goToDate(addDays(currentDate, -1))}
                    className="p-2 rounded-full hover:bg-background text-primary transition-colors disabled:opacity-50"
                    disabled={isPrevDisabled}
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
                            max={maxDateStr}
                            value={formattedCurrentDate}
                            onChange={(e) => {
                                if (e.target.valueAsDate) {
                                    goToDate(e.target.valueAsDate);
                                }
                            }}
                        />
                    </label>
                    <span className="text-xs text-text-muted">
                        {format(currentDate, "yyyy")}
                    </span>
                </div>

                <button
                    onClick={() => goToDate(addDays(currentDate, 1))}
                    className="p-2 rounded-full hover:bg-background text-primary transition-colors disabled:opacity-50"
                    disabled={isNextDisabled}
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
    );
};