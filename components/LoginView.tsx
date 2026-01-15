"use client";

import React from "react";
import { SignInManager } from "./SignInManager";

export function LoginView() {
    return (
        <div className="min-h-dvh flex items-center justify-center bg-background px-4 transition-colors">
            <div className="max-w-md w-full bg-surface rounded-xl shadow-lg p-8 animate-in fade-in zoom-in duration-300 border border-border">
                <h1 className="text-3xl font-bold text-center text-primary mb-2">
                    TripSplit
                </h1>
                <p className="text-center text-text-muted mb-2">
                    Login to use the split app.
                </p>

                <div className="relative flex py-5 items-center">
                    <div className="grow border-t border-border"></div>
                </div>

                <div className="mt-2 flex justify-center">
                    <SignInManager />
                </div>
            </div>
        </div>
    );
}
