"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PieChart, List, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../src/stores/AuthStore";
import { useExpenses } from "../src/stores/ExpensesStore";

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const pathname = usePathname();
    const { user } = useAuth();
    const { apiState } = useExpenses();

    // Hide FAB on settings page
    const showFab = pathname !== "/settings";

    if (!user) {
        return <>{children}</>;
    }

    return (
        <>
            {/* Header */}
            <div className="p-4 bg-surface shadow sticky top-0 z-10 flex justify-between items-center transition-colors border-b border-border">
                <h1 className="text-xl font-bold text-primary">TripSplit</h1>
                <div className="text-xs">
                    <img
                        src={user.picture}
                        alt={user.name}
                        className="w-8 h-8 rounded-full border border-border"
                        width={32}
                        height={32}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="layout-container p-4 max-w-2xl mx-auto min-h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] overflow-auto">
                {apiState.error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm border border-red-200">
                        {apiState.error}
                    </div>
                )}
                {children}
            </div>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around p-3 z-30 transition-colors pb-safe">
                <Link
                    href="/"
                    className={`flex flex-col items-center transition-colors ${
                        pathname === "/"
                            ? "text-primary"
                            : "text-text-muted hover:text-text-main"
                    }`}
                >
                    <List size={24} />
                    <span className="text-xs mt-1">Expenses</span>
                </Link>
                <Link
                    href="/summary"
                    className={`flex flex-col items-center transition-colors ${
                        pathname === "/summary"
                            ? "text-primary"
                            : "text-text-muted hover:text-text-main"
                    }`}
                >
                    <PieChart size={24} />
                    <span className="text-xs mt-1">Summary</span>
                </Link>
                <Link
                    href="/settings"
                    className={`flex flex-col items-center transition-colors ${
                        pathname === "/settings"
                            ? "text-primary"
                            : "text-text-muted hover:text-text-main"
                    }`}
                >
                    <SettingsIcon size={24} />
                    <span className="text-xs mt-1">Settings</span>
                </Link>
            </nav>
        </>
    );
};
