"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import Cookies from "js-cookie";
import { useLocalStorageUser } from "../hooks/useLocalStorageUser";
import { User } from "../types";
import { clearExpensesCache } from "./ExpensesStore";
import { api } from "../../services/api";
import { todoSyncManager } from "../../services/todoSyncManager";
import logger from "@/src/utils/logger";
import { hasAuthErrorSearchParam } from "@/src/utils/authError";
import { getActiveSheetIdOrNull } from "@/src/utils/sheetSelection";

export type SignOutOptions = {
    /**
     * Clear the current user's todo outbox before redirecting.
     * Pass `true` only when the outbox is already empty or after explicit user confirmation.
     */
    clearTodoOutbox?: boolean;
};

export type PrepareSignOutResult = {
    canSignOutImmediately: boolean;
    unsyncedCount: number;
};

type AuthState = {
    isSignedIn: boolean;
    user: User | null;
    isAuthInitialized: boolean;
};

type AuthActions = {
    signOut: (options?: SignOutOptions) => Promise<void>;
    prepareSignOut: () => Promise<PrepareSignOutResult>;
    saveUser: (user: User) => void;
};

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const {
        user: persistedUser,
        saveUser,
        clearUser,
        isInitialized: isLocalUserInitialized,
    } = useLocalStorageUser();
    const [isAuthInitialized, setIsAuthInitialized] = useState(false);

    useEffect(() => {
        const checkCookie = async () => {
            try {
                if (hasAuthErrorSearchParam()) {
                    todoSyncManager.disposeActiveEngine();
                    clearUser();
                    clearExpensesCache();
                    return;
                }

                const isLoggedIn = Cookies.get("is_logged_in");
                logger.log("is_logged_in cookie", isLoggedIn);

                // Case 1: No login cookie
                if (!isLoggedIn) {
                    // If we have a persisted user but no login cookie, it means session expired or was cleared.
                    // We should clean up local state (preserving any persisted todo outbox for re-login).
                    if (persistedUser) {
                        logger.log("No login cookie found, clearing local user.");
                        todoSyncManager.disposeActiveEngine();
                        clearUser();
                        clearExpensesCache();
                    }
                    return;
                }

                // Case 2: Login cookie exists, but no local user data
                if (!persistedUser) {
                    try {
                        logger.log(
                            "Login cookie found but no local user, fetching /me...",
                        );
                        const user = await api.getCurrentUser();
                        if (user) {
                            saveUser(user);
                        }
                    } catch (error) {
                        logger.error(
                            "Failed to restore session from cookie",
                            error,
                        );
                        // If fetching /me fails (e.g. 401 even with cookie), clear auth state
                        // without clearing persisted todo outbox entries.
                        todoSyncManager.disposeActiveEngine();
                        clearUser();
                        clearExpensesCache();
                    }
                }
            } finally {
                setIsAuthInitialized(true);
            }
        };

        if (isLocalUserInitialized) {
            logger.log("isLocalUserInitialized", isLocalUserInitialized);
            checkCookie();
        }
    }, [saveUser, clearUser, isLocalUserInitialized, persistedUser]);

    const prepareSignOut = useCallback(async (): Promise<PrepareSignOutResult> => {
        const sheetId = getActiveSheetIdOrNull();
        const ownerEmail = persistedUser?.email;
        if (!sheetId || !ownerEmail) {
            return { canSignOutImmediately: true, unsyncedCount: 0 };
        }
        const result = await todoSyncManager.attemptSignOutFlush({
            sheetId,
            ownerEmail,
        });
        return {
            canSignOutImmediately: result.flushed,
            unsyncedCount: result.remainingCount,
        };
    }, [persistedUser?.email]);

    const signOut = useCallback(
        async (options?: SignOutOptions) => {
            const ownerEmail = persistedUser?.email;
            if (options?.clearTodoOutbox && ownerEmail) {
                await todoSyncManager.clearOutboxAfterConfirmedSignOut(
                    ownerEmail,
                );
            } else {
                todoSyncManager.disposeActiveEngine();
            }
            clearUser();
            clearExpensesCache();
            const url = process.env.NEXT_PUBLIC_AUTH_PROXY;
            if (url) {
                const currentUrl =
                    window.location.origin + window.location.pathname;
                window.location.href = `${url}/auth/travel-split/logout?redirect_to=${encodeURIComponent(currentUrl)}`;
            }
        },
        [clearUser, persistedUser?.email],
    );

    const value = useMemo(
        () => ({
            isSignedIn: !!persistedUser,
            user: persistedUser,
            isAuthInitialized,
            signOut,
            prepareSignOut,
            saveUser,
        }),
        [persistedUser, isAuthInitialized, signOut, prepareSignOut, saveUser],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export function useAuthState() {
    const { isSignedIn, user, isAuthInitialized } = useAuth();
    return {
        isSignedIn,
        user,
        isAuthInitialized,
    };
}

export function useAuthActions() {
    const { signOut, prepareSignOut, saveUser } = useAuth();
    return { signOut, prepareSignOut, saveUser };
}
