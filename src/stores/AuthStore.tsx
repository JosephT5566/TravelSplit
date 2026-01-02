"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
} from "react";
import {
    getIsSignedIn,
    getProfile,
    getTokenIfValid,
    signOut as clearSession,
    JwtPayload,
} from "../utils/auth";
import { useUser, useSaveUser, useClearUser } from "../../services/cacheStorage";
import { User } from "../types";

type AuthState = {
    isSignedIn: boolean;
    user: User | null;
    profile: JwtPayload | null;
    token: string | null;
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

    const signedIn = getIsSignedIn() && !!user;
    const profile = signedIn ? getProfile() : null;
    const token = signedIn ? getTokenIfValid() : null;

    const setSignIn = useCallback(async (newUser: User) => {
        await saveUser(newUser);
    }, [saveUser]);

    const signOut = useCallback(async () => {
        await clearUser();
        clearSession();
    }, [clearUser]);

    const value = useMemo(
        () => ({
            isSignedIn: signedIn,
            user: user || null,
            profile,
            token,
            isInitialized,
            setSignIn,
            signOut,
        }),
        [signedIn, user, profile, token, isInitialized, setSignIn, signOut]
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
    const { isSignedIn, user, profile, token, isInitialized } = useAuth();
    return { isSignedIn, user, profile, token, isInitialized };
}

export function useAuthActions() {
    const { setSignIn, signOut } = useAuth();
    return { setSignIn, signOut };
}
