"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getTextCounter,
    sanitizeTodoLineBreaks,
    TODO_TEXT_MAX_LENGTH,
    validateTodoText,
} from "@/src/utils/todoList";

interface TodoAddRowProps {
    isOnline: boolean;
    isSubmitting: boolean;
    offlineBannerId?: string;
    inputRef: React.RefObject<HTMLInputElement>;
    onAdd: (text: string) => Promise<boolean>;
}

export function TodoAddRow({
    isOnline,
    isSubmitting,
    offlineBannerId,
    inputRef,
    onAdd,
}: TodoAddRowProps) {
    const [draft, setDraft] = useState("");
    const submittingRef = useRef(false);
    const shouldRefocusRef = useRef(false);

    const validation = validateTodoText(draft);
    const counter = getTextCounter(draft.length);
    const isInputDisabled = !isOnline || isSubmitting;
    const isButtonDisabled = isInputDisabled || !validation.ok;

    useEffect(() => {
        if (!isSubmitting && shouldRefocusRef.current) {
            shouldRefocusRef.current = false;
            inputRef.current?.focus();
        }
    }, [isSubmitting, draft, inputRef]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submittingRef.current || isSubmitting || !isOnline) {
            return;
        }
        const checked = validateTodoText(draft);
        if (!checked.ok) {
            return;
        }

        submittingRef.current = true;
        try {
            const succeeded = await onAdd(checked.text);
            if (succeeded) {
                shouldRefocusRef.current = true;
                setDraft("");
            }
        } finally {
            submittingRef.current = false;
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="border-b border-border bg-background/55 p-3"
        >
            <div className="flex items-center gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    enterKeyHint="done"
                    autoComplete="off"
                    maxLength={TODO_TEXT_MAX_LENGTH}
                    value={draft}
                    disabled={isInputDisabled}
                    aria-label="新增待辦"
                    aria-describedby={!isOnline ? offlineBannerId : undefined}
                    placeholder={isOnline ? "新增待辦…" : "離線中，無法新增"}
                    onChange={(event) => {
                        const sanitized = sanitizeTodoLineBreaks(
                            event.target.value,
                        ).slice(0, TODO_TEXT_MAX_LENGTH);
                        setDraft(sanitized);
                    }}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 text-base text-text-main placeholder:text-text-main/45 forest:placeholder:text-text-main/50 transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:bg-background disabled:text-text-main/50 motion-reduce:transition-none"
                />
                <button
                    type="submit"
                    disabled={isButtonDisabled}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-primary px-3.5 text-sm font-semibold whitespace-nowrap text-gray-950 ocean:text-white transition-colors hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:border disabled:border-border disabled:bg-surface disabled:text-text-main/45 disabled:opacity-100 disabled:active:scale-100 motion-reduce:transition-none"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2
                                aria-hidden="true"
                                className="size-4 animate-spin motion-reduce:animate-none"
                            />
                            <span>新增中</span>
                        </>
                    ) : (
                        <>
                            <Plus aria-hidden="true" className="size-4" />
                            <span>新增</span>
                        </>
                    )}
                </button>
            </div>
            {counter && (
                <div
                    aria-live="polite"
                    className="mt-1.5 flex items-center justify-between gap-2 px-0.5 text-xs tabular-nums"
                >
                    <span />
                    <span
                        className={cn(
                            "font-semibold",
                            counter.level === "limit"
                                ? "text-red-700 forest:text-red-200"
                                : counter.level === "warn"
                                  ? "text-accent"
                                  : "text-text-main/62 forest:text-text-main/72",
                        )}
                    >
                        {counter.label}
                    </span>
                </div>
            )}
        </form>
    );
}
