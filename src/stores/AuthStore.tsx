"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    useEffect,
} from "react";
import {
    getIsSignedIn,
    getProfile,
    getTokenIfValid,
    signOut as clearSession,
    JwtPayload,
} from "../utils/auth";
import { storage } from "../../services/storage";
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
    const [state, setState] = useState<AuthState>({
        isSignedIn: false,
        user: null,
        profile: null,
        token: null,
        isInitialized: false,
    });

    useEffect(() => {
        const initState = async () => {
            const storedUser = await storage.getUser();
            const signedIn = getIsSignedIn();
            const profile = signedIn ? getProfile() : null;
            const token = signedIn ? getTokenIfValid() : null;
            
            setState({
                user: storedUser || null,
                isSignedIn: signedIn && !!storedUser,
                profile,
                token,
                isInitialized: true,
            });
        };
        initState();
    }, []);

    const setSignIn = useCallback(async (newUser: User) => {
        await storage.saveUser(newUser);
        const signedIn = getIsSignedIn();
        setState((s) => ({
            ...s,
            user: newUser,
            isSignedIn: signedIn,
            profile: signedIn ? getProfile() : null,
            token: signedIn ? getTokenIfValid() : null,
        }));
    }, []);

    const signOut = useCallback(async () => {
        await storage.clearUser();
        clearSession();
        setState((s) => ({
            ...s,
            user: null,
            isSignedIn: false,
            profile: null,
            token: null,
        }));
    }, []);

    const value = useMemo(
        () => ({
            ...state,
            setSignIn,
            signOut,
        }),
        [state, setSignIn, signOut]
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
