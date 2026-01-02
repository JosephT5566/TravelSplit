import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppConfig, Expense, User } from "../src/types";
import { storage } from "./idbStorage"; // We will create this file

const CONFIG_KEY = "tripsplit_config";
const EXPENSES_KEY = "tripsplit_expenses";
const USER_KEY = "tripsplit_user";

// AppConfig hooks
export const useConfig = () => {
    const queryClient = useQueryClient();
    return useQuery<AppConfig | undefined, Error>({
        queryKey: [CONFIG_KEY],
        queryFn: storage.getConfig,
        initialData: undefined,
    });
};

export const useSaveConfig = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, AppConfig>({
        mutationFn: storage.saveConfig,
        onSuccess: (data, variables) => {
            queryClient.setQueryData([CONFIG_KEY], variables);
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
import { api } from "./api";

export const useExpenses = (userEmail: string | undefined) => {
    return useQuery<Expense[], Error>({
        queryKey: [EXPENSES_KEY, userEmail],
        queryFn: () => {
            if (!userEmail) {
                return Promise.resolve([]);
            }
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
