import { get, set, del } from "idb-keyval";
import { AppConfig, Expense, User } from "../src/types";

const CONFIG_KEY = "tripsplit_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";
const LAST_UPDATED_KEY = "tripsplit_last_updated";

export const storage = {
    // Configuration
    async getConfig(): Promise<AppConfig | undefined> {
        return get(CONFIG_KEY);
    },
    async saveConfig(config: AppConfig): Promise<void> {
        return set(CONFIG_KEY, config);
    },

    // User
    async getUser(): Promise<User | undefined> {
        return get(USER_KEY);
    },
    async saveUser(user: User): Promise<void> {
        return set(USER_KEY, user);
    },
    async clearUser(): Promise<void> {
        return del(USER_KEY);
    },

    // Expenses Cache
    async getExpenses(): Promise<Expense[]> {
        return (await get(EXPENSES_KEY)) || [];
    },
    async saveExpenses(expenses: Expense[]): Promise<void> {
        return set(EXPENSES_KEY, expenses);
    },

    // Cache Timestamp
    async getLastUpdated(): Promise<number | undefined> {
        return get(LAST_UPDATED_KEY);
    },
    async saveLastUpdated(timestamp: number): Promise<void> {
        return set(LAST_UPDATED_KEY, timestamp);
    },
};
