"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
    Check,
    CircleAlert,
    Loader2,
    Trash2,
    TriangleAlert,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/src/types";
import {
    getTextCounter,
    sanitizeTodoLineBreaks,
    TODO_TEXT_MAX_LENGTH,
    validateTodoText,
} from "@/src/utils/todoList";

export type TodoRowMode = "normal" | "edit" | "delete";

interface TodoRowProps {
    item: TodoItem;
    canEdit: boolean;
    isOnline: boolean;
    isPending: boolean;
    mode: TodoRowMode;
    offlineBannerId?: string;
    setTextButtonRef: (id: string, node: HTMLButtonElement | null) => void;
    setDeleteButtonRef: (id: string, node: HTMLButtonElement | null) => void;
    onToggleCheck: (item: TodoItem) => void;
    onStartEdit: (item: TodoItem) => void;
    onCancelEdit: (id: string) => void;
    onSaveEdit: (id: string, text: string) => Promise<string | null>;
    onStartDelete: (item: TodoItem) => void;
    onCancelDelete: (id: string) => void;
    onConfirmDelete: (item: TodoItem) => void;
}

function TodoEditRow({
    item,
    isOnline,
    onCancel,
    onSave,
}: {
    item: TodoItem;
    isOnline: boolean;
    onCancel: () => void;
    onSave: (text: string) => Promise<string | null>;
}) {
    const [draft, setDraft] = useState(item.text);
    const [inlineError, setInlineError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const errorId = useId();
    const counter = getTextCounter(draft.length);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
    }, []);

    const fitHeight = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        // scrollHeight excludes the border, but the textarea is border-box.
        const borderY = el.offsetHeight - el.clientHeight;
        el.style.height = `${el.scrollHeight + borderY}px`;
    };

    useLayoutEffect(fitHeight, [draft]);

    useEffect(() => {
        // Re-measure when the width changes (rotation, window resize).
        window.addEventListener("resize", fitHeight);
        return () => window.removeEventListener("resize", fitHeight);
    }, []);

    const handleSave = async () => {
        if (savingRef.current || isSaving || !isOnline) {
            return;
        }

        const validation = validateTodoText(draft);
        if (!validation.ok) {
            setInlineError(
                validation.reason === "empty"
                    ? "待辦內容不可空白"
                    : "待辦內容不可超過 500 字",
            );
            textareaRef.current?.focus();
            return;
        }

        if (validation.text === item.text) {
            onCancel();
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        setInlineError(null);
        try {
            const errorMessage = await onSave(validation.text);
            if (errorMessage !== null) {
                setInlineError(errorMessage);
            }
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Esc and Enter belong to the IME while a composition is active.
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            if (!isSaving) {
                onCancel();
            }
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            if (
                !event.shiftKey &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey
            ) {
                void handleSave();
            }
        }
    };

    return (
        <div className="border-l-[3px] border-l-primary bg-primary/6 px-3 py-3 transition-colors duration-150 forest:bg-primary/14 motion-reduce:transition-none">
            <textarea
                ref={textareaRef}
                rows={1}
                maxLength={TODO_TEXT_MAX_LENGTH}
                value={draft}
                disabled={isSaving}
                aria-label="編輯待辦內容"
                aria-invalid={inlineError ? "true" : undefined}
                aria-describedby={inlineError ? errorId : undefined}
                onChange={(event) => {
                    const sanitized = sanitizeTodoLineBreaks(
                        event.target.value,
                    ).slice(0, TODO_TEXT_MAX_LENGTH);
                    setDraft(sanitized);
                    if (inlineError) {
                        setInlineError(null);
                    }
                }}
                onKeyDown={handleKeyDown}
                className={cn(
                    "min-h-11 w-full resize-none overflow-hidden rounded-xl border-2 bg-surface px-3 py-2 text-base leading-6 text-text-main shadow-xs focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60",
                    inlineError
                        ? "border-red-600 focus-visible:ring-red-600/20 forest:border-red-400"
                        : "border-primary focus-visible:ring-primary/25",
                )}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                    {inlineError ? (
                        <p
                            id={errorId}
                            role="alert"
                            className="flex items-start gap-1 text-xs font-medium text-red-700 forest:text-red-200"
                        >
                            <CircleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-3.5 shrink-0"
                            />
                            <span className="min-w-0 wrap-anywhere">
                                {inlineError}
                            </span>
                        </p>
                    ) : isSaving ? (
                        <p
                            role="status"
                            className="text-xs font-medium text-text-main/62 forest:text-text-main/72"
                        >
                            儲存中…
                        </p>
                    ) : counter ? (
                        <span
                            aria-live="polite"
                            className={cn(
                                "text-xs font-semibold tabular-nums",
                                counter.level === "limit"
                                    ? "text-red-700 forest:text-red-200"
                                    : counter.level === "warn"
                                      ? "text-accent"
                                      : "text-text-main/62 forest:text-text-main/72",
                            )}
                        >
                            {counter.label}
                        </span>
                    ) : null}
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={onCancel}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border bg-surface px-3 text-sm font-medium whitespace-nowrap text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 motion-reduce:transition-none"
                    >
                        <X aria-hidden="true" className="size-4" />
                        <span>取消</span>
                    </button>
                    <button
                        type="button"
                        disabled={isSaving || !isOnline}
                        onClick={() => {
                            void handleSave();
                        }}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-primary px-3.5 text-sm font-semibold whitespace-nowrap text-gray-950 ocean:text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-55 motion-reduce:transition-none"
                    >
                        {isSaving ? (
                            <>
                                <Loader2
                                    aria-hidden="true"
                                    className="size-4 animate-spin motion-reduce:animate-none"
                                />
                                <span>儲存中…</span>
                            </>
                        ) : (
                            <>
                                <Check aria-hidden="true" className="size-4" />
                                <span>儲存</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TodoDeleteConfirmRow({
    item,
    isOnline,
    isDeleting,
    onCancel,
    onConfirm,
}: {
    item: TodoItem;
    isOnline: boolean;
    isDeleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        cancelButtonRef.current?.focus();
    }, []);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape" && !isDeleting) {
            event.preventDefault();
            onCancel();
        }
    };

    return (
        <div
            onKeyDown={handleKeyDown}
            className="border-l-[3px] border-l-red-600 bg-red-50/90 px-3 py-3 transition-colors duration-150 forest:border-l-red-400 forest:bg-red-950/55 motion-reduce:transition-none"
        >
            <div className="flex items-start gap-2 text-sm leading-5 font-semibold text-red-950 forest:text-red-100">
                <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-red-600 forest:text-red-300"
                />
                <span className="min-w-0 flex-1 line-clamp-2 wrap-anywhere">
                    刪除「{item.text}」？
                </span>
            </div>
            <div className="mt-2.5 flex items-center justify-end gap-2">
                <button
                    ref={cancelButtonRef}
                    type="button"
                    disabled={isDeleting}
                    onClick={onCancel}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium whitespace-nowrap text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 motion-reduce:transition-none"
                >
                    取消
                </button>
                <button
                    type="button"
                    disabled={isDeleting || !isOnline}
                    onClick={onConfirm}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-red-50 forest:focus-visible:ring-offset-red-950 disabled:opacity-60 motion-reduce:transition-none"
                >
                    {isDeleting ? (
                        <>
                            <Loader2
                                aria-hidden="true"
                                className="size-4 animate-spin motion-reduce:animate-none"
                            />
                            <span>刪除中…</span>
                        </>
                    ) : (
                        <span>刪除</span>
                    )}
                </button>
            </div>
        </div>
    );
}

export function TodoRow({
    item,
    canEdit,
    isOnline,
    isPending,
    mode,
    offlineBannerId,
    setTextButtonRef,
    setDeleteButtonRef,
    onToggleCheck,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onStartDelete,
    onCancelDelete,
    onConfirmDelete,
}: TodoRowProps) {
    if (canEdit && mode === "edit") {
        return (
            <li>
                <TodoEditRow
                    item={item}
                    isOnline={isOnline}
                    onCancel={() => onCancelEdit(item.id)}
                    onSave={(text) => onSaveEdit(item.id, text)}
                />
            </li>
        );
    }

    if (canEdit && mode === "delete") {
        return (
            <li>
                <TodoDeleteConfirmRow
                    item={item}
                    isOnline={isOnline}
                    isDeleting={isPending}
                    onCancel={() => onCancelDelete(item.id)}
                    onConfirm={() => onConfirmDelete(item)}
                />
            </li>
        );
    }

    const checkboxDisabled = !canEdit || !isOnline || isPending;
    const textDisabled = !isOnline || isPending;

    return (
        <li>
            <div
                className={cn(
                    "flex min-h-[52px] items-start gap-1 px-1.5 py-1 transition-colors duration-150 motion-reduce:transition-none",
                    isPending && "bg-background/55",
                )}
            >
                <label
                    className={cn(
                        "grid size-11 shrink-0 place-items-center",
                        isPending
                            ? "cursor-wait"
                            : checkboxDisabled
                              ? "cursor-not-allowed opacity-55"
                              : "cursor-pointer",
                    )}
                >
                    <input
                        type="checkbox"
                        checked={item.checked}
                        disabled={checkboxDisabled}
                        aria-label={item.text}
                        aria-describedby={
                            !isOnline ? offlineBannerId : undefined
                        }
                        onChange={() => {
                            if (!checkboxDisabled) {
                                onToggleCheck(item);
                            }
                        }}
                        className="peer sr-only"
                    />
                    <span
                        aria-hidden="true"
                        className={cn(
                            "grid size-[22px] place-items-center rounded-[6px] border-2 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface motion-reduce:transition-none",
                            isPending
                                ? "border-primary/60 bg-primary/12 text-primary"
                                : item.checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-text-main/35 bg-surface forest:border-text-main/45",
                        )}
                    >
                        {isPending ? (
                            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                        ) : item.checked ? (
                            <Check className="size-3.5 stroke-[3]" />
                        ) : null}
                    </span>
                </label>

                {canEdit ? (
                    <button
                        ref={(node) => setTextButtonRef(item.id, node)}
                        type="button"
                        disabled={isPending}
                        aria-label={`編輯「${item.text}」`}
                        aria-disabled={textDisabled ? "true" : undefined}
                        aria-describedby={
                            !isOnline ? offlineBannerId : undefined
                        }
                        onClick={() => {
                            if (!textDisabled) {
                                onStartEdit(item);
                            }
                        }}
                        className={cn(
                            "min-h-11 min-w-0 flex-1 rounded-xl px-1.5 py-2.5 text-left text-[15px] leading-[22px] wrap-anywhere transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
                            item.checked
                                ? "text-text-main/58 line-through decoration-current/60 forest:text-text-main/72 ocean:text-text-main/68"
                                : "text-text-main",
                            isPending
                                ? "cursor-wait opacity-60"
                                : isOnline
                                  ? "cursor-pointer hover:bg-background/80 active:bg-background"
                                  : "cursor-default",
                        )}
                    >
                        {item.text}
                    </button>
                ) : (
                    <span
                        className={cn(
                            "min-h-11 min-w-0 flex-1 px-1.5 py-2.5 text-left text-[15px] leading-[22px] wrap-anywhere",
                            item.checked
                                ? "text-text-main/58 line-through decoration-current/60 forest:text-text-main/72 ocean:text-text-main/68"
                                : "text-text-main",
                        )}
                    >
                        {item.text}
                    </span>
                )}

                {canEdit && (
                    <button
                        ref={(node) => setDeleteButtonRef(item.id, node)}
                        type="button"
                        disabled={!isOnline || isPending}
                        aria-label={`刪除「${item.text}」`}
                        aria-describedby={
                            !isOnline ? offlineBannerId : undefined
                        }
                        onClick={() => {
                            if (isOnline && !isPending) {
                                onStartDelete(item);
                            }
                        }}
                        className="grid size-11 shrink-0 place-items-center rounded-xl text-text-main/38 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:bg-red-50 focus-visible:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary forest:text-text-main/48 forest:hover:bg-red-950/55 forest:hover:text-red-300 forest:focus-visible:bg-red-950/55 forest:focus-visible:text-red-300 disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none"
                    >
                        <Trash2 aria-hidden="true" className="size-[17px]" />
                    </button>
                )}
            </div>
        </li>
    );
}
