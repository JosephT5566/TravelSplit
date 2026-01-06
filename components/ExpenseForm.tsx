import React, { useState, useEffect } from "react";
import classNames from "classnames";
import { isEmpty, isFinite } from "lodash";
import { AddExpenseRequest, Expense, User } from "../src/types";
import { format } from "date-fns";
import {
    X,
    Calendar,
    Tag,
    FileText,
    User as UserIcon,
    Users as UsersIcon,
    type LucideIcon,
} from "lucide-react";
import { useAuth } from "../src/stores/AuthStore";
import { useConfig } from "../src/stores/ConfigStore";
import ExpenseDetail from "./ExpenseDetail";
import ExpenseContainer from "./ExpenseContainer";

interface Props {
    initialData?: Expense | null;
    onSave: (data: AddExpenseRequest) => void;
    onCancel: () => void;
    isDialogOpen: boolean;
}

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

export const ExpenseForm: React.FC<Props> = ({
    initialData,
    onSave,
    onCancel,
    isDialogOpen,
}) => {
    const { user } = useAuth();
    const currentUser = user;
    if (!currentUser) {
        return null;
    }

    const { sheetConfig: config } = useConfig();
    if (!config) {
        return null;
    }
    const { categories, currencies, users } = config;

    if (initialData) {
        return <ExpenseDetail expense={initialData} onCancel={onCancel} />;
    }

    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
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

    const themeColor = "red";

    useEffect(() => {
        if (isDialogOpen) {
            return;
        }

        // Reset all state values to their initial values
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
        setSplitSum(0);
    }, [isDialogOpen]);

    // Update specificSplits when splitting equally
    useEffect(() => {
        if (payType !== "others" || splitMode !== "equally") {
            return;
        }

        const numAmount = Number(amount) || 0;
        const participants = [...selectedUsers];

        if (numAmount > 0 && participants.length > 0) {
            const totalCents = numAmount;
            const splitCents = totalCents / participants.length;

            const splitsInCents: Record<string, number> = {};
            participants.forEach((p) => {
                console.log(
                    "Setting split",
                    splitCents * currencies[currency],
                    currencies[currency]
                );
                splitsInCents[p] = splitCents * currencies[currency]; // convert to TWD
            });

            const finalSplits: Record<string, string> = {};
            Object.keys(splitsInCents).forEach((email) => {
                finalSplits[email] = String(splitsInCents[email]);
            });
            setSpecificSplits(finalSplits);
        } else {
            setSpecificSplits({});
        }
    }, [amount, payType, selectedUsers, currentUser.email, splitMode]);

    // Update specificSplits for "myself"
    useEffect(() => {
        if (payType === "myself") {
            if (Number(amount) > 0) {
                setSpecificSplits({ [currentUser.email]: amount });
            } else {
                setSpecificSplits({});
            }
        }
    }, [payType, amount, currentUser.email]);

    // Validate specific splits
    useEffect(() => {
        setSplitSum(0);
        if (payType === "others" && splitMode === "specific") {
            const specifiedValues = Object.values(specificSplits).map(
                (v) => Number(v) || 0
            );
            const sumOfSplits = specifiedValues.reduce((a, b) => a + b, 0);
            setSplitSum(sumOfSplits);
        }
    }, [amount, payType, splitMode, specificSplits]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Reset errors
        setAmountError(null);
        setItemNameError(null);
        setCategoryError(null);

        let isValid = true;

        if (isEmpty(amount) || Number(amount) <= 0) {
            console.log("Invalid amount:", amount);
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

        const cleanedSplits: Record<string, number> = {};
        for (const user in specificSplits) {
            const value = Number(specificSplits[user]);
            if (!isNaN(value) && value > 0) {
                cleanedSplits[user] = value;
            }
        }

        const expenseData: AddExpenseRequest = {
            // Explicitly type to AddExpenseRequest
            date,
            category,
            itemName,
            amount: Number(amount),
            currency,
            payer,
            exchangeRate: Number(exchangeRate),
            splitsJson: cleanedSplits,
        };

        console.log("Submitting expense data:", expenseData);

        // onSave(expenseData);
    };

    return (
        <ExpenseContainer>
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <span className="h-1.5 w-14 rounded-full bg-text-muted/30" />
            </div>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex align-center justify-between items-center bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sticky top-0 z-20">
                <span className="font-semibold text-lg text-text-main">
                    New Transaction
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
                                    className={`bg-transparent text-6xl font-bold text-center outline-none w-full max-w-[240px] placeholder-text-muted/30 caret-${themeColor}-500 text-text-main ${
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
                                                ? `border-${themeColor}-500 bg-${themeColor}-500/10 text-${themeColor}-600`
                                                : "border-border text-text-muted"
                                        }`}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="px-4 pb-6 space-y-3">
                        {/* Item Name */}
                        <InputGroup icon={FileText} label="Item Description *">
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
                        <InputGroup icon={Tag} label="Category *">
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
                        <InputGroup icon={Calendar} label="Date *">
                            <input
                                type="date"
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main dark:scheme-dark"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </InputGroup>

                        {/* Payer */}
                        <InputGroup icon={UserIcon} label="Paid By *">
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
                        <InputGroup icon={UsersIcon} label="Split Method">
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
                                                            onChange={(e) => {
                                                                setSpecificSplits(
                                                                    (prev) => ({
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
                                                    </div>
                                                )
                                            )}
                                            {splitSum && (
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
                            !!amountError ||
                            !!itemNameError ||
                            !!categoryError
                        }
                    >
                        Save
                    </button>
                </div>
            </form>
        </ExpenseContainer>
    );
};
