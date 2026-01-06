"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient } from "../services/queryClient";
import { createIDBPersister } from "../services/persister";

const persister = createIDBPersister();

export function ReactQueryProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}

// refs:
// https://medium.com/@you_0/react-query-is-all-you-need-25af68f44d4f
// https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient#persistqueryclientprovider