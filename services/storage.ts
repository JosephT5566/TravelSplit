import { get, set, del } from "idb-keyval";
import { AppConfig, Expense, User } from "../../types";

const CONFIG_KEY = "tripsplit_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";

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
};
