"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface UIContextType {
    isDrawerOpen: boolean;
    openDrawer: () => void;
    closeDrawer: () => void;
    theme: string;
    setTheme: (theme: string) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [theme, setThemeState] = useState("classic");

    const openDrawer = () => setIsDrawerOpen(true);
    const closeDrawer = () => setIsDrawerOpen(false);

    const setTheme = (newTheme: string) => {
        setThemeState(newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
    };

    return (
        <UIContext.Provider
            value={{ isDrawerOpen, openDrawer, closeDrawer, theme, setTheme }}
        >
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error("useUI must be used within a UIProvider");
    }
    return context;
}
