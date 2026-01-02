"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { useConfig as useConfigQuery, useSaveConfig } from "../../services/cacheStorage";
import { AppConfig } from "../types";

interface ConfigContextValue {
    config?: AppConfig;
    isInitialized: boolean;
    saveConfig: (newConfig: AppConfig) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const { data: config, isSuccess: isInitialized } = useConfigQuery();
    const { mutateAsync: saveConfigMutation } = useSaveConfig();

    useEffect(() => {
        if (config?.theme) {
            document.documentElement.setAttribute("data-theme", config.theme);
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
    }, [config?.theme]);

    const saveConfig = useCallback(async (newConfig: AppConfig) => {
        await saveConfigMutation(newConfig);
        alert("Configuration saved.");
    }, [saveConfigMutation]);

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
