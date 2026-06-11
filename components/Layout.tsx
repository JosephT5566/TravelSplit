"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PieChart, List, NotebookPen } from "lucide-react";
import { useAuthState } from "../src/stores/AuthStore";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useUI } from "../src/stores/UIStore";
import { AppHeader } from "./AppHeader";
import { SideDrawer } from "./SideDrawer";

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const pathname = usePathname();
    const { user } = useAuthState();
    const { apiState } = useExpenses();
    const { openDrawer } = useUI();

    if (!user) {
        return <>{children}</>;
    }

    return (
        <>
            <SideDrawer />
            <AppHeader user={user} onAccountClick={openDrawer} />

            {/* Main Content Area */}
            <div className="layout-container max-w-2xl mx-auto min-h-[calc(100dvh-140px)] max-h-[calc(100dvh-140px)] overflow-auto">
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
                    href="/plan"
                    className={`flex flex-col items-center transition-colors ${
                        pathname === "/plan"
                            ? "text-primary"
                            : "text-text-muted hover:text-text-main"
                    }`}
                >
                    <NotebookPen size={24} />
                    <span className="text-xs mt-1">Plan</span>
                </Link>
            </nav>
        </>
    );
};
