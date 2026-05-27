"use client";

import { useEffect } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function PWARegister() {
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

    return null;
}
