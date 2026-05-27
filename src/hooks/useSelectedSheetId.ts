import { useSyncExternalStore } from "react";
import {
    getActiveSheetIdOrNull,
    SHEET_ID_CHANGE_EVENT,
} from "@/src/utils/sheetSelection";

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

export function useSelectedSheetId() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
