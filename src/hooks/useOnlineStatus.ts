"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onStoreChange: () => void) => {
    window.addEventListener("online", onStoreChange);
    window.addEventListener("offline", onStoreChange);

    return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
    };
};

const getSnapshot = () =>
    typeof navigator === "undefined" ? true : navigator.onLine;

const getServerSnapshot = () => true;

/**
 * Tracks browser online/offline connectivity as reactive state.
 */
export function useOnlineStatus(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
