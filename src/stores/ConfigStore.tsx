"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { storage } from "../../services/cacheStorage";
import { AppConfig } from "../types";

interface ConfigContextValue {
    config?: AppConfig;
    isInitialized: boolean;
    saveConfig: (newConfig: AppConfig) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<AppConfig | undefined>();
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const storedConfig = await storage.getConfig();
                if (storedConfig) {
                    setConfig(storedConfig);
                }
            } catch (e) {
                console.error("Failed to load config from storage", e);
            } finally {
                setIsInitialized(true);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (config?.theme) {
            document.documentElement.setAttribute("data-theme", config.theme);
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
    }, [config?.theme]);

    const saveConfig = useCallback(async (newConfig: AppConfig) => {
        await storage.saveConfig(newConfig);
        setConfig(newConfig);
        alert("Configuration saved.");
    }, []);

    const value = useMemo(
        () => ({
            config,
            isInitialized,
            saveConfig,
        }),
        [config, isInitialized, saveConfig]
    );

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error("useConfig must be used within a ConfigProvider");
    }
    return context;
}
