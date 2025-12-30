import React, { useState, useEffect } from "react";
import { Expense, TransactionType, User } from "../src/types";
import { format } from "date-fns";
import {
    X,
    Calendar,
    Tag,
    FileText,
    User as UserIcon,
    CheckCircle2,
    Circle,
    Banknote,
    type LucideIcon,
} from "lucide-react";

interface Props {
    initialData?: Expense | null;
    defaultDate?: Date;
    currentUser: User;
    onSave: (data: Expense) => void;
    onCancel: () => void;
}

const CATEGORIES = [
    "Food",
    "Transport",
    "Accommodation",
    "Shopping",
    "Entertainment",
    "Tickets",
    "Others",
];
const CURRENCIES = ["TWD", "JPY", "USD", "EUR", "KRW"];

export const ExpenseForm: React.FC<Props> = ({
    initialData,
    defaultDate,
    currentUser,
    onSave,
    onCancel,
}) => {
    const [formData, setFormData] = useState<Partial<Expense>>({
        date: format(defaultDate || new Date(), "yyyy-MM-dd"),
        type: TransactionType.EXPENSE,
        currency: "TWD",
        exchangeRate: 1,
        category: "Food",
        payer: currentUser.email,
        // settled: false,
        item: "",
        amount: "" as any,
        personalNote: "",
        remark: "",
    });

    const isExpense = formData.type === TransactionType.EXPENSE;
    const themeColor = isExpense ? "red" : "green";

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else if (defaultDate) {
            // If opening new form, respect the view's date
            setFormData((prev) => ({
                ...prev,
                date: format(defaultDate, "yyyy-MM-dd"),
            }));
        }
    }, [initialData, defaultDate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.item || !formData.amount) return;

        const dayName = new Date(formData.date!).toLocaleDateString("en-US", {
            weekday: "long",
        });

        const newExpense: Expense = {
            id: initialData?.id || crypto.randomUUID(),
            timestamp: initialData?.timestamp || new Date().toISOString(),
            date: formData.date!,
            day: dayName,
            category: formData.category!,
            item: formData.item!,
            type: formData.type!,
            amount: Number(formData.amount),
            currency: formData.currency!,
            payer: formData.payer!,
            personalNote: formData.personalNote || "",
            // settled: formData.settled || false,
            remark: formData.remark || "",
            exchangeRate: Number(formData.exchangeRate),
        };

        onSave(newExpense);
    };

    const InputGroup = ({
        icon: Icon,
        label,
        children,
    }: {
        icon: LucideIcon;
        label: string;
        children: React.ReactNode;
    }) => (
        <div className="flex gap-4 items-start py-3 border-b border-border last:border-0">
            <div className="mt-3 text-text-muted">
                <Icon size={20} />
            </div>
            <div className="flex-1">
                <label className="block text-xs font-medium text-text-muted mb-1">
                    {label}
                </label>
                {children}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 transition-opacity">
            <div className="bg-surface w-full sm:max-w-lg h-[95vh] sm:h-auto sm:max-h-[85vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-surface z-10">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-text-muted hover:text-text-main transition-colors"
                    >
                        Cancel
                    </button>
                    <span className="font-semibold text-lg text-text-main">
                        {initialData ? "Edit Transaction" : "New Transaction"}
                    </span>
                    <button
                        onClick={handleSubmit}
                        className={`font-bold text-${themeColor}-600 hover:text-${themeColor}-700 transition-colors`}
                    >
                        Save
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex-1 overflow-y-auto custom-scrollbar bg-surface"
                >
                    {/* Type Selector (Segmented Control) */}
                    <div className="p-4 pb-0">
                        <div className="bg-background p-1 rounded-xl flex relative border border-border">
                            <button
                                type="button"
                                onClick={() =>
                                    setFormData({
                                        ...formData,
                                        type: TransactionType.EXPENSE,
                                    })
                                }
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 z-10 ${
                                    isExpense
                                        ? "bg-surface shadow text-red-600"
                                        : "text-text-muted"
                                }`}
                            >
                                Expense
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setFormData({
                                        ...formData,
                                        type: TransactionType.INCOME,
                                    })
                                }
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 z-10 ${
                                    !isExpense
                                        ? "bg-surface shadow text-green-600"
                                        : "text-text-muted"
                                }`}
                            >
                                Income / Refund
                            </button>
                        </div>
                    </div>

                    {/* Main Amount Input */}
                    <div className="px-6 py-8 flex flex-col items-center justify-center">
                        <div className="flex items-baseline gap-2 text-text-main">
                            <span className="text-3xl font-medium text-text-muted">
                                {formData.currency}
                            </span>
                            <input
                                type="number"
                                placeholder="0"
                                autoFocus={!initialData}
                                className={`bg-transparent text-6xl font-bold text-center outline-none w-full max-w-[240px] placeholder-text-muted/30 caret-${themeColor}-500 text-text-main`}
                                value={formData.amount}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        amount: e.target.value as any,
                                    })
                                }
                            />
                        </div>
                        {/* Currency Quick Switch */}
                        <div className="flex gap-2 mt-4 overflow-x-auto max-w-full pb-2 no-scrollbar">
                            {CURRENCIES.map((curr) => (
                                <button
                                    key={curr}
                                    type="button"
                                    onClick={() =>
                                        setFormData({
                                            ...formData,
                                            currency: curr,
                                        })
                                    }
                                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                        formData.currency === curr
                                            ? `border-${themeColor}-500 bg-${themeColor}-500/10 text-${themeColor}-600`
                                            : "border-border text-text-muted"
                                    }`}
                                >
                                    {curr}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-4 space-y-2">
                        {/* Item Name */}
                        <InputGroup icon={FileText} label="Item Description">
                            <input
                                type="text"
                                required
                                placeholder="What is this for?"
                                className="w-full bg-transparent text-lg border-b border-transparent focus:border-border outline-none transition-colors pb-1 text-text-main placeholder-text-muted/50"
                                value={formData.item}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        item: e.target.value,
                                    })
                                }
                            />
                        </InputGroup>

                        {/* Category Chips */}
                        <InputGroup icon={Tag} label="Category">
                            <div className="flex flex-wrap gap-2 mt-1">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() =>
                                            setFormData({
                                                ...formData,
                                                category: cat,
                                            })
                                        }
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-all border ${
                                            formData.category === cat
                                                ? `bg-text-main text-surface border-transparent shadow-sm`
                                                : "bg-background text-text-muted border-border hover:border-text-muted"
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </InputGroup>

                        {/* Date */}
                        <InputGroup icon={Calendar} label="Date">
                            <input
                                type="date"
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main dark:[color-scheme:dark]"
                                value={formData.date}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        date: e.target.value,
                                    })
                                }
                            />
                        </InputGroup>

                        {/* Payer */}
                        <InputGroup icon={UserIcon} label="Paid By">
                            <input
                                type="email"
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main"
                                value={formData.payer}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        payer: e.target.value,
                                    })
                                }
                            />
                        </InputGroup>

                        {/* Exchange Rate */}
                        <InputGroup
                            icon={Banknote}
                            label={`Exchange Rate (1 ${formData.currency} = ? Base)`}
                        >
                            <input
                                type="number"
                                step="0.0001"
                                className="w-full bg-transparent text-base outline-none text-text-main"
                                value={formData.exchangeRate}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        exchangeRate: parseFloat(
                                            e.target.value
                                        ),
                                    })
                                }
                            />
                        </InputGroup>

                        {/* Settled Toggle */}
                        <div className="flex items-center justify-between py-4 border-t border-border mt-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`p-2 rounded-full ${
                                        formData.settled
                                            ? "bg-green-100 text-green-600"
                                            : "bg-background text-text-muted"
                                    }`}
                                >
                                    {formData.settled ? (
                                        <CheckCircle2 size={24} />
                                    ) : (
                                        <Circle size={24} />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-text-main">
                                        Mark as Settled
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        No further action needed
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setFormData({
                                        ...formData,
                                        // settled: !formData.settled,
                                    })
                                }
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                    formData.settled
                                        ? "bg-green-500"
                                        : "bg-background border border-border"
                                }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
                                        formData.settled
                                            ? "translate-x-6"
                                            : "translate-x-1"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
