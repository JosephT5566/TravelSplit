"use client";

import { USER_STORAGE_KEY } from "@/services/cacheKeys";

const AUTH_ERROR_STORAGE_KEY = "tripsplit_auth_error";

export type AuthErrorNotice = {
    title: string;
    message: string;
};

const authErrorNotices: Record<string, AuthErrorNotice> = {
    oauth_denied: {
        title: "Sign-in cancelled",
        message: "Google sign-in was cancelled. Please try again to continue.",
    },
    token_exchange_failed: {
        title: "Sign-in failed",
        message:
            "We could not complete Google sign-in. Please try again in a moment.",
    },
    userinfo_failed: {
        title: "Sign-in failed",
        message:
            "We could not load your Google account details. Please try again.",
    },
    email_unavailable: {
        title: "Email unavailable",
        message:
            "Your Google account did not provide an email address. Please use another account.",
    },
    unauthorized_email: {
        title: "Account not allowed",
        message:
            "This Google account is not authorized to access TripSplit. Please sign in with an allowed account.",
    },
};

export const defaultUnauthorizedNotice: AuthErrorNotice = {
    title: "Account not allowed",
    message:
        "This Google account is not authorized to access TripSplit. Please sign in with an allowed account.",
};

export function consumeAuthErrorNotice(): AuthErrorNotice | null {
    if (typeof window === "undefined") {
        return null;
    }

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const queryMessage = params.get("message");
    const storedNotice = window.sessionStorage.getItem(AUTH_ERROR_STORAGE_KEY);

    if (storedNotice) {
        window.sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
        try {
            return JSON.parse(storedNotice) as AuthErrorNotice;
        } catch {
            return defaultUnauthorizedNotice;
        }
    }

    if (authError) {
        const notice = authErrorNotices[authError] || defaultUnauthorizedNotice;
        return {
            ...notice,
            message: queryMessage || notice.message,
        };
    }

    return null;
}

export function hasAuthErrorSearchParam() {
    if (typeof window === "undefined") {
        return false;
    }

    return new URLSearchParams(window.location.search).has("auth_error");
}
