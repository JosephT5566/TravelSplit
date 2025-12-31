"use client";

import React, { useEffect, useRef } from "react";
import { useAuthActions } from "../src/stores/AuthStore";
import {
    getProfile,
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
                onSignedIn: async () => {
                    const profile = getProfile();
                    if (profile?.email) {
                        const user: User = {
                            email: profile.email,
                            name: profile.name || profile.email,
                            picture: profile.picture,
                        };
                        await setSignIn(user);
                    }
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
