import { get, set, del } from "idb-keyval";
import { AppConfig, Expense, User } from "../src/types";

const APP_CONFIG_KEY = "tripsplit_app_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";
const LAST_UPDATED_KEY = "tripsplit_last_updated";

export const storage = {
    // Configuration
    async getAppConfig(): Promise<AppConfig | undefined> {
        return get(APP_CONFIG_KEY);
    },
    async saveAppConfig(config: AppConfig): Promise<void> {
        return set(APP_CONFIG_KEY, config);
    },

    // User (Expired) 
    // we don't need to handle the management manually. Since react-query will take care of it with queryKey)

    // async getUser(): Promise<User | undefined> {
    //     return get(USER_KEY);
    // },
    // async saveUser(user: User): Promise<void> {
    //     return set(USER_KEY, user);
    // },
    // async clearUser(): Promise<void> {
    //     return del(USER_KEY);
    // },

    // Expenses Cache
    // async getExpenses(): Promise<Expense[]> {
    //     return (await get(EXPENSES_KEY)) || [];
    // },
    // async saveExpenses(expenses: Expense[]): Promise<void> {
    //     return set(EXPENSES_KEY, expenses);
    // },

    // Cache Timestamp
    async getLastUpdated(): Promise<number | undefined> {
        return get(LAST_UPDATED_KEY);
    },
    async saveLastUpdated(timestamp: number): Promise<void> {
        return set(LAST_UPDATED_KEY, timestamp);
    },
};
