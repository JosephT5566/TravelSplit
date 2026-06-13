"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const LAST_PWA_URL_KEY = "tripsplit:last-pwa-url";
const PWA_LAUNCH_PARAM = "source";
const PWA_LAUNCH_VALUE = "pwa";

export function PWARegister() {
    const pathname = usePathname();
    const router = useRouter();
    const hasHandledLaunch = useRef(false);

    useEffect(() => {
        if (
            process.env.NODE_ENV !== "production" ||
            !("serviceWorker" in navigator)
        ) {
            return;
        }

        const registerServiceWorker = async () => {
            try {
                await navigator.serviceWorker.register(`${basePath}/sw.js`, {
                    scope: `${basePath}/`,
                });
            } catch (error) {
                console.error("Service worker registration failed", error);
            }
        };

        window.addEventListener("load", registerServiceWorker);

        return () => {
            window.removeEventListener("load", registerServiceWorker);
        };
    }, []);

    useEffect(() => {
        const currentUrl = new URL(window.location.href);
        const isPwaLaunch =
            currentUrl.searchParams.get(PWA_LAUNCH_PARAM) ===
            PWA_LAUNCH_VALUE;

        if (!hasHandledLaunch.current && isPwaLaunch) {
            hasHandledLaunch.current = true;

            const lastUrl = window.localStorage.getItem(LAST_PWA_URL_KEY);
            if (lastUrl && isSafeAppUrl(lastUrl)) {
                router.replace(lastUrl);
                return;
            }

            currentUrl.searchParams.delete(PWA_LAUNCH_PARAM);
            router.replace(toAppRelativeUrl(currentUrl));
            return;
        }

        hasHandledLaunch.current = true;
        currentUrl.searchParams.delete(PWA_LAUNCH_PARAM);
        window.localStorage.setItem(
            LAST_PWA_URL_KEY,
            toAppRelativeUrl(currentUrl),
        );
    }, [pathname, router]);

    return null;
}

function toAppRelativeUrl(url: URL) {
    const pathname =
        basePath &&
        (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`))
            ? url.pathname.slice(basePath.length) || "/"
            : url.pathname;

    return `${pathname || "/"}${url.search}${url.hash}`;
}

function isSafeAppUrl(value: string) {
    if (!value.startsWith("/") || value.startsWith("//")) {
        return false;
    }

    try {
        const url = new URL(value, window.location.origin);
        return url.origin === window.location.origin;
    } catch {
        return false;
    }
}
