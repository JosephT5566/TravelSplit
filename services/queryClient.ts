import { QueryClient } from "@tanstack/react-query";

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
