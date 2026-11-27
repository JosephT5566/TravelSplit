"use client";

import React, { useCallback, useId, useState } from "react";
import { CopyPlus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { TodoItem } from "@/src/types";
import { TodoCopyDrawer } from "./TodoCopyDrawer";

export interface TodoCopyButtonProps {
    sheetId: string;
    myEmail: string;
    ownerName: string;
    sourceItems: readonly TodoItem[];
    isOnline: boolean;
    onBackToMine?: () => void;
}

export function TodoCopyButton({
    sheetId,
    myEmail,
    ownerName,
    sourceItems,
    isOnline,
    onBackToMine,
}: TodoCopyButtonProps) {
    const [open, setOpen] = useState(false);
    const offlineReasonId = useId();
    const showToast = useToast();

    const handleSuccess = useCallback(
        (message: string) => {
            setOpen(false);
            showToast({ kind: "success", message });
        },
        [showToast],
    );

    const handleGoToMine = useCallback(() => {
        setOpen(false);
        onBackToMine?.();
    }, [onBackToMine]);

    return (
        <div className="border-b border-border bg-background/55 p-3">
            <button
                type="button"
                disabled={!isOnline}
                aria-describedby={!isOnline ? offlineReasonId : undefined}
                onClick={() => {
                    if (isOnline) {
                        setOpen(true);
                    }
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold whitespace-nowrap text-gray-950 transition-colors hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-text-main/45 disabled:opacity-100 disabled:active:scale-100 ocean:text-white motion-reduce:transition-none"
            >
                <CopyPlus aria-hidden="true" className="size-[17px] shrink-0" />
                <span>複製到我的清單</span>
            </button>

            {!isOnline && (
                <p
                    id={offlineReasonId}
                    className="mt-1.5 text-center text-xs text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68"
                >
                    離線中，恢復連線後才能複製到我的清單
                </p>
            )}

            <TodoCopyDrawer
                open={open}
                onOpenChange={setOpen}
                sheetId={sheetId}
                myEmail={myEmail}
                ownerName={ownerName}
                sourceItems={sourceItems}
                isOnline={isOnline}
                onSuccess={handleSuccess}
                onGoToMine={onBackToMine ? handleGoToMine : undefined}
            />
        </div>
    );
}
