import React, { useMemo } from "react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from "recharts";
import { Expense, TransactionType } from "../types";

interface Props {
    expenses: Expense[];
}

const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#AF19FF",
    "#FF4560",
];

export const ExpensePieChart: React.FC<Props> = ({ expenses }) => {
    const data = useMemo(() => {
        const categoryMap: Record<string, number> = {};

        expenses.forEach((exp) => {
            // Only count actual expenses (negative amounts logic)
            if (exp.type === TransactionType.EXPENSE) {
                const amountInBase = exp.amount * exp.exchangeRate;
                categoryMap[exp.category] =
                    (categoryMap[exp.category] || 0) + amountInBase;
            }
        });

        return Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [expenses]);

    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-400">
                No expense data to display
            </div>
        );
    }

    return (
        <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                        }
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                            />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
