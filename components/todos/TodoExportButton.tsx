"use client";

import React, { useRef, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/src/types";
import { copyTextToClipboard } from "@/src/utils/clipboard";
import { formatTodosAsMarkdown } from "@/src/utils/todoMarkdown";

export interface TodoExportButtonProps {
    items: readonly TodoItem[];
    ownerDisplayName: string;
}

export function TodoExportButton({
    items,
    ownerDisplayName,
}: TodoExportButtonProps) {
    const showToast = useToast();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [fallbackMarkdown, setFallbackMarkdown] = useState<string | null>(
        null,
    );

    const handleExport = async () => {
        try {
            const markdown = formatTodosAsMarkdown(items, {
                ownerDisplayName,
            });
            const result = await copyTextToClipboard(markdown);
            if (result === "ok") {
                showToast({ kind: "success", message: "已複製為 Markdown" });
                buttonRef.current?.focus({ preventScroll: true });
                return;
            }
            setFallbackMarkdown(markdown);
        } catch {
            showToast({ kind: "error", message: "無法複製，請再試一次" });
            buttonRef.current?.focus({ preventScroll: true });
        }
    };

    const handleClose = () => {
        setFallbackMarkdown(null);
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-label="複製為 Markdown"
                onClick={() => {
                    void handleExport();
                }}
                className={cn(
                    "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 text-xs font-semibold whitespace-nowrap text-text-main shadow-2xs transition-colors hover:border-primary/40 hover:bg-background active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface min-[360px]:px-3 min-[360px]:text-[13px] forest:hover:border-primary/70 ocean:hover:border-primary/60 motion-reduce:transition-none",
                )}
            >
                <ClipboardCopy
                    aria-hidden="true"
                    className="size-[15px] shrink-0 text-primary forest:text-text-main"
                />
                <span>
                    <span className="max-[359px]:hidden">複製為 </span>
                    Markdown
                </span>
            </button>

            <Dialog
                open={fallbackMarkdown !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        handleClose();
                    }
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        const el = textareaRef.current;
                        if (el) {
                            el.focus();
                            el.select();
                            el.setSelectionRange(0, el.value.length);
                        }
                    }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        buttonRef.current?.focus();
                    }}
                    className="gap-3 rounded-2xl border border-border bg-surface p-4 text-text-main shadow-lg ring-0 sm:max-w-md"
                >
                    <DialogHeader className="gap-1 text-left">
                        <DialogTitle className="text-base font-bold text-text-main">
                            複製為 Markdown
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-5 text-text-main/68 forest:text-text-main/75">
                            請長按或使用系統複製
                        </DialogDescription>
                    </DialogHeader>

                    <textarea
                        ref={textareaRef}
                        readOnly
                        rows={8}
                        value={fallbackMarkdown ?? ""}
                        aria-label="待辦清單 Markdown 內容"
                        onFocus={(event) => {
                            event.currentTarget.select();
                            event.currentTarget.setSelectionRange(
                                0,
                                event.currentTarget.value.length,
                            );
                        }}
                        onClick={(event) => {
                            event.currentTarget.select();
                            event.currentTarget.setSelectionRange(
                                0,
                                event.currentTarget.value.length,
                            );
                        }}
                        className="w-full resize-none rounded-xl border border-border bg-background p-3 font-mono text-xs leading-5 text-text-main focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                    />

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold whitespace-nowrap text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                        >
                            關閉
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
