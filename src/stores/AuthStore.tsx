"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react";
import Cookies from "js-cookie";
import { useLocalStorageUser } from "../hooks/useLocalStorageUser";
import { User } from "../types";
import { clearExpensesCache } from "./ExpensesStore";
import { api } from "../../services/api";

type AuthState = {
    isSignedIn: boolean;
    user: User | null;
    isAuthInitialized: boolean;
};

type AuthActions = {
    signOut: () => void;
    saveUser: (user: User) => void;
};

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const {
        user: persistedUser,
        saveUser,
        clearUser,
        isInitialized: isAuthInitialized,
    } = useLocalStorageUser();

    useEffect(() => {
        const checkCookie = async () => {
            const isLoggedIn = Cookies.get("is_logged_in");
            console.log("is_logged_in cookie", isLoggedIn);

            // Case 1: No login cookie
            if (!isLoggedIn) {
                // If we have a persisted user but no login cookie, it means session expired or was cleared.
                // We should clean up local state.
                if (persistedUser) {
                    console.log("No login cookie found, clearing local user.");
                    clearUser();
                    clearExpensesCache();
                }
                return;
            }

            // Case 2: Login cookie exists, but no local user data
            if (isLoggedIn && !persistedUser) {
                try {
                    console.log(
                        "Login cookie found but no local user, fetching /me...",
                    );
                    const user = await api.getCurrentUser();
                    if (user) {
                        saveUser(user);
                    }
                } catch (error) {
                    console.error(
                        "Failed to restore session from cookie",
                        error,
                    );
                    // If fetching /me fails (e.g. 401 even with cookie), clear everything
                    clearUser();
                    clearExpensesCache();
                }
            }

            // Case 3: Login cookie exists AND local user exists
            // We assume they are in sync. We could optionally re-verify here if needed.
        };

        if (isAuthInitialized) {
            console.log("isAuthInitialized", isAuthInitialized);
            checkCookie();
        }
    }, [saveUser, clearUser, isAuthInitialized, persistedUser]);

    const signOut = useCallback(() => {
        const url = process.env.NEXT_PUBLIC_AUTH_PROXY;
        if (url) {
            const currentUrl = window.location.origin;
            window.location.href = `${url}/auth/travel-split/logout?redirect_to=${encodeURIComponent(currentUrl)}`;
        }
        clearUser();
        clearExpensesCache();
    }, [clearUser]);

    const value = useMemo(
        () => ({
            isSignedIn: !!persistedUser,
            user: persistedUser,
            isAuthInitialized,
            signOut,
            saveUser,
        }),
        [persistedUser, isAuthInitialized, signOut, saveUser],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
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
    const { signOut, saveUser } = useAuth();
    return { signOut, saveUser };
}
