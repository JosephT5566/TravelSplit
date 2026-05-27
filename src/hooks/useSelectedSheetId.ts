import { useSyncExternalStore } from "react";
import {
    getActiveSheetIdOrNull,
    SHEET_ID_CHANGE_EVENT,
} from "@/src/utils/sheetSelection";

// Subscribe to both in-page updates and cross-tab localStorage changes.
const subscribe = (onStoreChange: () => void) => {
    window.addEventListener(SHEET_ID_CHANGE_EVENT, onStoreChange);
    window.addEventListener("storage", onStoreChange);

    return () => {
        window.removeEventListener(SHEET_ID_CHANGE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
    };
};

const getSnapshot = () => getActiveSheetIdOrNull();

const getServerSnapshot = () => null;

/**
 * Reads the active Google Sheet ID as reactive state.
 * Components using this hook update immediately after saveSelectedSheetId runs.
 */
export function useSelectedSheetId() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
