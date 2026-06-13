"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { LoginView } from "./LoginView";
import { useAuthState } from "../src/stores/AuthStore";
import {
    getAvailableSheetIds,
    saveSelectedSheetId,
} from "@/src/utils/sheetSelection";
import { useSelectedSheetId } from "@/src/hooks/useSelectedSheetId";
import { isPublicTravelBookPath } from "@/src/travel/registry";
import { StartupLoading } from "./StartupLoading";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthInitialized, isSignedIn } = useAuthState();
    const pathname = usePathname();
    const router = useRouter();
    const selectedSheetId = useSelectedSheetId();
    const isPublicTravelBook = isPublicTravelBookPath(pathname);
    const [isSheetSelectionReady, setIsSheetSelectionReady] =
        React.useState(false);

    React.useEffect(() => {
        if (isPublicTravelBook) {
            return;
        }

        if (!isAuthInitialized || !isSignedIn) {
            return;
        }

        const availableSheetIds = getAvailableSheetIds();
        if (availableSheetIds.length <= 1) {
            if (availableSheetIds[0]) {
                saveSelectedSheetId(availableSheetIds[0]);
            }
            setIsSheetSelectionReady(true);
            if (pathname === "/select-sheet") {
                router.replace("/");
            }
            return;
        }

        if (!selectedSheetId) {
            setIsSheetSelectionReady(pathname === "/select-sheet");
            if (pathname !== "/select-sheet") {
                router.replace("/select-sheet");
            }
            return;
        }

        setIsSheetSelectionReady(true);
    }, [
        isAuthInitialized,
        isPublicTravelBook,
        isSignedIn,
        pathname,
        router,
        selectedSheetId,
    ]);

    if (isPublicTravelBook) {
        return <>{children}</>;
    }

    if (!isAuthInitialized) {
        return (
            <StartupLoading
                value="your signed-in account"
                detail="Checking the saved user and confirming the current login session."
            />
        );
    }

    // Sign in Entry Point
    if (!isSignedIn) {
        return <LoginView />;
    }

    if (!isSheetSelectionReady) {
        return (
            <StartupLoading
                value="the selected trip sheet"
                detail="Reading the available Google Sheets and opening your active trip."
            />
        );
    }

    return (
        <div className="min-h-dvh bg-background text-text-main font-sans transition-colors duration-300">
            {pathname === "/select-sheet" ? (
                children
            ) : (
                <Layout>{children}</Layout>
            )}
        </div>
    );
}
