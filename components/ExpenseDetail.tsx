import React from "react";
import classNames from "classnames";
import { Expense } from "../src/types";
import { format } from "date-fns";
import {
    X,
    Calendar,
    Tag,
    FileText,
    CircleDollarSign,
    HandCoins,
    User as UserIcon,
    Users as UsersIcon,
    type LucideIcon,
    ArrowRight,
} from "lucide-react";
import { useAuthState } from "../src/stores/AuthStore";
import { useConfig } from "../src/stores/ConfigStore";
import ExpenseContainer from "./ExpenseContainer";
import logger from "@/src/utils/logger";

interface InfoGroupProps {
    icon: LucideIcon;
    label: string;
    children: React.ReactNode;
}

const InfoGroup: React.FC<InfoGroupProps> = ({
    icon: Icon,
    label,
    children,
}) => (
    <div className="flex gap-4 items-start py-4 border-b border-border last:border-0">
        <div className="mt-1 text-text-muted">
            <Icon size={20} />
        </div>
        <div className="flex-1">
            <p className="block text-xs font-medium text-text-muted mb-1">
                {label}
            </p>
            <div className="text-text-main text-base">{children}</div>
        </div>
    </div>
);

interface Props {
    expense: Expense;
    onCancel: () => void;
}

const ExpenseDetail: React.FC<Props> = ({ expense, onCancel }) => {
    const { user } = useAuthState();
    const currentUser = user;

    if (!currentUser) {
        return null;
    }

    const { sheetConfig: config } = useConfig();
    if (!config) {
        return null;
    }
    const { users } = config;

    const { amount, currency, itemName, category, date, payer, splitsJson } =
        expense;

    const myCost = splitsJson[currentUser.email] || 0;
    logger.log("ExpenseDetail splitsJson:", splitsJson, currentUser.email);
    const payerEmail =
        Object.keys(users).find((email) => users[email] === payer) || "Unknown";
    const themeColor = "red";

    const renderSplits = () => {
        if (!splitsJson || Object.keys(splitsJson).length === 0) {
            return <p>No split details available.</p>;
        }

        const isPayerMe = payerEmail === currentUser.email;

        if (isPayerMe) {
            const othersInvolved = Object.entries(splitsJson)
                .filter(([email]) => email !== currentUser.email)
                .filter(([, cost]) => cost > 0);

            if (othersInvolved.length === 0) {
                return <p>You paid for yourself.</p>;
            }

            return (
                <div className="space-y-2">
                    {othersInvolved.map(([email, cost]) => (
                        <div
                            key={email}
                            className="flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                    {users[email] || "Unknown"}
                                </span>
                                <span className="text-sm text-text-muted">
                                    給我
                                </span>
                            </div>
                            <span
                                className={`font-semibold text-${themeColor}-500`}
                            >
                                {`NTD ${cost.toFixed(2)}`}
                            </span>
                        </div>
                    ))}
                </div>
            );
        } else {
            if (myCost > 0) {
                return (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">我</span>
                            <span className="text-sm text-text-muted">給</span>
                            <span className="font-semibold">{payer}</span>
                        </div>
                        <span
                            className={`font-semibold text-${themeColor}-500`}
                        >
                            {`NTD ${myCost.toFixed(2)}`}
                        </span>
                    </div>
                );
            } else {
                return <p>You are not involved in this split.</p>;
            }
        }
    };

    return (
        <ExpenseContainer>
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <span className="h-1.5 w-14 rounded-full bg-text-muted/30" />
            </div>
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-border sticky top-0 bg-surface/95 backdrop-blur z-10">
                <span className="font-semibold text-lg text-text-main">
                    支出明細
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-text-muted hover:text-text-main transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="px-6 pt-2 pb-6 sm:py-8 text-center">
                    <p className="text-sm text-text-muted">我的花費</p>
                    <p className={`text-4xl font-bold text-accent`}>
                        {`NTD ${myCost.toFixed(2)}`}
                    </p>
                </div>

                <div className="space-y-1">
                    <InfoGroup icon={FileText} label="項目名稱">
                        <span className="font-semibold">
                            {itemName}
                        </span>
                    </InfoGroup>
                    <InfoGroup icon={HandCoins} label="總金額">
                        <span className="font-semibold">
                            {amount.toFixed(2)}
                        </span>
                    </InfoGroup>
                    <InfoGroup icon={CircleDollarSign} label="幣別">
                        <span className="font-semibold">{currency}</span>
                    </InfoGroup>
                    <InfoGroup icon={Tag} label="類別">
                        {category}
                    </InfoGroup>
                    <InfoGroup icon={Calendar} label="日期">
                        {format(new Date(date), "yyyy-MM-dd")}
                    </InfoGroup>
                    <InfoGroup icon={UserIcon} label="付款人">
                        {payer}
                    </InfoGroup>
                    <InfoGroup icon={UsersIcon} label="分攤細節">
                        {renderSplits()}
                    </InfoGroup>
                </div>
            </div>
            <div className="p-4 border-t border-border bg-surface shadow-inner">
                <button
                    type="button"
                    onClick={onCancel}
                    className={`w-full py-3 rounded-xl font-semibold bg-primary text-white hover:bg-primary-600 transition-colors`}
                >
                    Close
                </button>
            </div>
        </ExpenseContainer>
    );
};

export default ExpenseDetail;
