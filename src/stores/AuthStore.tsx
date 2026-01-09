"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import {
    signOut as clearGsiSession,
} from "../utils/auth";
import { useUser, useSaveUser, useClearUser } from "../../services/dataFetcher";
import { User } from "../types";

type AuthState = {
    isSignedIn: boolean;
    user: User | null;
    isInitialized: boolean;
};

type AuthContextValue = AuthState & {
    setSignIn: (user: User) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { data: user, isSuccess: isInitialized } = useUser();
    const { mutateAsync: saveUser } = useSaveUser();
    const { mutateAsync: clearUser } = useClearUser();

    const isSignedIn = !!user?.email;

    const setSignIn = useCallback(
        async (newUser: User) => {
            await saveUser(newUser);
        },
        [saveUser]
    );

    const signOut = useCallback(async () => {
        await clearUser();
        clearGsiSession();
    }, [clearUser]);

    const value = useMemo(
        () => ({
            isSignedIn,
            user: user ?? null,
            isInitialized,
            setSignIn,
            signOut,
        }),
        [isSignedIn, user, isInitialized, setSignIn, signOut]
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
    const { isSignedIn, user, isInitialized } = useAuth();
    return {
        isSignedIn,
        user,
        isInitialized,
    };
}

export function useAuthActions() {
    const { setSignIn, signOut } = useAuth();
    return { setSignIn, signOut };
}