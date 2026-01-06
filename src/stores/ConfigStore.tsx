"use client";

import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { useGetSheetConfig } from "../../services/dataFetcher";
import { AppConfig, ApiState, SheetConfig } from "../types";
import { storage } from "../../services/idbStorage";
import { set } from "lodash";

interface ConfigContextValue {
    config?: SheetConfig;
    isInitialized: boolean;
    saveAppConfig: (appConfig: AppConfig) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const { data: sheetConfig, isSuccess: isInitialized } = useGetSheetConfig();
    const [appConfig, setAppConfig] = useState<AppConfig>({
        theme: "classic",
    });

    useEffect(() => {
        async function loadInitialConfig() {
            const initialConfig = await storage.getAppConfig();
            if (initialConfig) {
                setAppConfig(initialConfig);
            }
        }
        loadInitialConfig();
    }, []);

    useEffect(() => {
        if (appConfig?.theme) {
            document.documentElement.setAttribute(
                "data-theme",
                appConfig.theme
            );
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
    }, [appConfig?.theme]);

    const saveAppConfig = useCallback(
        async (appConfig: AppConfig) => {
            setAppConfig(appConfig);
            await storage.saveAppConfig(appConfig);
        },
        [storage.saveAppConfig]
    );

    const value = useMemo(
        () => ({
            config: sheetConfig,
            isInitialized,
            saveAppConfig,
        }),
        [sheetConfig, isInitialized, saveAppConfig]
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
