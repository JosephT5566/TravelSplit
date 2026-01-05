"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useConfig } from "../../src/stores/ConfigStore";
import { useAuthActions } from "../../src/stores/AuthStore";
import { AppConfig } from "../../src/types";


const SettingsPageContent: React.FC = () => {
    const { config, saveConfig } = useConfig();
    const { signOut } = useAuthActions();

    const handleThemeChange = (theme: AppConfig["theme"]) => {
        if (config) {
            saveConfig({ ...config, theme });
        }
    };

    return (
        <div className="pb-20 bg-background min-h-screen">
            <div className="p-4 bg-surface shadow sticky top-0 z-10 flex items-center gap-4 transition-colors border-b border-border">
                <Link
                    href="/"
                    className="text-text-muted hover:text-primary transition-colors"
                >
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-text-main">Settings</h1>
            </div>
            <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="max-w-2xl mx-auto p-6 bg-surface rounded-lg shadow-md border border-border">
                    <h2 className="text-2xl font-bold mb-6 text-text-main">
                        Appearance & Account
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-text-main">
                                Theme
                            </label>
                            <select
                                className="w-full p-2 border border-border rounded bg-background text-text-main"
                                value={config?.theme || "classic"}
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

                        <div className="pt-4 border-t border-border flex justify-between items-center">
                            <button
                                type="button"
                                onClick={signOut}
                                className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-200 rounded"
                            >
                                Reset User & Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPageContent;
