import { get, set } from "idb-keyval";

export const createIDBPersister = (idbValidKey: IDBValidKey = "reactQuery") => {
    return {
        persistClient: async (client: any) => {
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
