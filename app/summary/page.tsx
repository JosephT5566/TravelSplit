"use client";

import React, { useMemo } from "react";
import { RefreshCw, ArrowRight, Info } from "lucide-react";
import { ExpenseBarChart } from "../../components/Charts";
import { useExpenses } from "../../src/stores/ExpensesStore";
import { useConfig } from "../../src/stores/ConfigStore";
import { useAuthState } from "../../src/stores/AuthStore";
import { calculateSettlements } from "@/src/utils/settlements";

const SummaryPage: React.FC = () => {
    const { expenses, apiState, refreshExpenses } = useExpenses();
    const { user } = useAuthState();
    const { sheetConfig } = useConfig();
    const baseCurrency = "TWD";

    const totalExpense = expenses.reduce((acc, curr) => {
        if (!user) {
            return acc;
        }
        return acc + Number(curr.splitsJson?.[user.email]);
    }, 0);

    const settlements = useMemo(() => {
        if (!user || !sheetConfig?.users) {
            return [];
        }

        return calculateSettlements({
            expenses,
            currentUserEmail: user.email,
            users: sheetConfig.users,
        });
    }, [expenses, user, sheetConfig]);

    return (
        <div className="space-y-6 p-4 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-text-main">Overview</h2>
                <button
                    onClick={() => refreshExpenses()}
                    disabled={apiState.isFetching}
                    className={`p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${
                        apiState.isFetching ? "animate-spin" : ""
                    }`}
                    aria-label="Refresh Data"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-surface rounded-xl shadow border-l-4 border-accent transition-colors">
                    <p className="text-sm text-text-muted">Total Spent</p>
                    <p
                        className="text-xl font-bold text-accent truncate"
                        title={`${baseCurrency} ${totalExpense.toFixed(2)}`}
                    >
                        {baseCurrency} {totalExpense.toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="bg-surface p-4 rounded-xl shadow transition-colors border border-border">
                <h3 className="font-semibold mb-4 text-text-main">
                    Category Breakdown
                </h3>
                <ExpenseBarChart expenses={expenses} />
            </div>

            <div className="bg-surface p-4 rounded-xl shadow transition-colors border border-border">
                <h3 className="font-semibold mb-4 text-text-main flex items-center justify-between">
                    Who Owes Who
                    <div
                        className="tooltip tooltip-left text-text-muted cursor-help"
                        data-tip="僅供參考，無計算 is settled，實際金額以表格為主"
                    >
                        <Info size={16} />
                    </div>
                </h3>
                {settlements.length > 0 ? (
                    <div className="space-y-3">
                        {settlements.map(({ email, balance }) => {
                            const userName =
                                sheetConfig?.users?.[email] || "Unknown User";

                            if (balance < 0) {
                                // I owe them
                                return (
                                    <div
                                        key={email}
                                        className="flex items-center justify-between p-3 rounded-lg bg-red-500/10"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                我
                                            </span>
                                            <ArrowRight
                                                size={16}
                                                className="text-text-muted"
                                            />
                                            <span className="font-medium">
                                                {userName}
                                            </span>
                                        </div>
                                        <span className="font-bold text-red-500">
                                            {baseCurrency} {Math.abs(balance).toFixed(2)}
                                        </span>
                                    </div>
                                );
                            } else {
                                // They owe me
                                return (
                                    <div
                                        key={email}
                                        className="flex items-center justify-between p-3 rounded-lg bg-green-500/10"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {userName}
                                            </span>
                                            <ArrowRight
                                                size={16}
                                                className="text-text-muted"
                                            />
                                            <span className="font-medium">
                                                我
                                            </span>
                                        </div>
                                        <span className="font-bold text-green-500">
                                            {baseCurrency}{" "}
                                            {Math.abs(balance).toFixed(2)}
                                        </span>
                                    </div>
                                );
                            }
                        })}
                    </div>
                ) : (
                    <p className="text-text-muted text-center py-4">
                        All settled up!
                    </p>
                )}
            </div>
        </div>
    );
};

export default SummaryPage;
