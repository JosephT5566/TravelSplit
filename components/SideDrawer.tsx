"use client";

import React, { useState } from "react";
import { FocusTrap } from "focus-trap-react";
import {
    AlertTriangle,
    ArrowLeftRight,
    FileCog,
    Loader2,
    LogOut,
    RefreshCw,
    X,
} from "lucide-react";
import Link from "next/link";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthActions, useAuthState } from "../src/stores/AuthStore";
import { AppConfig } from "../src/types";
import { useUI } from "../src/stores/UIStore";
import { useConfig } from "../src/stores/ConfigStore";
import { format } from "date-fns";
import { todoSyncManager } from "@/services/todoSyncManager";
import { isSheetSelectionRequired } from "@/src/utils/sheetSelection";

export const SideDrawer: React.FC = () => {
    const { signOut, prepareSignOut } = useAuthActions();
    const { user } = useAuthState();
    const { sheetConfig, refetchSheetConfig, isFetchingConfig } = useConfig();
    // isDrawerOpen and closeDrawer will now control the checkbox state
    const { isDrawerOpen, closeDrawer, theme, setTheme } = useUI();
    const [isPreparingSignOut, setIsPreparingSignOut] = useState(false);
    const [pendingSignOutUnsyncedCount, setPendingSignOutUnsyncedCount] =
        useState<number | null>(null);
    const [isConfirmingSignOut, setIsConfirmingSignOut] = useState(false);

    const handleThemeChange = (newTheme: AppConfig["theme"]) => {
        setTheme(newTheme);
    };

    const handleSignOutClick = async () => {
        if (isPreparingSignOut || isConfirmingSignOut) {
            return;
        }
        setIsPreparingSignOut(true);
        try {
            const result = await prepareSignOut();
            closeDrawer();
            if (result.canSignOutImmediately) {
                await signOut({ clearTodoOutbox: true });
                return;
            }
            setPendingSignOutUnsyncedCount(result.unsyncedCount);
        } finally {
            setIsPreparingSignOut(false);
        }
    };

    const handleConfirmSignOut = async () => {
        if (isConfirmingSignOut) {
            return;
        }
        setIsConfirmingSignOut(true);
        try {
            await signOut({ clearTodoOutbox: true });
            setPendingSignOutUnsyncedCount(null);
        } finally {
            setIsConfirmingSignOut(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <>
            {/* drawer-end puts the sidebar on the right */}
            <FocusTrap
                active={isDrawerOpen && pendingSignOutUnsyncedCount === null}
                focusTrapOptions={{ onDeactivate: closeDrawer }}
            >
            <div className="drawer drawer-end">
                {/* Using checkbox to CONTROL drawer state */}
                <input
                    id="main-drawer"
                    type="checkbox"
                    className="drawer-toggle"
                    checked={isDrawerOpen}
                    onChange={(e) => !e.target.checked && closeDrawer()}
                />

                <div className="drawer-content">
                    {/* Your main app content/routes usually go here. 
                    If this component is just the sidebar wrapper, 
                    you can leave this empty or wrap your page.
                */}
                </div>

                <div className="drawer-side z-50">
                    <label
                        htmlFor="main-drawer"
                        aria-label="close sidebar"
                        className="drawer-overlay"
                        onClick={closeDrawer}
                    ></label>

                    <div className="menu w-80 min-h-full bg-base-100 p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-base-content">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">帳戶與設定</h2>
                            {/* daisyUI doesn't strictly need a close button if you use the overlay, 
                but we can keep it for UX */}
                            <button
                                onClick={closeDrawer}
                                className="btn btn-sm btn-circle btn-ghost"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* User Profile */}
                        <div className="flex items-center gap-4 mb-8 px-2">
                            <div className="avatar">
                                <div className="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                    <img src={user.picture} alt={user.name} />
                                </div>
                            </div>
                            <div>
                                <p className="font-bold">{user.name}</p>
                                <p className="text-xs opacity-60">
                                    {user.email}
                                </p>
                            </div>
                        </div>

                        {isSheetSelectionRequired() && (
                            <Link
                                href="/select-sheet"
                                onClick={() => {
                                    void todoSyncManager
                                        .getActiveEngine()
                                        ?.flushNow()
                                        .catch(() => undefined);
                                    closeDrawer();
                                }}
                                className="mb-3 flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/15 active:scale-[0.99]"
                            >
                                <ArrowLeftRight size={18} />
                                Switch Sheet
                            </Link>
                        )}

                        <div className="collapse collapse-arrow bg-base-200/50 border border-base-300 rounded-xl">
                            <input type="checkbox" name="my-accordion-2" />
                            <div className="collapse-title flex items-center gap-3 text-sm font-bold">
                                {/* Adding a subtle icon makes it feel more professional */}
                                <FileCog size={16} className="text-primary" />
                                Sheet 設定
                            </div>
                            <div className="collapse-content ">
                                <button
                                    className="p-1 text-primary bg-surface border border-border rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        refetchSheetConfig();
                                    }}
                                    disabled={isFetchingConfig}
                                >
                                    <RefreshCw
                                        size={12}
                                        className={
                                            isFetchingConfig
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />
                                </button>
                                {sheetConfig ? (
                                    <div className="space-y-4 pt-2">
                                        {/* Date Section */}
                                        {sheetConfig.startDate && (
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-base-content/60 font-medium">
                                                    起始日期
                                                </span>
                                                <span className="badge badge-ghost font-mono">
                                                    {format(
                                                        new Date(
                                                            sheetConfig.startDate
                                                        ),
                                                        "yyyy-MM-dd"
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        {sheetConfig.endDate && (
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-base-content/60 font-medium">
                                                    結束日期
                                                </span>
                                                <span className="badge badge-ghost font-mono">
                                                    {format(
                                                        new Date(
                                                            sheetConfig.endDate
                                                        ),
                                                        "yyyy-MM-dd"
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        <div className="divider my-0 opacity-50"></div>

                                        {/* Currencies as Badges */}
                                        <div>
                                            <span className="text-xs font-bold text-base-content/60 block mb-2 uppercase tracking-wider">
                                                匯率資訊
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(
                                                    sheetConfig.currencies
                                                ).map(([currency, rate]) => (
                                                    <div
                                                        key={currency}
                                                        className="badge badge-outline gap-2 py-3"
                                                    >
                                                        <span className="font-bold text-accent">
                                                            {currency}
                                                        </span>
                                                        <span>{rate}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Users as a Clean List */}
                                        <div>
                                            <span className="text-xs font-bold text-base-content/60 block mb-2 uppercase tracking-wider">
                                                參與用戶
                                            </span>
                                            <div className="space-y-2">
                                                {Object.entries(
                                                    sheetConfig.users
                                                ).map(
                                                    ([userEmail, userName]) => (
                                                        <div
                                                            key={userEmail}
                                                            className="flex flex-col p-2 rounded-lg border border-base-300 shadow-md"
                                                        >
                                                            <span className="text-sm font-semibold mb-1">
                                                                {userName}
                                                            </span>
                                                            <span className="text-xs opacity-70">
                                                                {userEmail}
                                                            </span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 opacity-40 text-xs italic">
                                        No sheet configuration found.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Settings Section */}
                        <div className="flex-grow">
                            <div className="form-control w-full">
                                {/* <label className="label">
                                    <span className="label-text">Theme</span>
                                </label>
                                <select
                                    className="select select-bordered w-full"
                                    value={theme}
                                    onChange={(e) =>
                                        handleThemeChange(
                                            e.target.value as AppConfig["theme"]
                                        )
                                    }
                                >
                                    <option value="classic">
                                        Classic (System)
                                    </option>
                                    <option value="forest">
                                        Forest (Dark Green)
                                    </option>
                                    <option value="ocean">
                                        Ocean (Light Teal)
                                    </option>
                                </select> */}
                            </div>
                        </div>

                        {/* Logout Button */}
                        <button
                            type="button"
                            disabled={isPreparingSignOut}
                            onClick={() => {
                                void handleSignOutClick();
                            }}
                            className="btn btn-primary btn-block gap-2 mt-4"
                        >
                            {isPreparingSignOut ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <LogOut size={20} />
                            )}
                            {isPreparingSignOut ? "同步中…" : "Log out"}
                        </button>
                    </div>
                </div>
            </div>
        </FocusTrap>

            <AlertDialog
                open={pendingSignOutUnsyncedCount !== null}
                onOpenChange={(open) => {
                    if (!open && !isConfirmingSignOut) {
                        setPendingSignOutUnsyncedCount(null);
                    }
                }}
            >
                <AlertDialogContent
                    data-slot="signout-unsynced-dialog"
                    className="rounded-2xl border border-border bg-surface text-text-main shadow-lg ring-0"
                >
                    <AlertDialogHeader className="gap-3 text-left">
                        <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 forest:bg-amber-950/60 forest:text-amber-300">
                            <AlertTriangle
                                aria-hidden="true"
                                className="size-5"
                            />
                        </div>
                        <AlertDialogTitle className="text-base leading-snug font-bold text-text-main">
                            確定要登出嗎？
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm leading-6 text-text-main/75">
                            還有 {pendingSignOutUnsyncedCount} 項變更尚未同步，登出會遺失這些變更
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="border-t border-border bg-background/50">
                        <AlertDialogCancel
                            disabled={isConfirmingSignOut}
                            className="min-h-11 rounded-xl border-border bg-surface text-text-main hover:bg-background"
                        >
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isConfirmingSignOut}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleConfirmSignOut();
                            }}
                            className="min-h-11 rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700"
                        >
                            仍要登出
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
