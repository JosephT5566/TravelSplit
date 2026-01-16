"use client";

import React from "react";

const SettingsPageContent: React.FC = () => {
    return (
        <div className="bg-background p-4 flex flex-col gap-4">
            <div className="w-full mx-auto p-6 bg-surface rounded-lg shadow-md border border-border">
                <h2 className="text-2xl font-bold mb-6 text-text-main">
                    Settings
                </h2>
                <p className="text-text-main">
                    Additional settings will be available here in the future.
                </p>
            </div>
        </div>
    );
};

export default SettingsPageContent;
