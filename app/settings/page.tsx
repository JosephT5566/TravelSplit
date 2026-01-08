"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { useConfig } from "../../src/stores/ConfigStore";
import { useAuthActions } from "../../src/stores/AuthStore";
import { AppConfig } from "../../src/types";
import classNames from "classnames";

const SettingsPageContent: React.FC = () => {
    const { sheetConfig, appConfig, saveAppConfig } = useConfig();
    const { signOut } = useAuthActions();

    const handleThemeChange = (theme: AppConfig["theme"]) => {
        if (sheetConfig) {
            saveAppConfig({ theme });
        }
    };

    return (
        <div className="bg-background min-h-screen flex flex-col gap-4">
            <div className="w-full mx-auto p-6 bg-surface rounded-lg shadow-md border border-border">
                <h2 className="text-2xl font-bold mb-6 text-text-main">
                    App Appearance
                </h2>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-text-main">
                            Theme
                        </label>
                        <select
                            className="w-full p-2 border border-border rounded bg-background text-text-main"
                            value={appConfig.theme || "classic"}
                            onChange={(e) =>
                                handleThemeChange(
                                    e.target.value as AppConfig["theme"]
                                )
                            }
                        >
                            <option value="classic">Classic (System)</option>
                            <option value="forest">Forest (Dark Green)</option>
                            <option value="ocean">Ocean (Light Teal)</option>
                        </select>
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={signOut}
                className={classNames(
                    "flex gap-4 items-center justify-center",
                    "px-4 py-2 w-full bg-primary text-primary-content rounded-xl"
                )}
            >
                <LogOut size={24} />
                <span>Log out</span>
            </button>
        </div>
    );
};

export default SettingsPageContent;
