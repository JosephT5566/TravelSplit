import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import {
    getIsSignedIn,
    getProfile,
    getTokenIfValid,
    signOut as clearSession,
    JwtPayload,
} from "../utils/auth";

type AuthState = {
    isSignedIn: boolean;
    profile: JwtPayload | null;
    token: string | null;
};

type AuthContextValue = AuthState & {
    setSignIn: (profileOverride?: JwtPayload | null) => void;
    signOut: () => void;
    refreshFromStorage: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildState(): AuthState {
    const token = getTokenIfValid();
    return {
        isSignedIn: getIsSignedIn() || !!token,
        profile: getProfile(),
        token,
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>(() => buildState());

    const refreshFromStorage = useCallback(() => {
        setState(buildState());
    }, []);

    const setSignIn = useCallback((profileOverride?: JwtPayload | null) => {
        setState({
            isSignedIn: true,
            profile: profileOverride ?? getProfile(),
            token: getTokenIfValid(),
        });
    }, []);

    const signOut = useCallback(() => {
        clearSession();
        setState({ isSignedIn: false, profile: null, token: null });
    }, []);

    const value = useMemo(
        () => ({
            ...state,
            setSignIn,
            signOut,
            refreshFromStorage,
        }),
        [state, setSignIn, signOut, refreshFromStorage]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuthStore() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuthStore must be used within an AuthProvider");
    }
    return ctx;
}

export function useAuthState() {
    const { isSignedIn, profile, token } = useAuthStore();
    return { isSignedIn, profile, token };
}

export function useAuthActions() {
    const { setSignIn, signOut, refreshFromStorage } = useAuthStore();
    return { setSignIn, signOut, refreshFromStorage };
}
