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

// RawExpense represents the data structure directly from the Google Cloud Function's sheet.
// It uses Chinese keys and may contain additional fields not directly mapped to 'Expense'.
export interface RawExpense {
    "時間戳記": string;
    "日期": string;
    "星期": string;
    "類別": string;
    "品項": string;
    "金額": string;
    "貨幣": string;
    "匯率": string;
    "付款人": string;
    "個人小記": string;
    "已結算": string;
    [key: string]: string | number | null; // For dynamic user columns and other potential fields
}

export type AddExpenseResponse = {
    timestamp: string; // The timestamp of the operation
    operatorName: string;
    newRecord: RawExpense; // The raw expense object that was added
    isOperatorInvolved: boolean;
};

export type DeleteExpenseResponse = {
    message: string;
    deletedTimestamp: string;
    deletedCount: number;
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
