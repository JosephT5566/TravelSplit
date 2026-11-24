"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, TriangleAlert, X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";

const variants = {
    success: {
        Icon: CircleCheck,
        className: "border-emerald-600 bg-emerald-50 text-emerald-950",
    },
    warning: {
        Icon: TriangleAlert,
        className: "border-amber-600 bg-amber-50 text-amber-950",
    },
    error: {
        Icon: CircleAlert,
        className: "border-red-600 bg-red-50 text-red-950",
    },
};

type ToastMessage = {
    kind: keyof typeof variants;
    message: string;
};

const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);

export function useToast() {
    const showToast = useContext(ToastContext);
    if (!showToast) throw new Error("useToast must be used within ToastProvider");
    return showToast;
}

export function ToastNotice({ kind, message, children }: ToastMessage & { children?: ReactNode }) {
    const { Icon, className } = variants[kind];

    return (
        <div className={`flex items-center gap-2 rounded-lg border py-2 pr-2 pl-3 text-sm ${className}`}>
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <p className="min-w-0 flex-1 wrap-anywhere">{message}</p>
            {children}
        </div>
    );
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const nextId = useRef(0);
    const [queue, setQueue] = useState<(ToastMessage & { id: number })[]>([]);
    const [toast] = queue;

    const showToast = (message: ToastMessage) => {
        const id = nextId.current++;
        setQueue((pending) => [...pending, { ...message, id }]);
    };

    return (
        <ToastContext.Provider value={showToast}>
            <ToastPrimitive.Provider label="通知" duration={6000}>
                {children}
                {toast && (
                    <ToastPrimitive.Root
                        key={toast.id}
                        open
                        onOpenChange={(open) => {
                            if (!open) {
                                setQueue((pending) => pending.filter(({ id }) => id !== toast.id));
                            }
                        }}
                        className="rounded-lg shadow-lg"
                    >
                        <ToastNotice kind={toast.kind} message={toast.message}>
                            <ToastPrimitive.Close
                                aria-label="關閉通知"
                                className="grid size-11 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-current"
                            >
                                <X aria-hidden="true" className="size-4" />
                            </ToastPrimitive.Close>
                        </ToastNotice>
                    </ToastPrimitive.Root>
                )}
            </ToastPrimitive.Provider>
        </ToastContext.Provider>
    );
}

export function ToastViewport() {
    return (
        <ToastPrimitive.Viewport
            label="通知（{hotkey}）"
            className="absolute right-20 bottom-full left-4 mb-2 list-none sm:fixed sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto sm:mb-0 sm:w-80"
        />
    );
}
