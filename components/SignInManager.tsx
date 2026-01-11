"use client";

import React from "react";
import { useGoogleAuth } from "../src/stores/GoogleAuthStore";

export function SignInManager() {
    const { login, isGsiScriptReady } = useGoogleAuth();

    if (!isGsiScriptReady) {
        return <div>Loading...</div>; // Or a spinner
    }

    return (
        <button
            onClick={login}
            className="btn btn-primary"
        >
            Sign in with Google
        </button>
    );
}