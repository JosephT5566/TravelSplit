import { get, set } from "idb-keyval";
import { PersistedClient } from "@tanstack/react-query-persist-client";

export const createIDBPersister = (idbValidKey: IDBValidKey = "reactQuery") => {
    return {
        persistClient: async (client: PersistedClient) => {
            set(idbValidKey, client);
        },
        restoreClient: async () => {
            return await get(idbValidKey);
        },
        removeClient: async () => {
            await set(idbValidKey, undefined);
        },
    };
};
