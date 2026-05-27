"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { SignInManager } from "./SignInManager";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    AuthErrorNotice,
    consumeAuthErrorNotice,
} from "@/src/utils/authError";

export function LoginView() {
    const [authNotice, setAuthNotice] =
        React.useState<AuthErrorNotice | null>(null);

    React.useEffect(() => {
        const notice = consumeAuthErrorNotice();
        if (!notice) {
            return;
        }

        setAuthNotice(notice);

        const url = new URL(window.location.href);
        url.searchParams.delete("auth_error");
        url.searchParams.delete("message");
        window.history.replaceState({}, "", url.toString());
    }, []);

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

            <AlertDialog
                open={!!authNotice}
                onOpenChange={(open) => {
                    if (!open) {
                        setAuthNotice(null);
                    }
                }}
            >
                <AlertDialogContent className="bg-surface">
                    <AlertDialogHeader className="gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="size-5" />
                        </div>
                        <AlertDialogTitle>{authNotice?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {authNotice?.message}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAuthNotice(null)}>
                            Got it
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
