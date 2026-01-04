"use client";

import React, { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { ExpensePieChart } from "../../components/Charts";
import { useExpenses } from "../../src/stores/ExpensesStore";
import { useConfig } from "../../src/stores/ConfigStore";
import { useAuthState } from "../../src/stores/AuthStore";

const ListPage: React.FC = () => {
    const { expenses, apiState, refreshExpenses } = useExpenses();
    const { user } = useAuthState();
    const { config } = useConfig();
    const baseCurrency = "TWD";

    const totalExpense = expenses.reduce(
        (acc, curr) => acc + Number(curr.splitsJson?.[user.email]),
        0
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-text-main">Overview</h2>
                <button
                    onClick={() => refreshExpenses()}
                    disabled={apiState.isLoading}
                    className={`p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${
                        apiState.isLoading ? "animate-spin" : ""
                    }`}
                    aria-label="Refresh Data"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-surface rounded-xl shadow border-l-4 border-red-500 transition-colors">
                    <p className="text-sm text-text-muted">Total Spent</p>
                    <p
                        className="text-xl font-bold text-red-500 truncate"
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
                <ExpensePieChart expenses={expenses} />
            </div>
        </div>
    );
};

export default ListPage;