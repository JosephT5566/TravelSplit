"use client";

import React from "react";
import { FcGoogle } from "react-icons/fc";

export function SignInManager() {
    const handleLogin = () => {
        const url = process.env.NEXT_PUBLIC_AUTH_PROXY;
        if (!url) {
            console.error("Missing NEXT_PUBLIC_AUTH_PROXY");
            return;
        }
        const currentUrl = window.location.origin + window.location.pathname;
        window.location.href = `${url}/auth/travel-split/login?redirect_to=${encodeURIComponent(currentUrl)}`;
    };

    return (
        <button
            onClick={handleLogin}
            className="btn btn-primary flex items-center gap-2"
        >
            <FcGoogle size={20} />
            Sign in with Google
        </button>
    );
}
