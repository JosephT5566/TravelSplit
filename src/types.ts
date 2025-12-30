export type Expense = {
    timestamp: string;
    date: string;
    itemName: string;
    category: string;
    payer: string;
    amount: number;
    currency: string;
    splitsJson: string;
};

export type ExpensesResponse = AppScriptResponse<Expense[]>;

export type AddExpenseRequest = {
    date: string;
    itemName: string;
    category: string;
    payer: string;
    amount: number;
    currency: string;
    splitsJson: string;
};

export type AppScriptResponse<T, E = string> =
    | { ok: true; result: T }
    | { ok: false; error?: E };

export type SuccessResponse<T> = Extract<AppScriptResponse<T>, { ok: true }>;
export type FailureResponse<E = string> = Extract<
    AppScriptResponse<never, E>,
    { ok: false }
>;

// type guard
export const isSuccess = <T, E = string>(
    r: AppScriptResponse<T, E>
): r is SuccessResponse<T> => r.ok;
export const isFailure = <T, E = string>(
    r: AppScriptResponse<T, E>
): r is FailureResponse<E> => !r.ok;

export const TransactionType = {
    EXPENSE: "expense",
    INCOME: "income",
} as const;
