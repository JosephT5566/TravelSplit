import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createIDBPersister } from "./persister";

const persister = createIDBPersister();

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchOnMount: true, // only trigger data refetching when the staleTime is expired.
            refetchOnReconnect: true,
            staleTime: 1000 * 60 * 30, // half an hour
        },
    },
});

persistQueryClient({
    queryClient,
    persister,
});
