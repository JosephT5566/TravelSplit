"use client";

import Script from "next/script";
import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    useRef,
} from "react";
import { User } from "../types";

// Helper to get user info from Google
async function getUserInfo(accessToken: string): Promise<Omit<User, 'accessToken'>> {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        if (errorBody?.error?.message.includes("Invalid Credentials")) {
            throw new Error("TOKEN_EXPIRED");
        }
        throw new Error("Failed to get user info");
    }
    const userInfo = await res.json();
    return {
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
        picture: userInfo.picture,
    };
}

// Type definitions for the context
type GoogleAuthContextValue = {
    user: User | null;
    login: () => void;
    logout: () => void;
    refreshToken: () => Promise<User>;
    isGsiScriptReady: boolean;
};

const GoogleAuthContext = createContext<GoogleAuthContextValue | undefined>(
    undefined
);

// The provider component
export const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [isGsiScriptReady, setGsiScriptReady] = useState(false);
    const clientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
    const refreshTokenPromiseResolver = useRef<((user: User) => void) | null>(null);
    const refreshTokenPromiseRejecter = useRef<((error: Error) => void) | null>(null);

    const handleGsiReady = useCallback(() => {
        const EMAIL_WHITE_LIST: string[] = (
            process.env.NEXT_PUBLIC_EMAIL_WHITE_LIST || ""
        ).split(",");

        if (!window.google) {
            console.error("Google script loaded but window.google not found.");
            return;
        }

        clientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID || "",
            scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
            callback: async (tokenResponse) => {
                if (tokenResponse.error) {
                    const error = new Error(tokenResponse.error_description);
                    console.error("Google login failed:", error);
                    if (refreshTokenPromiseRejecter.current) {
                        refreshTokenPromiseRejecter.current(error);
                    }
                    return;
                }

                try {
                    const accessToken = tokenResponse.access_token;
                    const userInfo = await getUserInfo(accessToken);

                    if (!userInfo.email) {
                        throw new Error("Google login failed: Email not found");
                    }

                    const email = String(userInfo.email).toLowerCase();
                    if (
                        EMAIL_WHITE_LIST.length > 1 &&
                        !EMAIL_WHITE_LIST.includes(email)
                    ) {
                        throw new Error("Google login failed: Email not in whitelist");
                    }
                    
                    const newUser: User = { ...userInfo, accessToken };
                    setUser(newUser);

                    if (refreshTokenPromiseResolver.current) {
                        refreshTokenPromiseResolver.current(newUser);
                    }

                } catch (e) {
                    const error = e instanceof Error ? e : new Error("Google login failed");
                    console.error(error);
                    if (refreshTokenPromiseRejecter.current) {
                        refreshTokenPromiseRejecter.current(error);
                    }
                } finally {
                    refreshTokenPromiseResolver.current = null;
                    refreshTokenPromiseRejecter.current = null;
                }
            },
            error_callback: (error) => {
                 if (refreshTokenPromiseRejecter.current) {
                    refreshTokenPromiseRejecter.current(new Error(error.message));
                    refreshTokenPromiseResolver.current = null;
                    refreshTokenPromiseRejecter.current = null;
                 }
            }
        });
        setGsiScriptReady(true);
    }, []);

    const login = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.requestAccessToken({ prompt: "consent" });
        } else {
            console.error("Google Auth client not initialized.");
        }
    }, []);

    const logout = useCallback(() => {
        console.log("Google Logging out user:", user);
        if (user?.accessToken) {
            google.accounts.oauth2.revoke(user.accessToken, () => {
                console.log("Access token revoked");
            });
        }
        setUser(null); // this also trigger the clearUser mutation in the AuthStore
    }, [user]);

    const refreshToken = useCallback((): Promise<User> => {
        return new Promise((resolve, reject) => {
            if (clientRef.current) {
                refreshTokenPromiseResolver.current = resolve;
                refreshTokenPromiseRejecter.current = reject;
                clientRef.current.requestAccessToken({ prompt: "none" });
            } else {
                reject(new Error("Google Auth client not initialized."));
            }
        });
    }, []);

    const value = useMemo(
        () => ({
            user,
            login,
            logout,
            refreshToken,
            isGsiScriptReady,
        }),
        [user, login, logout, refreshToken, isGsiScriptReady]
    );

    return (
        <>
            <Script
                src="https://accounts.google.com/gsi/client"
                async
                defer
                onReady={handleGsiReady}
            ></Script>
            <GoogleAuthContext.Provider value={value}>
                {children}
            </GoogleAuthContext.Provider>
        </>
    );
};

export const useGoogleAuth = () => {
    const context = useContext(GoogleAuthContext);
    if (!context) {
        throw new Error("useGoogleAuth must be used within a GoogleAuthProvider");
    }
    return context;
};
