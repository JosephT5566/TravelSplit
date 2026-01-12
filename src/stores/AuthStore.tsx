"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react";
import { useLocalStorageUser } from "../hooks/useLocalStorageUser";
import { User } from "../types";
import { useGoogleAuth } from "./GoogleAuthStore";

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
    const { user: googleUser, logout: googleLogout } = useGoogleAuth();
    const {
        user: persistedUser,
        saveUser,
        clearUser,
        isInitialized: isAuthInitialized,
    } = useLocalStorageUser();

    useEffect(() => {
        if (googleUser && googleUser.email !== persistedUser?.email) {
            saveUser(googleUser);
        }
    }, [googleUser, persistedUser, saveUser]);

    const signOut = useCallback(() => {
        googleLogout();
        clearUser();
    }, [googleLogout, clearUser]);

    const value = useMemo(
        () => ({
            isSignedIn: !!persistedUser,
            user: persistedUser,
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
