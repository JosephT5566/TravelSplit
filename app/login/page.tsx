"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";
import { User } from "../../src/types";
import { renderGoogleButton } from "../../src/utils/auth";
import { useAppContext } from "../../components/AppContext";

const LoginPageContent: React.FC = () => {
    const { handleLogin, config, googleButtonRef } = useAppContext();
    const demoUser: User = { email: "demo@tripsplit.app", name: "Demo User" };
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    const handleDemoLogin = () => {
        handleLogin(demoUser);
    };

    // 1. Setup Required State
    if (!config || !config.gasUrl) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4 transition-colors">
                <div className="max-w-md w-full bg-surface rounded-xl shadow-lg p-8 text-center animate-in fade-in zoom-in duration-300 border border-border">
                    <SettingsIcon className="w-16 h-16 mx-auto text-primary mb-4" />
                    <h1 className="text-2xl font-bold mb-2 text-text-main">
                        Setup Required
                    </h1>
                    <p className="text-text-muted mb-6">
                        Please configure the Google Sheets backend URL to start
                        using TripSplit.
                    </p>
                    <div className="space-y-3">
                        <Link
                            href="/settings"
                            className="block w-full py-3 bg-primary text-primary-fg rounded-lg font-bold hover:opacity-90 transition"
                        >
                            Configure App
                        </Link>
                        <button
                            onClick={handleDemoLogin}
                            className="block w-full py-3 bg-background text-text-main border border-border rounded-lg font-bold hover:bg-surface transition"
                        >
                            Try Demo Mode
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Login State
    const handleEmailLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!config.allowedEmails.length) {
            setError("System not configured properly.");
            return;
        }

        if (config.allowedEmails.includes(email.trim())) {
            handleLogin({ email: email.trim(), name: email.split("@")[0] });
        } else {
            setError("This email is not in the allowed list.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 transition-colors">
            <div className="max-w-md w-full bg-surface rounded-xl shadow-lg p-8 animate-in fade-in zoom-in duration-300 border border-border">
                <h1 className="text-3xl font-bold text-center text-primary mb-2">
                    TripSplit
                </h1>
                <p className="text-center text-text-muted mb-8">
                    Secure Travel Expense Tracker
                </p>

                <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-text-main">
                            Email Access
                        </label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded border bg-background border-border text-text-main focus:ring-2 focus:ring-primary outline-none transition-colors"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <p className="text-xs text-text-muted mt-2">
                            Allowed:{" "}
                            {config.allowedEmails.slice(0, 3).join(", ")}
                            {config.allowedEmails.length > 3 && "..."}
                        </p>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button className="w-full py-3 bg-primary text-primary-fg rounded-lg font-bold hover:opacity-90 transition transform active:scale-95">
                        Access Trip
                    </button>
                </form>

                <div className="mt-4">
                    <button
                        onClick={handleDemoLogin}
                        className="w-full py-2 text-sm text-text-muted hover:text-text-main border border-dashed border-border rounded hover:border-text-muted transition"
                    >
                        Try Demo Mode (Skip Login)
                    </button>
                </div>

                <div className="mt-6">
                    <div
                        ref={googleButtonRef}
                        className="flex justify-center"
                        id="google-login-button"
                    />
                </div>

                <div className="mt-6 pt-6 border-t border-border text-center">
                    <Link
                        href="/settings"
                        className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
                    >
                        <SettingsIcon size={14} /> Settings
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPageContent;
