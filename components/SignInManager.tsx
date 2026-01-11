"use client";

import React from "react";
import { useGoogleAuth } from "../src/stores/GoogleAuthStore";
import { FcGoogle } from "react-icons/fc";

export function SignInManager() {
    const { login, isGsiScriptReady } = useGoogleAuth();

    if (!isGsiScriptReady) {
        return <div>Loading...</div>; // Or a spinner
    }

    return (
        <button
            onClick={login}
            className="btn btn-primary flex items-center gap-2"
        >
            <FcGoogle size={20} />
            Sign in with Google
        </button>
    );
}