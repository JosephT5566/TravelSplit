import type { QueryClient } from "@tanstack/react-query";
import type {
    CreateTodoItemInput,
    CreateTodosResponse,
    DeleteTodoResponse,
    TodoItem,
    UpdateTodoRequest,
    UpdateTodoResponse,
} from "../src/types";
import { api } from "./api";
import { EXPENSES_KEY, TODOS_KEY } from "./cacheKeys";

export type TodoMutationDeps = {
    queryClient: QueryClient;
    sheetId: string;
    userEmail: string;
    canReplayWrite: () => boolean;
};

type UpdateTodoContext = {
    isOptimistic: boolean;
    previousItem?: TodoItem;
};

export function getTodosQueryKey(
    sheetId: string | null | undefined,
    ownerEmail: string | null | undefined,
) {
    return [TODOS_KEY, sheetId, ownerEmail] as const;
}

export function createTodosQueryOptions({
    sheetId,
    ownerEmail,
    isSignedIn,
}: {
    sheetId: string | null | undefined;
    ownerEmail: string | null | undefined;
    isSignedIn: boolean;
}) {
    return {
        queryKey: getTodosQueryKey(sheetId, ownerEmail),
        queryFn: ({ signal }: { signal: AbortSignal }) => {
            if (!sheetId || !ownerEmail) {
                return Promise.resolve<TodoItem[]>([]);
            }
            return api.getTodos(sheetId, ownerEmail, signal);
        },
        enabled: isSignedIn && !!sheetId && !!ownerEmail,
    };
}

export function createCreateTodosMutationOptions({
    queryClient,
    sheetId,
    userEmail,
    canReplayWrite,
}: TodoMutationDeps) {
    const queryKey = getTodosQueryKey(sheetId, userEmail);
    return {
        mutationFn: (items: CreateTodoItemInput[]) =>
            api.createTodos(sheetId, items, canReplayWrite),
        networkMode: "always" as const,
        retry: false as const,
        onSuccess: (data: CreateTodosResponse) => {
            queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                if (!Array.isArray(old)) {
                    return [...data.items];
                }
                return [...old, ...data.items];
            });
        },
    };
}

function isCheckOnlyUpdate(
    input: UpdateTodoRequest,
): input is { id: string; checked: boolean; text?: undefined } {
    return input.checked !== undefined && input.text === undefined;
}

export function createUpdateTodoMutationOptions({
    queryClient,
    sheetId,
    userEmail,
    canReplayWrite,
}: TodoMutationDeps) {
    const queryKey = getTodosQueryKey(sheetId, userEmail);
    return {
        mutationFn: (input: UpdateTodoRequest) =>
            api.updateTodo(sheetId, input, canReplayWrite),
        networkMode: "always" as const,
        retry: false as const,
        onMutate: async (
            input: UpdateTodoRequest,
        ): Promise<UpdateTodoContext> => {
            if (
                !isCheckOnlyUpdate(input) ||
                (typeof navigator !== "undefined" &&
                    navigator.onLine === false)
            ) {
                return { isOptimistic: false };
            }

            await queryClient.cancelQueries({ queryKey, exact: true });
            const current = queryClient.getQueryData<TodoItem[]>(queryKey);
            const previousItem = Array.isArray(current)
                ? current.find((item) => item.id === input.id)
                : undefined;

            if (previousItem) {
                queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                    if (!Array.isArray(old)) return old;
                    return old.map((item) =>
                        item.id === input.id
                            ? { ...item, checked: input.checked }
                            : item,
                    );
                });
            }

            return { isOptimistic: true, previousItem };
        },
        onSuccess: (data: UpdateTodoResponse) => {
            queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((item) =>
                    item.id === data.item.id ? data.item : item,
                );
            });
        },
        onError: (
            _error: Error,
            input: UpdateTodoRequest,
            context: UpdateTodoContext | undefined,
        ) => {
            if (!context?.isOptimistic || !context.previousItem) {
                return;
            }
            const previousItem = context.previousItem;
            queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((item) =>
                    item.id === input.id ? previousItem : item,
                );
            });
        },
    };
}

export function createDeleteTodoMutationOptions({
    queryClient,
    sheetId,
    userEmail,
    canReplayWrite,
}: TodoMutationDeps) {
    const queryKey = getTodosQueryKey(sheetId, userEmail);
    return {
        mutationFn: (id: string) =>
            api.deleteTodo(sheetId, id, canReplayWrite),
        networkMode: "always" as const,
        retry: false as const,
        onSuccess: (data: DeleteTodoResponse) => {
            queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                if (!Array.isArray(old)) {
                    return old;
                }
                return old.filter((item) => item.id !== data.deletedId);
            });
        },
    };
}

export function clearUserQueryCaches(client: QueryClient) {
    client.removeQueries({ queryKey: [EXPENSES_KEY] });
    client.removeQueries({ queryKey: [TODOS_KEY] });
}
