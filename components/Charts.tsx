import React, { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    Legend,
    Cell, // Import Cell for individual bar coloring
} from "recharts";
import { Expense } from "../src/types";
import { useAuthState } from "../src/stores/AuthStore";

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

export const ExpenseBarChart: React.FC<Props> = ({ expenses }) => {
    const { user } = useAuthState();
    const data = useMemo(() => {
        const categoryMap: Record<string, number> = {};

        if (!user || !user.email) {
            return [];
        }

        expenses.forEach((expense) => {
            const userShare = expense.splitsJson[user.email];
            if (userShare) {
                if (categoryMap[expense.category]) {
                    categoryMap[expense.category] += userShare;
                } else {
                    categoryMap[expense.category] = userShare;
                }
            }
        });

        return Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [expenses, user]);

    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-400">
                No expense data to display
            </div>
        );
    }

    const renderLegend = () => {
        return (
            <div className="flex flex-wrap justify-start gap-x-4 gap-y-2 text-xs">
                {data.map((entry, index) => (
                    <div
                        key={`item-${index}`}
                        className="flex items-center gap-1.5"
                    >
                        <div
                            className="w-3 h-3"
                            style={{
                                backgroundColor: COLORS[index % COLORS.length],
                            }}
                        />
                        <span>{entry.name}</span>
                    </div>
                ))}
            </div>
        );
    };

    const renderTooltip = (props: any) => {
        const { active, payload } = props;
        const isVisible = active && payload && payload.length;
        if (isVisible) {
            const { name, value } = payload[0].payload;
            return (
                <div className="bg-white border border-gray-300 p-2 rounded shadow">
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-gray-500">{value.toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={`w-full`} style={{ height: `${data.length * 50}px` }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={data}
                    margin={{
                        top: 5,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis hide dataKey="name" type="category" />
                    <Tooltip
                        formatter={(value: number) => value.toFixed(2)}
                        content={renderTooltip}
                    />
                    <Legend content={renderLegend} />
                    <Bar dataKey="value" barSize={15} radius={[0, 4, 4, 0]}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
