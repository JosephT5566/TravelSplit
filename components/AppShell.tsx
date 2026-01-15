"use client";

import React from "react";
import { Layout } from "./Layout";
import { LoginView } from "./LoginView";
import { useAuth } from "../src/stores/AuthStore";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthInitialized, isSignedIn } = useAuth();

    if (!isAuthInitialized) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Sign in Entry Point
    if (!isSignedIn) {
        return <LoginView />;
    }

    return (
        <div className="min-h-dvh bg-background text-text-main font-sans transition-colors duration-300">
            <Layout>
                {children}
            </Layout>
        </div>
    );
}

