import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Expense, User, SheetConfig, AppConfig } from "../src/types";
import { storage } from "./idbStorage"; // We will create this file
import { api } from "./api";

const SHEET_CONFIG_KEY = "tripsplit_sheet_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";

// AppConfig hooks
export const useGetSheetConfig = () => {
    return useQuery<SheetConfig, Error>({
        queryKey: [SHEET_CONFIG_KEY],
        queryFn: async (): Promise<SheetConfig> => {
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

            return sheetConfig;
        },
        initialData: undefined,
    });
};

// expired
export const useSaveConfig = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, AppConfig>({
        mutationFn: storage.saveAppConfig,
        onSuccess: (data, newConfig) => {
            queryClient.setQueryData([SHEET_CONFIG_KEY], newConfig);
            // invalidateQueries: is used to invalidate and refetch single or multiple queries in the cache based on their query keys
            // ref: https://mini-ghost.dev/posts/tanstack-query-source-code-3/
            // queryClient.invalidateQueries({ queryKey: [CONFIG_KEY] });
        },
    });
};

// User hooks
export const useUser = () => {
    return useQuery<User, Error>({
        queryKey: [USER_KEY],
        queryFn: async (): Promise<User> => {
            return { email: "", name: "" };
        },
        initialData: undefined,
    });
};

export const useSaveUser = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, User>({
        mutationFn: () => Promise.resolve(),
        onSuccess: (data, variables) => {
            queryClient.setQueryData([USER_KEY], variables);
        },
    });
};

export const useClearUser = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, void>({
        mutationFn: () => Promise.resolve(),
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
        mutationFn: () => Promise.resolve(),
        onSuccess: (data, variables) => {
            queryClient.setQueryData([EXPENSES_KEY], variables);
        },
    });
};
