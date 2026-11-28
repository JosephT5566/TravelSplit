import type { TodoItem } from "../src/types";
import { api, TodoApiError } from "./api";
import { TODOS_KEY } from "./cacheKeys";

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
