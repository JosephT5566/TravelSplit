import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Expense } from "../src/types";
import { Search, ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
    expenses: Expense[];
    onEdit: (e: Expense) => void;
    onDelete: (id: string) => void;
}

export const ExpenseSearch: React.FC<Props> = ({
    expenses,
    onEdit,
    onDelete,
}) => {
    const router = useRouter();
    const [query, setQuery] = useState("");

    const groupedResults = useMemo(() => {
        if (!query) return [];

        const lowerQuery = query.toLowerCase();
        const filtered = expenses
            .filter(
                (e) =>
                    e.itemName.toLowerCase().includes(lowerQuery) ||
                    e.category.toLowerCase().includes(lowerQuery) ||
                    e.payer.toLowerCase().includes(lowerQuery) ||
                    e.amount.toString().includes(lowerQuery)
            )
            .sort(
                (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
            );

        // Group by date
        const groups: { date: string; items: Expense[] }[] = [];
        filtered.forEach((exp) => {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.date === exp.date) {
                lastGroup.items.push(exp);
            } else {
                groups.push({ date: exp.date, items: [exp] });
            }
        });
        return groups;
    }, [expenses, query]);

    // Helper to parse YYYY-MM-DD as local date for formatting
    const parseLocalYMD = (ymd: string) => {
        const [y, m, d] = ymd.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="p-4 bg-surface shadow sticky top-0 z-10 flex items-center gap-3 border-b border-border">
                <button
                    onClick={() => router.back()}
                    className="text-text-muted hover:text-text-main"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1 relative">
                    <Search
                        className="absolute left-3 top-2.5 text-text-muted"
                        size={18}
                    />
                    <input
                        type="text"
                        autoFocus
                        placeholder="Search item, category, payer..."
                        className="w-full pl-10 p-2 rounded-lg bg-background border-transparent focus:bg-surface border border-transparent focus:border-primary outline-none transition-all text-text-main"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="p-4 space-y-6">
                {groupedResults.length === 0 && query && (
                    <div className="text-center text-text-muted mt-10">
                        <p>No results found for "{query}"</p>
                    </div>
                )}

                {groupedResults.length === 0 && !query && (
                    <div className="text-center text-text-muted mt-10">
                        <Search className="mx-auto mb-2 opacity-20" size={48} />
                        <p>Type to search across all dates</p>
                    </div>
                )}

                {groupedResults.map((group) => (
                    <div key={group.date}>
                        <h3 className="text-sm font-bold text-text-muted mb-2 sticky top-20 bg-background py-1 z-0">
                            {format(
                                parseLocalYMD(group.date),
                                "EEE, MMM d, yyyy"
                            )}
                        </h3>
                        <div className="space-y-3">
                            {group.items.map((exp) => (
                                <div
                                    key={exp.timestamp}
                                    className="bg-surface p-4 rounded-xl shadow flex justify-between items-center border border-border"
                                >
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-text-main">
                                            {exp.itemName}
                                        </h4>
                                        <p className="text-sm text-text-muted">
                                            {exp.category} •{" "}
                                            {exp.payer.split("@")[0]}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p
                                            className="font-bold text-red-500"
                                        >
                                            -
                                            {exp.amount}{" "}
                                            <span className="text-xs text-text-muted">
                                                {exp.currency}
                                            </span>
                                        </p>
                                        <div className="flex gap-3 justify-end mt-1">
                                            <button
                                                onClick={() => onEdit(exp)}
                                                className="text-text-muted hover:text-primary"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
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
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
