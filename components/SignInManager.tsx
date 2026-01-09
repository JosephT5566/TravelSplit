"use client";

import React, { useEffect, useRef } from "react";
import { useAuthActions } from "../src/stores/AuthStore";
import {
    initGsiOnce,
    renderGoogleButton,
} from "../src/utils/auth";
import { User } from "../src/types";

export function SignInManager() {
    const { setSignIn } = useAuthActions();
    const googleButtonRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            initGsiOnce({
                onSignedIn: async (user: User) => {
                    await setSignIn(user);
                },
                onError: (e) => console.error(e),
            });

            if (googleButtonRef.current) {
                renderGoogleButton(googleButtonRef.current);
            }
        } catch (err) {
            console.error("Failed to initialize Google sign-in", err);
        }
    }, [setSignIn]);

    return <div ref={googleButtonRef} />;
}