import React, { useState, useEffect, useCallback } from "react";
import classNames from "classnames";
import { isEmpty } from "lodash";
import { AddExpenseRequest } from "../src/types";
import { format } from "date-fns";
import { X, Calendar, Tag, FileText, User as UserIcon, Users as UsersIcon, Loader2, type LucideIcon } from "lucide-react";
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

const calculateCleanedSplits = ({
    amount,
    exchangeRate,
    payType,
    currentUserEmail,
    selectedUsers,
    splitMode,
    specificSplits,
}: {
    amount: string;
    exchangeRate: number;
    payType: string;
    currentUserEmail: string;
    selectedUsers: string[];
    splitMode: string;
    specificSplits: Record<string, string>;
}): Record<string, number> => {
    const numAmount = Number(amount);
    const totalAmountInBase = numAmount * exchangeRate;
    let splits: Record<string, number> = {};

    if (payType === "myself") {
        splits = { [currentUserEmail]: totalAmountInBase };
    } else if (payType === "others") {
        if (splitMode === "equally") {
            const participants = selectedUsers;
            if (participants.length === 0) {
                throw new Error("Please select at least one participant for equal split.");
            }
            const totalInCents = Math.round(totalAmountInBase * 100);
            const splitInCents = Math.floor(totalInCents / participants.length);
            const remainderCents = totalInCents - splitInCents * participants.length;
            participants.forEach((participant, index) => {
                splits[participant] = (splitInCents + (index < remainderCents ? 1 : 0)) / 100;
            });
        } else if (splitMode === "specific") {
            const specifiedValues = Object.values(specificSplits).map(v => Number(v) || 0);
            const sumOfSplits = specifiedValues.reduce((a, b) => a + b, 0);
            if (Math.abs(sumOfSplits - numAmount) > 0.01) {
                throw new Error(
                    `Sum of splits (${sumOfSplits.toFixed(2)}) must equal total amount (${numAmount.toFixed(2)}).`
                );
            }
            for (const user in specificSplits) {
                const valueInBase = Math.round(Number(specificSplits[user]) * exchangeRate * 100) / 100;
                if (!isNaN(valueInBase) && valueInBase > 0) {
                    splits[user] = valueInBase;
                }
            }
        }
    }
    if (Object.keys(splits).length === 0 && numAmount > 0 && payType === "others") {
        throw new Error("Please configure how to split the expense.");
    }
    return splits;
};

const InputGroup = ({ icon: Icon, label, children, required, }: {
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
                {label} {required && <span className="text-error ml-1">*</span>}
            </label>
            {children}
        </div>
    </div>
);

export const ExpenseForm: React.FC<Props> = ({ onCancel, isDialogOpen, selectedDate, }) => {
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
    const [exchangeRate, setExchangeRate] = useState<number>(currencies[currency]);
    const [category, setCategory] = useState("");
    const [payer, setPayer] = useState(currentUser.email);
    const [itemName, setItemName] = useState(");
    const [amount, setAmount] = useState<string>("");
    const [payType, setPayType] = useState<"myself" | "others">("myself");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [splitMode, setSplitMode] = useState<"equally" | "specific">("equally");
    const [specificSplits, setSpecificSplits] = useState<Record<string, string>>({});
    const [splitSum, setSplitSum] = useState<number>(0);
    // New error states
    const [amountError, setAmountError] = useState<string | null>(null);
    const [itemNameError, setItemNameError] = useState<string | null>(null);
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [splitError, setSplitError] = useState<string | null>(null);
    const { mutateAsync: addExpenseMutation, isPending: isAddingExpense } = useAddExpense();

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

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
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
            // todo: we need to handle the throw error
            const cleanedSplits = calculateCleanedSplits({
                amount,
                exchangeRate,
                payType,
                currentUserEmail: currentUser.email,
                selectedUsers,
                splitMode,
                specificSplits,
            });
            if (isEmpty(cleanedSplits)) {
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
        },
        [amount, category, currentUser.email, exchangeRate, itemName, onCancel, payType, selectedUsers, specificSplits, splitSum, addExpenseMutation]
    );

    return (
        <ExpenseContainer>
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
             <span className="h-1.5 w-14 rounded-full bg-text-muted/30" />
            </div>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex align-center justify-between items-center bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sticky top-0 z-20">...
                <span className="font-semibold text-lg text-text-main"> 新增支出 </span>
                <button type="button" onClick={onCancel} className="text-text-muted hover:text-text-main transition-colors">
                    <X size={20} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col bg-surface">...
                <div className="flex-1 overflow-y-auto max-w-2xl custom-scrollbar">...
                </div>
            </form>
        </ExpenseContainer>
    );
};