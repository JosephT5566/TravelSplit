import React, { useEffect, useId, useRef, useState } from "react";
import classNames from "classnames";
import { isEmpty } from "lodash";
import { AddExpenseRequest, ExpenseWriteResult } from "../src/types";
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
import { useConfig } from "../src/stores/ConfigStore";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToastNotice } from "@/components/ui/toast";
import logger from "@/src/utils/logger";
import { evaluateExpenseSplit, type ExpenseCalculation } from "@/src/utils/expenseSplits";

interface Props {
    onCancel: () => void;
    onSave: (expense: AddExpenseRequest) => void;
    submitState: ExpenseWriteResult | "idle" | "saving";
    userEmail: string;
    isDialogOpen: boolean;
    selectedDate: Date;
    keyboardOpen: boolean;
}

const splitModes = [
    { kind: "single", label: "單人全額" },
    { kind: "equally", label: "多人平分" },
    { kind: "specific", label: "指定金額" },
] as const;

const InputGroup = ({
    icon: Icon,
    label,
    children,
    required,
    htmlFor,
}: {
    icon: LucideIcon;
    label: string;
    required?: boolean;
    htmlFor?: string;
    children: React.ReactNode;
}) => (
    <div className="flex gap-4 items-start py-3 border-b border-border last:border-0">
        <div className="mt-3 text-text-muted">
            <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
            {htmlFor ? (
                <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-text-muted">
                    {label}
                    {required && <span className="ml-1 text-error" aria-hidden="true">*</span>}
                </label>
            ) : (
                <p className="mb-1 text-xs font-medium text-text-muted">
                    {label}
                    {required && <span className="ml-1 text-error" aria-hidden="true">*</span>}
                </p>
            )}
            {children}
        </div>
    </div>
);

