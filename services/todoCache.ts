import type { QueryClient } from "@tanstack/react-query";
import type {
    CreateTodoItemInput,
    CreateTodosResponse,
    DeleteTodoResponse,
    TodoItem,
    UpdateTodoRequest,
    UpdateTodoResponse,
} from "../src/types";
import { api, TodoApiError } from "./api";
import { TODOS_KEY } from "./cacheKeys";

type TodoMutationDeps = {
    queryClient: QueryClient;
    sheetId: string;
    userEmail: string;
    canReplayWrite: () => boolean;
};

type UpdateTodoContext = {
    isOptimistic: boolean;
    previousChecked?: boolean;
    optimisticChecked?: boolean;
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
    const trimmedSheetId = sheetId?.trim();
    const trimmedOwnerEmail = ownerEmail?.trim();

    return {
        queryKey: getTodosQueryKey(sheetId, ownerEmail),
        queryFn: ({ signal }: { signal: AbortSignal }) => {
            if (!trimmedSheetId || !trimmedOwnerEmail) {
                return Promise.resolve<TodoItem[]>([]);
            }
            return api.getTodos(trimmedSheetId, trimmedOwnerEmail, signal);
        },
        enabled:
            isSignedIn && Boolean(trimmedSheetId) && Boolean(trimmedOwnerEmail),
        retry: (failureCount: number, error: Error) =>
            !(
                error instanceof TodoApiError &&
                error.status !== undefined &&
                error.status >= 400 &&
                error.status < 500
            ) && failureCount < 3,
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
        onMutate: async () => {
            if (typeof navigator !== "undefined" && navigator.onLine === false) {
                return;
            }
            await queryClient.cancelQueries({ queryKey, exact: true });
        },
        onSuccess: (data: CreateTodosResponse) => {
            const existing = queryClient.getQueryData<TodoItem[]>(queryKey);
            if (!Array.isArray(existing)) {
                void queryClient.invalidateQueries({ queryKey, exact: true });
                return;
            }
            queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                if (!Array.isArray(old)) {
                    return old;
                }
                const existingIds = new Set(old.map((item) => item.id));
                const appended: TodoItem[] = [];
                for (const item of data.items) {
                    if (!existingIds.has(item.id)) {
                        existingIds.add(item.id);
                        appended.push(item);
                    }
                }
                return appended.length > 0 ? [...old, ...appended] : old;
            });
        },
    };
}

function isCheckOnlyUpdate(
    input: UpdateTodoRequest,
): input is {
    id: string;
    checked: boolean;
    text?: undefined;
    category?: undefined;
} {
    return (
        input.checked !== undefined &&
        input.text === undefined &&
        input.category === undefined
    );
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
            if (typeof navigator !== "undefined" && navigator.onLine === false) {
                return { isOptimistic: false };
            }

            await queryClient.cancelQueries({ queryKey, exact: true });

            if (!isCheckOnlyUpdate(input)) {
                return { isOptimistic: false };
            }

            const current = queryClient.getQueryData<TodoItem[]>(queryKey);
            const previousItem = Array.isArray(current)
                ? current.find((item) => item.id === input.id)
                : undefined;

            if (!previousItem) {
                return { isOptimistic: false };
            }

            queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((item) =>
                    item.id === input.id
                        ? { ...item, checked: input.checked }
                        : item,
                );
            });

            return {
                isOptimistic: true,
                previousChecked: previousItem.checked,
                optimisticChecked: input.checked,
            };
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
            if (
                !context?.isOptimistic ||
                context.previousChecked === undefined ||
                context.optimisticChecked === undefined
            ) {
                return;
            }
            const { previousChecked, optimisticChecked } = context;
            queryClient.setQueryData<TodoItem[]>(queryKey, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((item) =>
                    item.id === input.id && item.checked === optimisticChecked
                        ? { ...item, checked: previousChecked }
                        : item,
                );
            });
            void queryClient.invalidateQueries({ queryKey, exact: true });
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
        onMutate: async () => {
            if (typeof navigator !== "undefined" && navigator.onLine === false) {
                return;
            }
            await queryClient.cancelQueries({ queryKey, exact: true });
        },
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
