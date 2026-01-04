"use client";

import React, { createContext, useContext, useState, useMemo } from "react";

interface UIContextValue {
    theme: string;
    setTheme: (theme: string) => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState("light");

    const value = useMemo(
        () => ({
            theme,
            setTheme,
        }),
        [theme]
    );

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error("useUI must be used within a UIProvider");
    }
    return context;
}
