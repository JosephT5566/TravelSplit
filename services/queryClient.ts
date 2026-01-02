import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createIDBPersister } from "./persister";

const persister = createIDBPersister();

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: false,
            staleTime: 1000 * 60 * 30, // half an hour
        },
    },
});

persistQueryClient({
    queryClient,
    persister,
});
