import React, { useState, useEffect, useMemo } from "react";
import classNames from "classnames";
import { isEmpty } from "lodash";
import { AddExpenseRequest } from "../src/types";
import { format } from "date-fns";
import {
    X,
    Calendar,
    Tag,
    FileText,
    User as UserIcon,
    Users as UsersIcon,
    Loader2,
    type LucideIcon,
} from "lucide-react";
import { useAuthState } from "../src/stores/AuthStore";
import { useConfig } from "../src/stores/ConfigStore";
import ExpenseContainer from "./ExpenseContainer";
import { useAddExpense } from "../services/dataFetcher";
import logger from "@/src/utils/logger";

interface Props {
    onCancel: () => void;
    isDialogOpen: boolean;
    selectedDate: Date;
}

const InputGroup = ({
    icon: Icon,
    label,
    children,
    required,
}: {
    icon: LucideIcon;
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) => (
    <div className="flex gap-4 items-start py-3 border-b border-border last:border-0">
        <div className="mt-3 text-text-muted">
            <Icon size={20} />
        </div>
        <div className="flex-1">
            <label className="block text-xs font-medium text-text-muted mb-1">
                {label}
                {required && <span className="text-error ml-1">*</span>}
            </label>
            {children}
        </div>
    </div>
);

export const ExpenseForm: React.FC<Props> = ({
    onCancel,
    isDialogOpen,
    selectedDate,
}) => {
    const { user } = useAuthState();
    const currentUser = user;
    if (!currentUser) {
        return null;
    }

    const { sheetConfig: config } = useConfig();
    if (!config) {
        return null;
    }
    const { categories, currencies, users } = config;

    const [date, setDate] = useState(format(selectedDate, "yyyy-MM-dd"));
    const [currency, setCurrency] = useState("TWD");
    const [exchangeRate, setExchangeRate] = useState<number>(
        currencies[currency]
    );
    const [category, setCategory] = useState("");
    const [payer, setPayer] = useState(currentUser.email);
    const [itemName, setItemName] = useState("");
    const [amount, setAmount] = useState<string>("");

    const [payType, setPayType] = useState<"myself" | "others">("myself");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [splitMode, setSplitMode] = useState<"equally" | "specific">(
        "equally"
    );
    const [specificSplits, setSpecificSplits] = useState<
        Record<string, string>
    >({});
    const [splitSum, setSplitSum] = useState<number>(0);

    // New error states
    const [amountError, setAmountError] = useState<string | null>(null);
    const [itemNameError, setItemNameError] = useState<string | null>(null);
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [splitError, setSplitError] = useState<string | null>(null);

    const { mutateAsync: addExpenseMutation, isPending: isAddingExpense } =
        useAddExpense();

    useEffect(() => {
        if (isDialogOpen) {
            // When dialog opens, set the date to the selected date from the list
            setDate(format(selectedDate, "yyyy-MM-dd"));
        } else {
            // Reset all state values to their initial values when dialog closes
            setDate(format(new Date(), "yyyy-MM-dd"));
            setCurrency("TWD");
            setExchangeRate(currencies["TWD"]);
            setCategory("");
            setPayer(currentUser.email);
            setItemName("");
            setAmount("");
            setPayType("myself");
            setSelectedUsers([]);
            setSplitMode("equally");
            setSpecificSplits({});
        }
    }, [isDialogOpen, selectedDate, currencies, currentUser.email]);

    useEffect(() => {
        const total = Object.values(specificSplits).reduce(
            (acc, curr) => acc + (Number(curr) || 0),
            0
        );
        setSplitSum(total);
    }, [specificSplits]);

    const effectiveExchangeRate = useMemo(() => {
        if (exchangeRate !== null && exchangeRate !== undefined) {
            return Number(exchangeRate);
        }

        return currencies[currency]; // 你原本跟 currency 綁定的那個
    }, [exchangeRate, currencies, currency]);

    const getCleanedSplits = (): Record<string, number> | null => {
        const numAmount = Number(amount);
        const totalAmountInBase = numAmount * effectiveExchangeRate;
        let splits: Record<string, number> = {};

        if (payType === "myself") {
            splits = { [currentUser.email]: totalAmountInBase };
        } else if (payType === "others") {
            if (splitMode === "equally") {
                const participants = selectedUsers;
                if (participants.length === 0) {
                    setSplitError(
                        "Please select at least one participant for equal split."
                    );
                    return null;
                }
                const totalInCents = Math.round(totalAmountInBase * 100);
                const splitInCents = Math.floor(
                    totalInCents / participants.length
                );
                const remainderCents =
                    totalInCents - splitInCents * participants.length;

                participants.forEach((p, index) => {
                    splits[p] =
                        (splitInCents + (index < remainderCents ? 1 : 0)) /
                        100;
                });
            } else if (splitMode === "specific") {
                const specifiedValues = Object.values(specificSplits).map(
                    (v) => Number(v) || 0
                );
                const sumOfSplits = specifiedValues.reduce(
                    (a, b) => a + b,
                    0
                );

                if (Math.abs(sumOfSplits - numAmount) > 0.01) {
                    setSplitError(
                        `Sum of splits (${sumOfSplits.toFixed(
                            2
                        )}) must equal total amount (${numAmount.toFixed(
                            2
                        )}).`
                    );
                    return null;
                }

                for (const user in specificSplits) {
                    const valueInBase = Number(specificSplits[user]) * effectiveExchangeRate;
                    if (!isNaN(valueInBase) && valueInBase > 0) {
                        splits[user] = valueInBase;
                    }
                }
            }
        }

        if (Object.keys(splits).length === 0 && numAmount > 0) {
            if (payType === "others") {
                setSplitError("Please configure how to split the expense.");
                return null;
            }
        }

        return splits;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Reset errors
        setAmountError(null);
        setItemNameError(null);
        setCategoryError(null);
        setSplitError(null);

        let isValid = true;

        if (isEmpty(amount) || Number(amount) <= 0) {
            logger.log("Invalid amount:", amount);
            setAmountError("Amount must be a positive number.");
            isValid = false;
        }

        if (isEmpty(itemName.trim())) {
            setItemNameError("Item description cannot be empty.");
            isValid = false;
        }

        if (isEmpty(category)) {
            setCategoryError("Please select a category.");
            isValid = false;
        }

        if (splitSum > 0 && splitSum > Number(amount)) {
            isValid = false; // Prevent submission if split error exists
        }

        if (!isValid) {
            return;
        }

        const cleanedSplits = getCleanedSplits();

        if (cleanedSplits === null) {
            return;
        }

        const expenseData: AddExpenseRequest = {
            // Explicitly type to AddExpenseRequest
            date,
            category,
            itemName,
            amount: Number(amount),
            currency,
            payer,
            exchangeRate,
            splitsJson: cleanedSplits,
        };

        logger.log("Submitting expense data:", expenseData);

        await addExpenseMutation(expenseData);
        onCancel();
    };

    return (
        <ExpenseContainer>
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <span className="h-1.5 w-14 rounded-full bg-text-muted/30" />
            </div>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex align-center justify-between items-center bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sticky top-0 z-20">
                <span className="font-semibold text-lg text-text-main">
                    新增支出
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-text-muted hover:text-text-main transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <form
                onSubmit={handleSubmit}
                className="flex-1 flex flex-col bg-surface"
            >
                <div className="flex-1 overflow-y-auto max-w-2xl custom-scrollbar">
                    {/* Main Amount Input */}
                    <div className="px-6 pt-2 pb-6 sm:py-8">
                        <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-5 sm:px-6 sm:py-7 shadow-inner">
                            <div className="flex items-baseline justify-center gap-2 text-text-main">
                                <span className="text-3xl font-medium text-text-muted">
                                    {currency}
                                </span>
                                <input
                                    type="number"
                                    placeholder="0"
                                    pattern="[0-9]*"
                                    autoFocus
                                    required
                                    className={`bg-transparent text-6xl font-bold text-center outline-none w-full max-w-[240px] placeholder-text-muted/30 text-text-main ${
                                        amountError ? "border-red-500" : ""
                                    }`}
                                    min="0"
                                    value={amount}
                                    onChange={(e) => {
                                        const newAmount =
                                            e.target.value.replace(
                                                /^0+(?=\d)/,
                                                ""
                                            );
                                        setAmount(newAmount);
                                        setAmountError(null);
                                    }}
                                />
                            </div>
                            {amountError && (
                                <p className="text-red-500 text-sm mt-2 text-center">
                                    {amountError}
                                </p>
                            )}

                            {/* Currency Quick Switch */}
                            <div className="flex gap-2 mt-4 overflow-x-auto max-w-full pb-2 no-scrollbar justify-center">
                                {Object.keys(currencies).map((curr) => (
                                    <button
                                        key={curr}
                                        type="button"
                                        onClick={() => {
                                            setCurrency(curr);
                                            setExchangeRate(currencies[curr]);
                                        }}
                                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                            currency === curr
                                                ? `border-accent text-accent`
                                                : "border-border text-text-muted"
                                        }`}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* exchange rate */}
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-text-muted">
                                匯率
                            </span>
                            <input
                                type="number"
                                className="bg-transparent text-sm text-text-muted border-b border-transparent focus:border-border outline-none"
                                value={exchangeRate}
                                onChange={(e) =>
                                    setExchangeRate(e.target.valueAsNumber)
                                }
                            />
                        </div>
                    </div>

                    <div className="px-4 pb-6 space-y-3">
                        {/* Item Name */}
                        <InputGroup icon={FileText} required label="項目名稱">
                            <input
                                type="text"
                                required
                                placeholder="What is this for?"
                                className={`w-full bg-transparent text-lg border-b ${
                                    itemNameError
                                        ? "border-red-500"
                                        : "border-transparent"
                                } focus:border-border outline-none transition-colors pb-1 text-text-main placeholder-text-muted/50`}
                                value={itemName}
                                onChange={(e) => {
                                    setItemName(e.target.value);
                                    setItemNameError(null);
                                }}
                            />
                            {itemNameError && (
                                <p className="text-red-500 text-sm mt-1">
                                    {itemNameError}
                                </p>
                            )}
                        </InputGroup>

                        {/* Category Chips */}
                        <InputGroup icon={Tag} required label="類別">
                            <div
                                className={`flex flex-wrap gap-2 mt-1 ${
                                    categoryError
                                        ? "border border-red-500 rounded p-1"
                                        : ""
                                }`}
                            >
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => {
                                            setCategory(cat);
                                            setCategoryError(null);
                                        }}
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-all border ${
                                            category === cat
                                                ? "bg-text-main text-surface border-transparent shadow-sm"
                                                : "bg-background text-text-muted border-border hover:border-text-muted"
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            {categoryError && (
                                <p className="text-red-500 text-sm mt-1">
                                    {categoryError}
                                </p>
                            )}
                        </InputGroup>

                        {/* Date */}
                        <InputGroup icon={Calendar} required label="日期">
                            <input
                                type="date"
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main dark:scheme-dark"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </InputGroup>

                        {/* Payer */}
                        <InputGroup icon={UserIcon} required label="付款人">
                            <select
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main p-1 border rounded-md"
                                value={payer}
                                onChange={(e) => setPayer(e.target.value)}
                            >
                                {Object.entries(users).map(([email, name]) => (
                                    <option key={email} value={email}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </InputGroup>
                        {/* Split Method */}
                        <InputGroup icon={UsersIcon} label="分攤方式">
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="payType"
                                        value="myself"
                                        checked={payType === "myself"}
                                        onChange={() => {
                                            setPayType("myself");
                                            setSelectedUsers([]);
                                        }}
                                    />
                                    Myself
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="payType"
                                        value="others"
                                        checked={payType === "others"}
                                        onChange={() => setPayType("others")}
                                    />
                                    With Others
                                </label>
                            </div>

                            {payType === "others" && (
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="splitMode"
                                                value="equally"
                                                checked={
                                                    splitMode === "equally"
                                                }
                                                onChange={() =>
                                                    setSplitMode("equally")
                                                }
                                            />{" "}
                                            平分
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="splitMode"
                                                value="specific"
                                                checked={
                                                    splitMode === "specific"
                                                }
                                                onChange={() =>
                                                    setSplitMode("specific")
                                                }
                                            />{" "}
                                            指定金額
                                        </label>
                                    </div>
                                    <p className="text-sm text-text-muted">
                                        Select participants:
                                    </p>
                                    {splitMode === "equally" && (
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(users).map(
                                                ([email, name]) => (
                                                    <label
                                                        key={email}
                                                        className="flex items-center gap-2 p-2 border rounded-lg"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUsers.includes(
                                                                email
                                                            )}
                                                            onChange={(e) => {
                                                                if (
                                                                    e.target
                                                                        .checked
                                                                ) {
                                                                    setSelectedUsers(
                                                                        (
                                                                            prev
                                                                        ) => [
                                                                            ...prev,
                                                                            email,
                                                                        ]
                                                                    );
                                                                } else {
                                                                    setSelectedUsers(
                                                                        (
                                                                            prev
                                                                        ) =>
                                                                            prev.filter(
                                                                                (
                                                                                    p
                                                                                ) =>
                                                                                    p !==
                                                                                    email
                                                                            )
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        {name}
                                                    </label>
                                                )
                                            )}
                                        </div>
                                    )}

                                    {splitMode === "specific" && (
                                        <div className="space-y-2">
                                            {Object.entries(users).map(
                                                ([email, name]) => (
                                                    <div
                                                        key={email}
                                                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                                                    >
                                                        <span className="text-sm text-text-main">
                                                            {users[email] ||
                                                                email.split(
                                                                    "@"
                                                                )[0]}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                className="w-24 p-1 border rounded bg-background text-right"
                                                                placeholder="0"
                                                                value={
                                                                    specificSplits[
                                                                        email
                                                                    ] || ""
                                                                }
                                                                min="0"
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    setSpecificSplits(
                                                                        (
                                                                            prev
                                                                        ) => ({
                                                                            ...prev,
                                                                            [email]:
                                                                                e.target.value.replace(
                                                                                    /^0+(?=\d)/,
                                                                                    ""
                                                                                ),
                                                                        })
                                                                    );
                                                                }}
                                                            />
                                                            <span className="text-sm text-accent">
                                                                {currency}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                            {splitSum > 0 && (
                                                <>
                                                    <span className="text-text-muted text-sm mt-2">
                                                        {`總和：${splitSum}`}
                                                    </span>
                                                    {splitSum >
                                                        Number(amount) && (
                                                        <span className="text-red-500 text-sm mt-2 ml-2">
                                                            {`（大於總金額）`}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {splitError && (
                                                <p className="text-red-500 text-sm mt-2">
                                                    {splitError}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </InputGroup>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-surface shadow-inner">
                    <button
                        type="submit"
                        className={`w-full py-3 rounded-xl font-semibold bg-primary text-white hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
                        disabled={
                            splitSum > Number(amount) ||
                            !!splitError ||
                            !!amountError ||
                            !!itemNameError ||
                            !!categoryError ||
                            isAddingExpense
                        }
                    >
                        {isAddingExpense ? (
                            <div className="flex items-center justify-center">
                                <Loader2
                                    className="animate-spin mr-2"
                                    size={20}
                                />
                                Saving...
                            </div>
                        ) : (
                            "Save"
                        )}
                    </button>
                </div>
            </form>
        </ExpenseContainer>
    );
};
