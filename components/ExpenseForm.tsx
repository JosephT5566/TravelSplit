import React, { useState, useEffect } from "react";
import classNames from "classnames";
import {
    AddExpenseRequest,
    EditExpenseRequest,
    Expense,
    User,
} from "../src/types";
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

interface Props {
    initialData?: Partial<Expense> | null;
    onSave: (data: AddExpenseRequest | EditExpenseRequest) => void;
    onCancel: () => void;
}

const CATEGORIES = [
    "機票",
    "交通",
    "活動、門票",
    "住宿",
    "吃飯",
    "喝喝",
    "滑雪",
    "戰利品",
    "伴手禮",
];
const CURRENCIES = ["TWD", "JPY"];
const USERS = {
    "joseph@gmail.com": "香菇",
    "casper@gmail.com": "阿肥",
    "david@gmail.com": "建銘",
    "hardy@gmail.com": "豪",
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

export const ExpenseForm: React.FC<Props> = ({
    initialData,
    onSave,
    onCancel,
}) => {
    const { user } = useAuth();
    const currentUser = user;
    if (!currentUser) {
        return null;
    }

    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [currency, setCurrency] = useState("TWD");
    const [exchangeRate, setExchangeRate] = useState<number | string>(1);
    const [category, setCategory] = useState("Food");
    const [payer, setPayer] = useState(currentUser.email);
    const [itemName, setItemName] = useState("");
    const [amount, setAmount] = useState<number | string>("");

    const [payType, setPayType] = useState<"myself" | "others">("myself");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [splitMode, setSplitMode] = useState<"equally" | "specific">(
        "equally"
    );
    const [specificSplits, setSpecificSplits] = useState<
        Record<string, number | string>
    >({});
    const [splitError, setSplitError] = useState<string | null>(null);

    const isEditMode = !!initialData;
    const themeColor = "red";

    // init the formData
    useEffect(() => {
        if (initialData) {
            const dateToUse = initialData.date
                ? new Date(initialData.date)
                : new Date();
            setDate(format(dateToUse, "yyyy-MM-dd"));
            setCurrency(initialData.currency || "TWD");
            setExchangeRate(initialData.exchangeRate || 1);
            setCategory(initialData.category || "Food");
            setPayer(initialData.payer || currentUser.email);
            setItemName(initialData.itemName || "");
            setAmount(initialData.amount || "");

            if (initialData.splitsJson) {
                const splits = initialData.splitsJson;
                const participants = Object.keys(splits);
                if (
                    participants.length <= 1 &&
                    (!participants[0] || participants[0] === currentUser.email)
                ) {
                    setPayType("myself");
                    setSelectedUsers([]);
                } else {
                    setPayType("others");
                    setSplitMode("specific"); // Default to specific to show stored values
                    setSelectedUsers(
                        participants.filter((p) => p !== currentUser.email)
                    );
                }
                setSpecificSplits(splits);
            }
        }
    }, [initialData, currentUser.email]);

    // Update specificSplits when splitting equally
    useEffect(() => {
        if (payType !== "others" || splitMode !== "equally") {
            return;
        }

        const numAmount = Number(amount) || 0;
        const participants = [currentUser.email, ...selectedUsers];

        if (numAmount > 0 && participants.length > 0) {
            const totalCents = Math.round(numAmount * 100);
            const splitCents = Math.floor(totalCents / participants.length);
            const remainderCents =
                totalCents - splitCents * participants.length;

            const splitsInCents: Record<string, number> = {};
            participants.forEach((p) => {
                splitsInCents[p] = splitCents;
            });

            if (participants.includes(currentUser.email)) {
                splitsInCents[currentUser.email] += remainderCents;
            }

            const finalSplits: Record<string, number> = {};
            Object.keys(splitsInCents).forEach((email) => {
                finalSplits[email] = splitsInCents[email] / 100;
            });
            setSpecificSplits(finalSplits);
        } else {
            setSpecificSplits({});
        }
    }, [amount, payType, selectedUsers, currentUser.email, splitMode]);

    // Update specificSplits for "myself"
    useEffect(() => {
        if (payType === "myself") {
            const numAmount = Number(amount) || 0;
            if (numAmount > 0) {
                setSpecificSplits({ [currentUser.email]: numAmount });
            } else {
                setSpecificSplits({});
            }
        }
    }, [payType, amount, currentUser.email]);

    // Validate specific splits
    useEffect(() => {
        setSplitError(null);
        if (payType === "others" && splitMode === "specific") {
            const numAmount = Number(amount) || 0;
            const specifiedValues = Object.values(specificSplits).map(
                (v) => Number(v) || 0
            );
            const sumOfSplits = specifiedValues.reduce((a, b) => a + b, 0);

            if (Math.abs(sumOfSplits - numAmount) > 0.01) {
                setSplitError(
                    `Sum of splits (${sumOfSplits.toFixed(
                        2
                    )}) must equal total amount (${numAmount}).`
                );
            }
        }
    }, [amount, payType, splitMode, specificSplits]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName || !amount) {
            return;
        }

        if (splitError) {
            alert(`Please fix the split amounts: ${splitError}`);
            return;
        }

        const cleanedSplits: Record<string, number> = {};
        for (const user in specificSplits) {
            const value = Number(specificSplits[user]);
            if (!isNaN(value) && value > 0) {
                cleanedSplits[user] = value;
            }
        }

        const payerEmail = Object.keys(USERS).find(key => USERS[key] === payer);
        if (!payerEmail) {
            alert(`Payer not found: ${payer}`);
            return;
        }

        const expenseData = {
            date,
            category,
            itemName,
            amount: Number(amount),
            currency,
            payer: payerEmail,
            exchangeRate: Number(exchangeRate),
            splitsJson: JSON.stringify(cleanedSplits),
        };

        if (isEditMode) {
            onSave({
                ...expenseData,
                timestamp: initialData.timestamp,
            });
        } else {
            onSave(expenseData);
        }
    };

    return (
        <div
            className={classNames(
                "bg-surface min-h-[70vh] shadow-2xl flex flex-col overflow-auto animate-in slide-in-from-bottom-8 fade-in duration-200",
                "w-full, sm:w-160",
                "fixed bottom-0 sm:top-1/2 sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2",
                "max-h-[90vh] sm:max-h-[85vh]",
                "rounded-t-3xl sm:rounded-2xl"
            )}
        >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <span className="h-1.5 w-14 rounded-full bg-text-muted/30" />
            </div>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex align-center justify-between items-center bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sticky top-0 z-20">
                <span className="font-semibold text-lg text-text-main">
                    {initialData && initialData.timestamp
                        ? "Edit Transaction"
                        : "New Transaction"}
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
                                    autoFocus={!initialData?.timestamp}
                                    className={`bg-transparent text-6xl font-bold text-center outline-none w-full max-w-[240px] placeholder-text-muted/30 caret-${themeColor}-500 text-text-main`}
                                    value={amount}
                                    onChange={(e) =>
                                        setAmount(e.target.value as any)
                                    }
                                />
                            </div>
                            {/* Currency Quick Switch */}
                            <div className="flex gap-2 mt-4 overflow-x-auto max-w-full pb-2 no-scrollbar justify-center">
                                {CURRENCIES.map((curr) => (
                                    <button
                                        key={curr}
                                        type="button"
                                        onClick={() => setCurrency(curr)}
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
                        <InputGroup icon={FileText} label="Item Description">
                            <input
                                type="text"
                                required
                                placeholder="What is this for?"
                                className="w-full bg-transparent text-lg border-b border-transparent focus:border-border outline-none transition-colors pb-1 text-text-main placeholder-text-muted/50"
                                value={itemName}
                                onChange={(e) => setItemName(e.target.value)}
                            />
                        </InputGroup>

                        {/* Category Chips */}
                        <InputGroup icon={Tag} label="Category">
                            <div className="flex flex-wrap gap-2 mt-1">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
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
                        </InputGroup>

                        {/* Date */}
                        <InputGroup icon={Calendar} label="Date">
                            <input
                                type="date"
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main dark:scheme-dark"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </InputGroup>

                        {/* Payer */}
                        <InputGroup icon={UserIcon} label="Paid By">
                            <select
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main p-1 border rounded-md"
                                value={payer}
                                onChange={(e) => setPayer(e.target.value)}
                            >
                                {Object.entries(USERS).map(([email, name]) => (
                                    <option key={email} value={name}>
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
                                            {Object.entries(USERS).map(
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
                                            {Object.entries(USERS).map(
                                                ([email, name]) => (
                                                    <div
                                                        key={email}
                                                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                                                    >
                                                        <span className="text-sm text-text-main">
                                                            {USERS[email] ||
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
                                                            onChange={(e) => {
                                                                setSpecificSplits(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [email]:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    })
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                )
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
                        disabled={!!splitError}
                    >
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
};
