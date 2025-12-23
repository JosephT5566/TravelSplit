import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Plus, PieChart, List, Settings as SettingsIcon } from "lucide-react";
import { User, ApiState } from "../types";

interface LayoutProps {
    user: User;
    isDemo: boolean;
    apiState: ApiState;
    onAddClick: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
    user,
    isDemo,
    apiState,
    onAddClick,
}) => {
    const location = useLocation();
    // Hide FAB on settings page
    const showFab = location.pathname !== "/settings";

    return (
        <>
            {/* Header */}
            <div className="p-4 bg-surface shadow sticky top-0 z-10 flex justify-between items-center transition-colors border-b border-border">
                <h1 className="text-xl font-bold text-primary">TripSplit</h1>
                <div className="text-xs text-text-muted flex flex-col items-end">
                    <span className="font-medium text-text-main">
                        {user.name}
                    </span>
                    <span>
                        {isDemo
                            ? "Demo Mode"
                            : apiState.lastUpdated
                            ? `Updated ${new Date(
                                  apiState.lastUpdated
                              ).toLocaleTimeString()}`
                            : ""}
                    </span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-4 max-w-2xl mx-auto min-h-[calc(100vh-140px)]">
                {apiState.error && !isDemo && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm border border-red-200">
                        {apiState.error}
                    </div>
                )}
                <Outlet />
            </div>

            {/* FAB */}
            {showFab && (
                <button
                    onClick={onAddClick}
                    className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-fg rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-transform hover:scale-105 active:scale-95 z-40"
                    aria-label="Add Expense"
                >
                    <Plus size={28} />
                </button>
            )}

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around p-3 z-30 transition-colors pb-safe">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `flex flex-col items-center transition-colors ${
                            isActive
                                ? "text-primary"
                                : "text-text-muted hover:text-text-main"
                        }`
                    }
                >
                    <PieChart size={24} />
                    <span className="text-xs mt-1">Stats</span>
                </NavLink>
                <NavLink
                    to="/list"
                    className={({ isActive }) =>
                        `flex flex-col items-center transition-colors ${
                            isActive
                                ? "text-primary"
                                : "text-text-muted hover:text-text-main"
                        }`
                    }
                >
                    <List size={24} />
                    <span className="text-xs mt-1">Expenses</span>
                </NavLink>
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex flex-col items-center transition-colors ${
                            isActive
                                ? "text-primary"
                                : "text-text-muted hover:text-text-main"
                        }`
                    }
                >
                    <SettingsIcon size={24} />
                    <span className="text-xs mt-1">Settings</span>
                </NavLink>
            </nav>
        </>
    );
};