export const ExpenseForm: React.FC<Props> = ({
    onCancel,
    onSave,
    submitState,
    userEmail,
    isDialogOpen,
    selectedDate,
    keyboardOpen,
}) => {
    const { sheetConfig: config } = useConfig();
    const { categories, currencies, users } = config;

    const [date, setDate] = useState(format(selectedDate, "yyyy-MM-dd"));
    const [currency, setCurrency] = useState("TWD");
    const [exchangeRate, setExchangeRate] = useState(
        String(currencies[currency] ?? ""),
    );
    const [category, setCategory] = useState("");
    const [payer, setPayer] = useState(userEmail);
    const [itemName, setItemName] = useState("");
    const [amount, setAmount] = useState<string>("");

    const [splitMode, setSplitMode] = useState<(typeof splitModes)[number]["kind"]>("single");
    const [singleRecipient, setSingleRecipient] = useState<string | null>(null);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [specificSplits, setSpecificSplits] = useState<
        Record<string, string>
    >({});

    const [amountError, setAmountError] = useState<string | null>(null);
    const [itemNameError, setItemNameError] = useState<string | null>(null);
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const fieldId = useId();
    const memberEntries = Object.entries(users);
    const nameFor = (email: string) =>
        users[email] || (email === userEmail ? "我" : email.split("@")[0]);
    const recipient = singleRecipient ?? payer;
    const calculation: ExpenseCalculation = {
        amount,
        exchangeRate,
        method:
            splitMode === "single"
                ? { kind: "single", email: recipient }
                : splitMode === "equally"
                  ? { kind: "equally", participants: selectedUsers }
                  : { kind: "specific", amounts: specificSplits },
    };
    const split = evaluateExpenseSplit(calculation);
    const [splitErrorAttempt, setSplitErrorAttempt] = useState<{
        kind: typeof split.kind;
    } | null>(null);
    const splitErrorRef = useRef<HTMLParagraphElement>(null);
    const fieldsRef = useRef<HTMLFieldSetElement>(null);
    const splitErrorId = useId();

    const currencyAmount = (value: string) =>
        currency === "TWD" ? `NT$${value}` : `${currency} ${value}`;

    let splitError = "";
    if (split.kind === "mismatch") {
        splitError = `${split.direction === "under" ? "還差" : "超出"} ${currencyAmount(split.difference)}`;
    } else if (split.kind === "no-participants") {
        splitError = "請至少選擇一位分攤者";
    } else if (split.kind === "invalid-splits") {
        splitError = "請確認分攤金額與匯率";
    }
    const showSplitError =
        split.kind === "mismatch" || split.kind === splitErrorAttempt?.kind;
    const payerSummary = `${nameFor(payer)}付款`;
    let splitSummary = "請輸入總額";
    if (split.kind === "valid") {
        const names = Object.keys(split.splits).map(nameFor).join("、");
        const total = currencyAmount(amount);
        if (splitMode === "single") {
            splitSummary = `${names}負擔全額 ${total}`;
        } else {
            const action = splitMode === "equally" ? "平分" : "分攤";
            splitSummary = `${names}${action} ${total}`;
        }
    } else if (splitError) {
        splitSummary = `分攤待修正（${splitError}）`;
    }

    useEffect(() => {
        if (splitErrorAttempt) {
            splitErrorRef.current?.focus();
        }
    }, [splitErrorAttempt]);

    useEffect(() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLInputElement && fieldsRef.current?.contains(focused)) {
            focused.scrollIntoView({ block: "nearest" });
        }
    }, [keyboardOpen]);

    const isAddingExpense = submitState === "saving";
    const isWriteUnknown = submitState === "unknown";

    useEffect(() => {
        if (isDialogOpen) {
            // When dialog opens, set the date to the selected date from the list
            setDate(format(selectedDate, "yyyy-MM-dd"));
        } else {
            // Reset all state values to their initial values when dialog closes
            setDate(format(new Date(), "yyyy-MM-dd"));
            setCurrency("TWD");
            setExchangeRate(String(currencies["TWD"] ?? ""));
            setCategory("");
            setPayer(userEmail);
            setItemName("");
            setAmount("");
            setSplitMode("single");
            setSingleRecipient(null);
            setSelectedUsers([]);
            setSpecificSplits({});
            setSplitErrorAttempt(null);
        }
    }, [isDialogOpen, selectedDate, currencies, userEmail]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isAddingExpense || isWriteUnknown) return;

        // Reset errors
        setAmountError(null);
        setItemNameError(null);
        setCategoryError(null);

        let isValid = true;

        if (split.kind === "incomplete") {
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

        if (
            split.kind === "mismatch" ||
            split.kind === "no-participants" ||
            split.kind === "invalid-splits"
        ) {
            setSplitErrorAttempt({ kind: split.kind });
        }

        if (!isValid || split.kind !== "valid") {
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
            exchangeRate: Number(exchangeRate),
            splitsJson: split.splits,
            calculation,
        };

        onSave(expenseData);
    };

    return (
        <>
            <form
                onSubmit={handleSubmit}
                className={classNames(
                    "flex min-h-0 min-w-0 flex-col bg-surface",
                    keyboardOpen && "overflow-y-auto overscroll-contain",
                )}
            >
                <fieldset
                    ref={fieldsRef}
                    disabled={isAddingExpense}
                    className={classNames(
                        "min-w-0",
                        keyboardOpen
                            ? "shrink-0"
                            : "min-h-0 overflow-y-auto overscroll-contain custom-scrollbar",
                    )}
                >
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
                                    inputMode="decimal"
                                    aria-label="總額"
                                    autoFocus
                                    required
                                    className={`bg-transparent text-6xl font-bold text-center outline-none w-full max-w-[240px] placeholder-text-muted/30 text-text-main ${
                                        amountError ? "border-red-500" : ""
                                    }`}
                                    min="0"
                                    step="any"
                                    value={amount}
                                    onChange={(e) => {
                                        const newAmount =
                                            e.target.value.replace(
                                                /^0+(?=\d)/,
                                                "",
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
                                            setExchangeRate(String(currencies[curr] ?? ""));
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
                                inputMode="decimal"
                                className="bg-transparent text-sm text-text-muted border-b border-transparent focus:border-border outline-none"
                                value={exchangeRate}
                                min="0"
                                step="any"
                                onChange={(e) =>
                                    setExchangeRate(e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="px-4 pb-6 space-y-3">
                        {/* Item Name */}
                        <InputGroup icon={FileText} required label="項目名稱" htmlFor={`${fieldId}-item`}>
                            <input
                                id={`${fieldId}-item`}
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
                        <InputGroup icon={Calendar} required label="日期" htmlFor={`${fieldId}-date`}>
                            <input
                                id={`${fieldId}-date`}
                                type="date"
                                required
                                className="w-full bg-transparent text-base outline-none text-text-main dark:scheme-dark"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </InputGroup>

                        <InputGroup icon={UserIcon} required label="付款人" htmlFor={`${fieldId}-payer`}>
                            <select
                                id={`${fieldId}-payer`}
                                required
                                className="min-h-11 w-full rounded-md border border-border bg-background px-2 text-base text-text-main"
                                value={payer}
                                onChange={(e) => setPayer(e.target.value)}
                            >
                                {!Object.hasOwn(users, userEmail) && <option value={userEmail}>我</option>}
                                {memberEntries.map(([email, name]) => (
                                    <option key={email} value={email}>{name}</option>
                                ))}
                            </select>
                        </InputGroup>
                        <InputGroup icon={UsersIcon} label="分攤方式">
                            <div role="radiogroup" aria-label="分攤方式" className="flex flex-wrap gap-x-4">
                                {splitModes.map(({ kind, label }) => (
                                    <label key={kind} className="flex min-h-11 items-center gap-2 text-base">
                                        <input
                                            type="radio"
                                            name="splitMode"
                                            checked={splitMode === kind}
                                            onChange={() => {
                                                setSplitMode(kind);
                                                setSplitErrorAttempt(null);
                                            }}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>

                            {splitMode === "single" && (
                                <label className="mt-2 block text-sm text-text-muted">
                                    負擔人
                                    <select
                                        className="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-2 text-base text-text-main"
                                        value={singleRecipient ?? ""}
                                        aria-describedby={showSplitError ? splitErrorId : undefined}
                                        onChange={(e) => setSingleRecipient(e.target.value || null)}
                                    >
                                        <option value="">跟隨付款人（{nameFor(payer)}）</option>
                                        {memberEntries.map(([email, name]) => (
                                            <option key={email} value={email}>{name}</option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            {splitMode === "equally" && (
                                <div
                                    className="mt-2 flex flex-wrap gap-2"
                                    role="group"
                                    aria-label="平分參與者"
                                    aria-describedby={showSplitError ? splitErrorId : undefined}
                                >
                                    {memberEntries.map(([email, name]) => (
                                        <label key={email} className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-base">
                                            <input
                                                type="checkbox"
                                                className="shrink-0"
                                                checked={selectedUsers.includes(email)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setSplitErrorAttempt(null);
                                                    setSelectedUsers((previous) =>
                                                        checked
                                                            ? [...previous, email]
                                                            : previous.filter((user) => user !== email),
                                                    );
                                                }}
                                            />
                                            <span className="min-w-0 wrap-anywhere">{name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {splitMode === "specific" && (
                                <div
                                    className="mt-2 space-y-2"
                                    role="group"
                                    aria-label="指定分攤金額"
                                    aria-describedby={showSplitError ? splitErrorId : undefined}
                                >
                                    {memberEntries.map(([email, name]) => (
                                        <label
                                            key={email}
                                            className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-2 py-1"
                                        >
                                            <span className="min-w-0 wrap-anywhere">{name}</span>
                                            <span className="flex shrink-0 items-center gap-1">
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    className="w-20 rounded border border-border bg-background px-1.5 py-1 text-right text-base tabular-nums"
                                                    placeholder="0"
                                                    aria-label={`${name}的分攤金額`}
                                                    value={specificSplits[email] ?? ""}
                                                    min="0"
                                                    step="any"
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/^0+(?=\d)/, "");
                                                        setSplitErrorAttempt(null);
                                                        setSpecificSplits((previous) => ({
                                                            ...previous,
                                                            [email]: value,
                                                        }));
                                                    }}
                                                />
                                                <span className="text-xs text-text-muted">{currency}</span>
                                            </span>
                                        </label>
                                    ))}
                                    {split.summary !== null && (
                                        <p className="text-sm tabular-nums text-text-muted">總和 {currencyAmount(split.summary)}</p>
                                    )}
                                </div>
                            )}
                            <p
                                id={splitErrorId}
                                ref={splitErrorRef}
                                aria-live="polite"
                                tabIndex={showSplitError ? -1 : undefined}
                                className="mt-2 w-fit rounded-sm text-sm text-red-700 empty:sr-only focus:outline-2 focus:outline-offset-2 focus:outline-current forest:text-red-200"
                            >
                                {showSplitError ? splitError : ""}
                            </p>
                        </InputGroup>
                    </div>
                </fieldset>
                <DialogFooter className="m-0 shrink-0 flex-col gap-2 rounded-none bg-surface px-4 py-3 sm:flex-col">
                    <p role="status" className="sr-only">
                        {isAddingExpense ? "正在儲存支出" : ""}
                    </p>
                    <div>
                        <p
                            data-slot="expense-summary"
                            tabIndex={0}
                            className="max-h-[20dvh] overflow-y-auto rounded-sm text-sm wrap-anywhere tabular-nums text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                        >
                            {payerSummary} · {splitSummary}
                        </p>
                    </div>
                    <div role="alert" className="empty:sr-only">
                        {submitState === "rejected" && (
                            <ToastNotice kind="error" message="無法新增支出，請重試。" />
                        )}
                        {isWriteUnknown && (
                            <ToastNotice
                                kind="warning"
                                message="暫時無法確認是否已儲存。請先查看這個旅程的紀錄，再決定是否重新新增。"
                            />
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            onClick={onCancel}
                            disabled={isAddingExpense}
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            className="min-h-11 text-gray-950 aria-disabled:opacity-50 ocean:text-white"
                            disabled={
                                !!amountError ||
                                !!itemNameError ||
                                !!categoryError
                            }
                            aria-disabled={isAddingExpense || isWriteUnknown}
                        >
                            {isAddingExpense && (
                                <Loader2 aria-hidden="true" className="animate-spin" />
                            )}
                            {isAddingExpense ? "儲存中…" : "儲存支出"}
                        </Button>
                    </div>
                </DialogFooter>
            </form>
        </>
    );
};
