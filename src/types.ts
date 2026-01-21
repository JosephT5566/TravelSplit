export type Expense = {
    timestamp: string;
    date: string;
    itemName: string;
    category: string;
    payer: string;
    amount: number;
    currency: string;
    splitsJson: Record<string, number>;
    exchangeRate: number;
};

export type ExpensesResponse = AppScriptResponse<Expense[]>;

export type AddExpenseRequest = Omit<Expense, "timestamp">;

export type EditExpenseRequest = Omit<Expense, "splitsJson"> & {
    splitsJson: string;
};

export const isAddExpenseRequest = (
    r: AddExpenseRequest | EditExpenseRequest
): r is AddExpenseRequest => "timestamp" in r;

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

export type User = {
    email: string;
    name: string;
    picture?: string;
};

export type ApiState = {
    isFetching: boolean;
    error: string | null;
    lastUpdated: number | null;
};

export type AppConfig = {
    theme: string;
};

export type SheetConfig = {
    startDate: string;
    endDate?: string;
    currencies: Record<string, number>;
    users: Record<string, string>;
    categories: string[];
    resources: {
        title?: string;
        url?: string;
        type?: 'google_docs' | 'google_sheets';
    }[];
}
