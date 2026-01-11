"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react";
import {
    useGetUser,
    useSaveUser,
    useClearUser,
} from "../../services/dataFetcher";
import { User } from "../types";
import { useGoogleAuth } from "./GoogleAuthStore";

type AuthState = {
    isSignedIn: boolean;
    // The user from the persistent cache
    user: User | null;
    // Whether the user has been loaded from the cache
    isAuthInitialized: boolean;
};

type AuthActions = {
    signOut: () => void;
    saveUser: (user: User) => Promise<void>;
};

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // Live user session from Google
    const { user: googleUser, logout: googleLogout } = useGoogleAuth();
    
    // Persisted user state from react-query
    const { data: persistedUser, isSuccess: isAuthInitialized } = useGetUser();
    const { mutateAsync: saveUser } = useSaveUser();
    const { mutateAsync: clearUser } = useClearUser();

    // Sync live session to persisted state
    useEffect(() => {
        if (googleUser) {
            // User signed in via Google, persist the user data
            if (googleUser.email !== persistedUser?.email) {
                saveUser(googleUser);
            }
        } else {
            // User signed out from Google, clear persisted data
            if (persistedUser) {
                clearUser();
            }
        }
    }, [googleUser, persistedUser, saveUser, clearUser]);

    const signOut = useCallback(() => {
        // This will trigger the useEffect above to clear the persisted user
        googleLogout();
    }, [googleLogout]);

    const value = useMemo(
        () => ({
            isSignedIn: !!persistedUser?.email,
            user: persistedUser ?? null,
            isAuthInitialized,
            signOut,
            saveUser,
        }),
        [persistedUser, isAuthInitialized, signOut, saveUser]
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