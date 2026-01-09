// ======== 設定 ========
import { User } from "../types";

let buttonRendered = false;
let gsiInitialized = false;

// ======== 公用工具 ========
export type JwtPayload = {
    iss: string;
    aud: string; // client ID
    exp: number; // seconds
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    sub?: string;
};

function decodeJwt(token: string): JwtPayload {
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
}

// ======== 登入流程（按鈕/自動） ========

type InitOptions = {
    onSignedIn?: (user: User) => void;
    onError?: (e: Error) => void;
};

export function initGsiOnce(options?: InitOptions) {
    if (typeof window === "undefined") {
        return;
    }

    const gis = window?.google?.accounts?.id;
    if (!gis) {
        throw new Error("Google Identity Services 未載入");
    }

    const EMAIL_WHITE_LIST: string[] = (
        process.env.NEXT_PUBLIC_EMAIL_WHITE_LIST || ""
    ).split(",");

    if (gsiInitialized) {
        return;
    }

    gis.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID || "",
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
        callback: (res: { credential?: string }) => {
            try {
                const idToken = res?.credential;
                if (!idToken) {
                    throw new Error("Did not receive Google ID token");
                }
                const payload = decodeJwt(idToken) as JwtPayload;

                if (!payload.email || !payload.email_verified) {
                    throw new Error("Google login failed: Email not verified");
                }
                const email = String(payload.email).toLowerCase();
                if (!EMAIL_WHITE_LIST.includes(email)) {
                    throw new Error(
                        "Google login failed: Email not in whitelist"
                    );
                }

                if (!payload.exp) {
                    throw new Error("Google login failed: No exp in token");
                }

                console.log("Google login successful:", payload);

                const user: User = {
                    email: payload.email,
                    name: payload.name || payload.email,
                    picture: payload.picture,
                    idToken: idToken,
                };
                options?.onSignedIn?.(user);
            } catch (e) {
                options?.onError?.(
                    e instanceof Error ? e : new Error("Google login failed")
                );
            }
        },
    });
    gsiInitialized = true;
}

export function renderGoogleButton(container: HTMLElement) {
    if (!container || buttonRendered) {
        return;
    }

    const gis = window.google.accounts.id;
    container.innerHTML = "";
    gis.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        logo_alignment: "left",
        width: 320,
    });
    buttonRendered = true;
}

// ======== 登出 ========
export function signOut() {
    buttonRendered = false;
    // 可選：通知 GIS 取消自動選擇
    try {
        window.google?.accounts?.id?.disableAutoSelect?.();
    } catch {
        console.log("Signout failed");
    }
}
