"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Settings } from "../../components/Settings";
import { useAppContext } from "../../components/AppContext";

const SettingsPageContent: React.FC = () => {
    const { config, handleSaveConfig, handleLogout } = useAppContext();

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
                <Settings
                    config={config}
                    onSave={handleSaveConfig}
                    onLogout={handleLogout}
                />
            </div>
        </div>
    );
};

export default SettingsPageContent;
