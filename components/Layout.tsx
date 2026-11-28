"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PieChart, List, ListChecks, NotebookPen } from "lucide-react";
import { useAuthState } from "../src/stores/AuthStore";
import { useExpenses } from "../src/stores/ExpensesStore";
import { useUI } from "../src/stores/UIStore";
import { AppHeader } from "./AppHeader";
import { SideDrawer } from "./SideDrawer";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";
import { useSelectedSheetId } from "@/src/hooks/useSelectedSheetId";
import { cn } from "@/lib/utils";

const navigation = [
    { href: "/", label: "支出", Icon: List },
    { href: "/summary", label: "統計", Icon: PieChart },
    { href: "/todos", label: "待辦", Icon: ListChecks },
    { href: "/plan", label: "行程", Icon: NotebookPen },
];

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const pathname = usePathname();
    const { user } = useAuthState();
    const { apiState } = useExpenses();
    const { openDrawer } = useUI();
    const sheetId = useSelectedSheetId();

    if (!user) {
        return <>{children}</>;
    }

    return (
        <ToastProvider key={JSON.stringify([sheetId, user.email])}>
            <SideDrawer />
            <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto]">
                <AppHeader user={user} onAccountClick={openDrawer} />

                <main className="mx-auto w-full max-w-2xl overflow-auto">
                    {apiState.error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm border border-red-200">
                            {apiState.error}
                        </div>
                    )}
                    {children}
                </main>

                <div className="relative z-30">
                    <ToastViewport />
                    <nav
                        aria-label="主要導覽"
                        className="border-t border-border bg-surface pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] transition-colors"
                    >
                        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1 px-4">
                            {navigation.map(({ href, label, Icon }) => {
                                const isCurrent = pathname === href;

                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        aria-current={isCurrent ? "page" : undefined}
                                        className={cn(
                                            "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-center text-xs/4 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current",
                                            isCurrent
                                                ? "bg-primary/12 font-semibold text-text-main"
                                                : "text-text-main/80 hover:bg-background hover:text-text-main",
                                        )}
                                    >
                                        <Icon aria-hidden="true" className="size-5 shrink-0" />
                                        <span className="max-w-full truncate">{label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                </div>
            </div>
        </ToastProvider>
    );
};
