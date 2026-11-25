import { useId, useRef, useState } from "react";
import { Calculator, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    calculateExpenseAmount,
    MAX_CALCULATOR_EXPRESSION_LENGTH,
} from "@/src/utils/expenseCalculator";

const keys = [
    "7", "8", "9", "÷",
    "4", "5", "6", "×",
    "1", "2", "3", "−",
    ".", "0", "backspace", "+",
] as const;

const keyLabels: Partial<Record<(typeof keys)[number], string>> = {
    "÷": "除",
    "×": "乘",
    "−": "減",
    "+": "加",
    ".": "小數點",
    backspace: "刪除最後一個字元",
};

const messages = {
    empty: "請輸入算式",
    incomplete: "請完成算式",
    "divide-by-zero": "除數不能為零",
    "invalid-amount": "結果須為有效的正數金額",
    "out-of-range": "結果超出可儲存的金額範圍",
};

export function ExpenseCalculator({
    amount,
    canApplyAmount,
    onApply,
}: {
    amount: string;
    canApplyAmount: (amount: string) => boolean;
    onApply: (amount: string) => void;
}) {
    const [expression, setExpression] = useState<string | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    const open = expression !== null;
    const calculation = calculateExpenseAmount(expression ?? "");
    const result: typeof calculation | { kind: "out-of-range" } =
        calculation.kind === "amount" && !canApplyAmount(calculation.amount)
            ? { kind: "out-of-range" }
            : calculation;

    const close = () => {
        setExpression(null);
        triggerRef.current?.focus();
    };

    return (
        <div className="mt-2">
            <Button asChild variant="ghost" className="min-h-11 text-text-muted">
                <button
                    ref={triggerRef}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => {
                        if (open) close();
                        else {
                            setExpression(amount);
                            triggerRef.current?.focus();
                        }
                    }}
                >
                    <Calculator aria-hidden="true" />
                    計算機
                </button>
            </Button>
            <div id={panelId} hidden={!open}>
                {open && (
                    <div className="space-y-2 border-t border-border pt-2">
                        <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1 text-right tabular-nums">
                                <div className="break-all text-sm text-text-muted">
                                    <span className="sr-only">算式</span>
                                    {expression}
                                </div>
                                <div aria-live="polite" aria-atomic="true" className="break-all font-medium">
                                    {result.kind === "amount" ? (
                                        <><span className="sr-only">結果 </span>{result.amount}</>
                                    ) : (
                                        <span className="text-sm text-text-muted">{messages[result.kind]}</span>
                                    )}
                                </div>
                            </div>
                            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setExpression("")}>
                                清除
                            </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                            {keys.map((key) => (
                                <Button
                                    key={key}
                                    type="button"
                                    variant={keyLabels[key] && key !== "." ? "secondary" : "outline"}
                                    className="min-h-11 min-w-0 px-0 text-base tabular-nums"
                                    aria-label={keyLabels[key]}
                                    onClick={() => setExpression((current) => {
                                        if (current === null) return null;
                                        if (key === "backspace") return current.slice(0, -1);
                                        return current.length < MAX_CALCULATOR_EXPRESSION_LENGTH
                                            ? current + key
                                            : current;
                                    })}
                                >
                                    {key === "backspace" ? <Delete aria-hidden="true" /> : key}
                                </Button>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" className="min-h-11" onClick={close}>
                                取消
                            </Button>
                            <Button
                                type="button"
                                className="min-h-11 text-primary-fg"
                                disabled={result.kind !== "amount"}
                                onClick={() => {
                                    if (result.kind !== "amount") return;
                                    onApply(result.amount);
                                    close();
                                }}
                            >
                                套用金額
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
