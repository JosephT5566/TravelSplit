import { QueryClient } from "@tanstack/react-query";
import {
    persistQueryClientSave,
    type Persister,
} from "@tanstack/react-query-persist-client";
import { EXPENSES_KEY, TODOS_KEY, USER_STORAGE_KEY } from "./cacheKeys";
import { createIDBPersister } from "./persister";
import logger from "@/src/utils/logger";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchOnMount: true, // only trigger data refetching when the staleTime is expired.
            refetchOnReconnect: true,
            staleTime: 1000 * 60 * 60 * 24, // 1 day
        },
    },
});

export function clearUserQueryCaches(
    client: QueryClient,
    persister: Persister = createIDBPersister(),
) {
    client.removeQueries({ queryKey: [EXPENSES_KEY] });
    client.removeQueries({ queryKey: [TODOS_KEY] });
    void persistQueryClientSave({
        queryClient: client,
        persister,
    }).catch((error) => {
        logger.error("Could not persist cleared query cache.", error);
    });
}

export function clearUserCachesIfSignedOut(
    client: QueryClient,
    storage?: Pick<Storage, "getItem"> | null,
    persister: Persister = createIDBPersister(),
): boolean {
    let storedUser: string | null = null;
    try {
        const resolvedStorage =
            storage !== undefined
                ? storage
                : typeof window !== "undefined"
                  ? window.localStorage
                  : null;
        storedUser = resolvedStorage?.getItem(USER_STORAGE_KEY) ?? null;
    } catch {
        storedUser = null;
    }

    if (storedUser === null) {
        clearUserQueryCaches(client, persister);
        return true;
    }
    return false;
}
