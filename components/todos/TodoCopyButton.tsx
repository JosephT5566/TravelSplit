"use client";

import React, { useCallback, useRef, useState } from "react";
import { CopyPlus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { TodoItem } from "@/src/types";
import { TodoCopyDrawer } from "./TodoCopyDrawer";

export interface TodoCopyButtonProps {
    sheetId: string;
    myEmail: string;
    ownerName: string;
    sourceItems: readonly TodoItem[];
}

export function TodoCopyButton({
    sheetId,
    myEmail,
    ownerName,
    sourceItems,
}: TodoCopyButtonProps) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const showToast = useToast();

    const handleSuccess = useCallback(
        (message: string) => {
            setOpen(false);
            showToast({ kind: "success", message });
        },
        [showToast],
    );

    return (
        <div className="border-b border-border bg-background/55 p-3">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    setOpen(true);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold whitespace-nowrap text-gray-950 transition-colors hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ocean:text-white motion-reduce:transition-none"
            >
                <CopyPlus aria-hidden="true" className="size-[17px] shrink-0" />
                <span>複製到我的清單</span>
            </button>

            <TodoCopyDrawer
                open={open}
                onOpenChange={setOpen}
                sheetId={sheetId}
                myEmail={myEmail}
                ownerName={ownerName}
                sourceItems={sourceItems}
                onSuccess={handleSuccess}
                onCloseAutoFocus={(event) => {
                    // Restore focus to the opener (the drawer is not rendered via a
                    // DrawerTrigger, so Radix has no trigger to restore to).
                    event.preventDefault();
                    triggerRef.current?.focus();
                }}
            />
        </div>
    );
}
