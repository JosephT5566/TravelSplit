import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppConfig, Expense, User, Config, SheetConfig } from "../src/types";
import { storage } from "./idbStorage"; // We will create this file
import { api } from "./api";

const CONFIG_KEY = "tripsplit_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";

// AppConfig hooks
export const useGetConfig = () => {
    return useQuery<Config | undefined, Error>({
        queryKey: [CONFIG_KEY],
        queryFn: async (): Promise<Config | undefined> => {
            const appConfig = await storage.getConfig();
            if (!appConfig) {
                return undefined;
            }

            // Start with a base config object that is of type Config
            let sheetConfig: SheetConfig = {
                currencies: {},
                users: {},
                categories: [],
            };

            try {
                sheetConfig = await api.getSheetConfig();
            } catch (error) {
                console.error("Failed to fetch sheet config:", error);
                // sheetConfig properties will be missing, which is fine for Partial<SheetConfig>
            }

            return { ...appConfig, ...sheetConfig };
        },
        initialData: undefined,
    });
};

export const useSaveConfig = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, AppConfig>({
        mutationFn: storage.saveConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [CONFIG_KEY] });
        },
    });
};

// User hooks
export const useUser = () => {
    return useQuery<User | undefined, Error>({
        queryKey: [USER_KEY],
        queryFn: storage.getUser,
        initialData: undefined,
    });
};

export const useSaveUser = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, User>({
        mutationFn: storage.saveUser,
        onSuccess: (data, variables) => {
            queryClient.setQueryData([USER_KEY], variables);
        },
    });
};

export const useClearUser = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, void>({
        mutationFn: storage.clearUser,
        onSuccess: () => {
            queryClient.setQueryData([USER_KEY], undefined);
        },
    });
};

// Expenses hooks
export const useExpensesQuery = (userEmail: string | undefined) => {
    return useQuery<Expense[], Error>({
        queryKey: [EXPENSES_KEY, userEmail],
        queryFn: () => {
            if (!userEmail) {
                return Promise.resolve([]);
            }
            console.log("🚀 Fetching expenses api for user:", userEmail);
            return api.getExpenses(userEmail);
        },
        enabled: !!userEmail,
    });
};

export const useSaveExpenses = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, Expense[]>({
        mutationFn: storage.saveExpenses,
        onSuccess: (data, variables) => {
            queryClient.setQueryData([EXPENSES_KEY], variables);
        },
    });
};
