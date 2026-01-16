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
async function getUserInfo(
    accessToken: string
): Promise<Omit<User, "accessToken">> {
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
    // 儲存正在進行中的 Promise
    const refreshingPromiseRef = useRef<Promise<User> | null>(null);

    // 用於在 callback 中結束 Promise 的臨時變數
    const promiseHooks = useRef<{
        resolve: (user: User) => void;
        reject: (err: Error) => void;
    } | null>(null);

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
                if (!promiseHooks.current) {
                    return;
                }

                const { resolve, reject } = promiseHooks.current;
                if (tokenResponse.error) {
                    reject(new Error(tokenResponse.error_description));
                } else {
                    try {
                        const accessToken = tokenResponse.access_token;
                        const userInfo = await getUserInfo(accessToken);

                        if (!userInfo.email) {
                            throw new Error(
                                "Google login failed: Email not found"
                            );
                        }

                        // whitelist check
                        const email = String(userInfo.email).toLowerCase();
                        if (
                            EMAIL_WHITE_LIST.length > 1 &&
                            !EMAIL_WHITE_LIST.includes(email)
                        ) {
                            throw new Error(
                                "Google login failed: Email not in whitelist"
                            );
                        }

                        const newUser = { ...userInfo, accessToken };
                        setUser(newUser);
                        resolve(newUser); // 讓所有等待這個 Promise 的 Query 同時恢復
                    } catch (e) {
                        reject(
                            e instanceof Error ? e : new Error("Login failed")
                        );
                    }
                }
                // 結束後清空
                refreshingPromiseRef.current = null;
                promiseHooks.current = null;
            },
        });
        setGsiScriptReady(true);
    }, []);

    const login = useCallback((): Promise<User> => {
        // 預防萬一：如果已經有正在進行的請求（例如靜默刷新中），可以直接沿用或報錯
        if (refreshingPromiseRef.current) {
            return refreshingPromiseRef.current;
        }

        const newPromise = new Promise<User>((resolve, reject) => {
            if (!clientRef.current) {
                return reject(new Error("Google Auth client not initialized."));
            }

            // 核心：同樣把 resolve/reject 寄存給 promiseHooks
            // 這樣 Google SDK 的 callback 執行時就會觸發這裡的 resolve
            promiseHooks.current = { resolve, reject };

            console.log("Initiating manual login with consent...");
            // 這裡強制要求 consent 畫面
            clientRef.current.requestAccessToken({ prompt: "consent" });
        });

        refreshingPromiseRef.current = newPromise;
        return newPromise;
    }, []);

    const logout = useCallback(async () => {
        console.log("Initiating logout for user:", user?.email);

        try {
            // 1. 如果有 accessToken，先向 Google 撤銷它
            if (user?.accessToken) {
                await new Promise<void>((resolve) => {
                    google.accounts.oauth2.revoke(user.accessToken, () => {
                        console.log("Google access token revoked.");
                        resolve();
                    });
                    // 註：revoke 通常不論成功失敗都會繼續，
                    // 萬一 Google 端失敗（例如 Token 已過期），我們還是要清空本地資料
                    setTimeout(resolve, 1000); // 安全起見，設置一個逾時強制繼續
                });
            }
        } catch (error) {
            console.error("Error during token revocation:", error);
        } finally {
            // 2. 無論撤銷是否成功，都必須清空本地狀態
            setUser(null);

            // 3. 關鍵：清空任何正在進行中的刷新 Promise
            // 避免使用者登出後，先前的殘留請求又把過期的 User 存回去
            refreshingPromiseRef.current = null;
            promiseHooks.current = null;

            console.log("User logged out locally.");
        }
    }, [user]);

    const refreshToken = useCallback((): Promise<User> => {
        // 有在進行中的 Promise，直接回傳
        if (refreshingPromiseRef.current) {
            console.log("Returning existing refresh promise...");
            return refreshingPromiseRef.current;
        }

        // 建立一個新的 Promise
        const newPromise = new Promise<User>((resolve, reject) => {
            if (!clientRef.current) {
                return reject(new Error("Google Auth client not initialized."));
            }

            // 將控制權交給外部的 Ref，讓 callback 能存取
            promiseHooks.current = { resolve, reject };

            console.log("Requesting new access token...");
            clientRef.current.requestAccessToken({ prompt: "" });
        });

        refreshingPromiseRef.current = newPromise;
        return newPromise;
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
        throw new Error(
            "useGoogleAuth must be used within a GoogleAuthProvider"
        );
    }
    return context;
};
