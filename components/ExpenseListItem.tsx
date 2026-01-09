import React from "react";
import { Expense } from "../src/types";
import { Loader2, Trash2 } from "lucide-react";
import { useAuthState } from "../src/stores/AuthStore";
import { useDeleteExpense } from "../services/dataFetcher";

interface ExpenseListItemProps {
    expense: Expense;
    onOpenExpenseForm: (expense: Expense) => void;
}

export const ExpenseListItem: React.FC<ExpenseListItemProps> = ({
    expense,
    onOpenExpenseForm,
}) => {
    const { user } = useAuthState();

    const { mutateAsync: deleteExpenseMutation, isPending: isDeletingExpense } =
        useDeleteExpense();
    return (
        <div
            className="bg-surface p-4 rounded-xl shadow flex justify-between items-center border border-border hover:border-primary transition-all cursor-pointer"
            onClick={() => onOpenExpenseForm(expense)}
        >
            <div className="flex-1">
                <div className="flex items-center justify-between pr-4">
                    <h4 className="font-semibold text-text-main">
                        {expense.itemName}
                    </h4>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-background text-text-muted border border-border">
                        {expense.category}
                    </span>
                    <span className="text-xs text-text-muted">
                        {expense.payer.split("@")[0]}
                    </span>
                </div>
            </div>

            <div className="text-right pl-2">
                {user && (
                    <>
                        <span className="text-lg font-bold text-accent">
                            {expense.splitsJson[user.email]}
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
                            if (!expense.timestamp) {
                                return;
                            }
                            if (confirm("真的要刪嗎？")) {
                                deleteExpenseMutation(expense.timestamp);
                            }
                        }}
                        className="flex gap-1 text-text-muted hover:text-red-500"
                        disabled={isDeletingExpense}
                    >
                        {isDeletingExpense && (
                            <Loader2 className="animate-spin" size={16} />
                        )}
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
