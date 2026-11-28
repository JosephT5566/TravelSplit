"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
    Check,
    CircleAlert,
    RotateCw,
    Tag,
    Trash2,
    TriangleAlert,
    Undo2,
    X,
} from "lucide-react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/src/types";
import type { TodoOverlayItemStatus } from "@/src/utils/todoOutbox";
import {
    countUnicodeCodePoints,
    getCategoryCounter,
    getTextCounter,
    normalizeTodoCategory,
    sanitizeTodoLineBreaks,
    snapToExistingCategory,
    TODO_CATEGORY_MAX_LENGTH,
    TODO_TEXT_MAX_LENGTH,
    truncateUnicodeCodePoints,
    UNCATEGORIZED_LABEL,
    validateTodoCategory,
    validateTodoText,
} from "@/src/utils/todoList";

export type TodoRowMode = "normal" | "edit" | "delete";

export type TodoRowEditUpdates = {
    text?: string;
    category?: string;
};

interface TodoRowProps {
    item: TodoItem;
    canEdit: boolean;
    mode: TodoRowMode;
    syncStatus?: TodoOverlayItemStatus;
    syncError?: string;
    existingCategories: readonly string[];
    setTextButtonRef: (id: string, node: HTMLButtonElement | null) => void;
    setDeleteButtonRef: (id: string, node: HTMLButtonElement | null) => void;
    onToggleCheck: (item: TodoItem) => void;
    onStartEdit: (item: TodoItem) => void;
    onCancelEdit: (id: string) => void;
    onSaveEdit: (
        id: string,
        updates: TodoRowEditUpdates,
    ) => Promise<string | null>;
    onStartDelete: (item: TodoItem) => void;
    onCancelDelete: (id: string) => void;
    onConfirmDelete: (item: TodoItem) => Promise<void> | void;
    onRetrySync?: (id: string) => void;
    onDiscardSync?: (id: string) => void;
}

function TodoEditRow({
    item,
    existingCategories,
    onCancel,
    onSave,
}: {
    item: TodoItem;
    existingCategories: readonly string[];
    onCancel: () => void;
    onSave: (updates: TodoRowEditUpdates) => Promise<string | null>;
}) {
    const initialCategory = normalizeTodoCategory(item.category);
    const [draft, setDraft] = useState(item.text);
    const [selectedCategory, setSelectedCategory] = useState(initialCategory);
    const [customCategoryInput, setCustomCategoryInput] = useState("");
    const [inlineError, setInlineError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const savingRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const categoryInputRef = useRef<HTMLInputElement>(null);
    const errorId = useId();
    const counter = getTextCounter(draft.length);

    const hasCustomInput = customCategoryInput.trim().length > 0;
    const rawCategoryDraft = hasCustomInput
        ? customCategoryInput
        : selectedCategory;
    const effectiveCategory = snapToExistingCategory(
        rawCategoryDraft,
        existingCategories,
    );
    const categoryCounter = getCategoryCounter(
        countUnicodeCodePoints(customCategoryInput),
    );
    const inputsDisabled = isSaving;

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
        if (savingRef.current || isSaving) {
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

        const normalizedDraftCategory = normalizeTodoCategory(rawCategoryDraft);
        const nextCategory =
            normalizedDraftCategory === initialCategory
                ? initialCategory
                : snapToExistingCategory(
                      normalizedDraftCategory,
                      existingCategories,
                  );
        const textChanged = validation.text !== item.text;
        const categoryChanged = nextCategory !== initialCategory;

        if (categoryChanged) {
            const categoryValidation = validateTodoCategory(nextCategory);
            if (!categoryValidation.ok) {
                setInlineError(`分類不可超過 ${TODO_CATEGORY_MAX_LENGTH} 字`);
                categoryInputRef.current?.focus();
                return;
            }
        }

        if (!textChanged && !categoryChanged) {
            onCancel();
            return;
        }

        const updates: TodoRowEditUpdates = {};
        if (textChanged) {
            updates.text = validation.text;
        }
        if (categoryChanged) {
            updates.category = nextCategory;
        }

        savingRef.current = true;
        setIsSaving(true);
        setInlineError(null);
        try {
            const errorMessage = await onSave(updates);
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

    const handleCategoryKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
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
            void handleSave();
        }
    };

    const handleClearCategory = () => {
        if (inputsDisabled) return;
        setSelectedCategory("");
        setCustomCategoryInput("");
        if (inlineError) {
            setInlineError(null);
        }
    };

    return (
        <div className="border-l-[3px] border-l-primary bg-primary/6 px-3 py-3 transition-colors duration-150 forest:bg-primary/14 motion-reduce:transition-none">
            <textarea
                ref={textareaRef}
                rows={1}
                maxLength={TODO_TEXT_MAX_LENGTH}
                value={draft}
                disabled={inputsDisabled}
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

            <div
                role="group"
                aria-label="變更或清除分類"
                className="mt-2.5 border-t border-dashed border-primary/25 pt-2"
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                        <Tag aria-hidden="true" className="size-3.5 shrink-0" />
                        <span>分類</span>
                        {categoryCounter && (
                            <span
                                aria-live="polite"
                                className={cn(
                                    "ml-1 text-[11px] font-semibold tabular-nums",
                                    categoryCounter.level === "limit"
                                        ? "text-red-700 forest:text-red-200"
                                        : categoryCounter.level === "warn"
                                          ? "text-accent"
                                          : "text-text-main/62 forest:text-text-main/72",
                                )}
                            >
                                {categoryCounter.label}
                            </span>
                        )}
                    </span>

                    {(effectiveCategory || customCategoryInput) && (
                        <button
                            type="button"
                            disabled={inputsDisabled}
                            onClick={handleClearCategory}
                            className="inline-flex min-h-11 -my-2.5 -mr-1.5 shrink-0 items-center rounded-lg px-2 text-xs font-semibold whitespace-nowrap text-text-main/62 underline decoration-border underline-offset-3 transition-colors hover:bg-surface/70 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45 forest:text-text-main/72 ocean:text-text-main/68 motion-reduce:transition-none"
                        >
                            清除為未分類
                        </button>
                    )}
                </div>

                <div
                    role="group"
                    aria-label="選擇分類"
                    className="mt-0.5 flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5"
                >
                    <button
                        type="button"
                        disabled={inputsDisabled}
                        aria-pressed={effectiveCategory === ""}
                        onClick={handleClearCategory}
                        className="inline-flex min-h-11 shrink-0 items-center py-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 group"
                    >
                        <span
                            className={cn(
                                "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[13px] whitespace-nowrap transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary motion-reduce:transition-none",
                                effectiveCategory === ""
                                    ? "border-text-main/55 bg-background font-semibold text-text-main"
                                    : "border-dashed border-border bg-surface font-medium text-text-main/62 hover:bg-background forest:text-text-main/72",
                            )}
                        >
                            {UNCATEGORIZED_LABEL}
                        </span>
                    </button>

                    {existingCategories.map((category) => {
                        const isSelected = effectiveCategory === category;
                        return (
                            <button
                                key={category}
                                type="button"
                                disabled={inputsDisabled}
                                aria-pressed={isSelected}
                                onClick={() => {
                                    if (inputsDisabled) return;
                                    setSelectedCategory(category);
                                    setCustomCategoryInput("");
                                    if (inlineError) {
                                        setInlineError(null);
                                    }
                                }}
                                className="inline-flex min-h-11 shrink-0 items-center py-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 group"
                            >
                                <span
                                    className={cn(
                                        "inline-flex min-h-8 max-w-[220px] items-center gap-1 rounded-full border px-3 py-1 text-[13px] whitespace-nowrap transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary motion-reduce:transition-none",
                                        isSelected
                                            ? "border-primary bg-primary/12 font-semibold text-text-main forest:bg-primary/22"
                                            : "border-border bg-surface font-medium text-text-main hover:bg-background",
                                    )}
                                >
                                    {isSelected && (
                                        <Check
                                            aria-hidden="true"
                                            className="size-3.5 shrink-0"
                                        />
                                    )}
                                    <span className="truncate">{category}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-1">
                    <input
                        ref={categoryInputRef}
                        type="text"
                        autoComplete="off"
                        value={customCategoryInput}
                        disabled={inputsDisabled}
                        placeholder={`或輸入新分類（最多 ${TODO_CATEGORY_MAX_LENGTH} 字）…`}
                        aria-label="輸入新分類"
                        onChange={(event) => {
                            const sanitized = truncateUnicodeCodePoints(
                                sanitizeTodoLineBreaks(event.target.value),
                                TODO_CATEGORY_MAX_LENGTH,
                            );
                            setCustomCategoryInput(sanitized);
                            if (inlineError) {
                                setInlineError(null);
                            }
                        }}
                        onKeyDown={handleCategoryKeyDown}
                        className="min-h-11 w-full rounded-[10px] border border-border bg-surface px-3 text-sm text-text-main placeholder:text-text-main/45 transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                    />
                </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
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
                        disabled={isSaving}
                        onClick={() => {
                            void handleSave();
                        }}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-primary px-3.5 text-sm font-semibold whitespace-nowrap text-gray-950 ocean:text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-55 motion-reduce:transition-none"
                    >
                        <Check aria-hidden="true" className="size-4" />
                        <span>儲存</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function TodoDeleteConfirmRow({
    item,
    onCancel,
    onConfirm,
}: {
    item: TodoItem;
    onCancel: () => void;
    onConfirm: () => Promise<void> | void;
}) {
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const deletingRef = useRef(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        cancelButtonRef.current?.focus();
    }, []);

    const handleConfirm = async () => {
        if (deletingRef.current || isDeleting) {
            return;
        }
        deletingRef.current = true;
        setIsDeleting(true);
        try {
            await onConfirm();
        } finally {
            deletingRef.current = false;
            setIsDeleting(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            if (!deletingRef.current && !isDeleting) {
                onCancel();
            }
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
                    disabled={isDeleting}
                    onClick={() => {
                        void handleConfirm();
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-red-50 forest:focus-visible:ring-offset-red-950 disabled:opacity-60 motion-reduce:transition-none"
                >
                    <span>刪除</span>
                </button>
            </div>
        </div>
    );
}

function TodoRowSyncDot({
    syncStatus,
    syncError,
    onRetry,
    onDiscard,
}: {
    syncStatus?: TodoOverlayItemStatus;
    syncError?: string;
    onRetry?: () => void;
    onDiscard?: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);

    if (!syncStatus) {
        return null;
    }

    if (syncStatus === "pending") {
        return (
            <span
                role="img"
                aria-label="未同步"
                data-slot="todo-sync-dot"
                data-sync-status="pending"
                className="mx-1.5 mt-[18px] size-2 shrink-0 rounded-full bg-amber-500"
            />
        );
    }

    if (syncStatus === "inflight") {
        return (
            <span
                role="img"
                aria-label="儲存中"
                data-slot="todo-sync-dot"
                data-sync-status="inflight"
                className="mx-1.5 mt-[18px] size-2 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
            />
        );
    }

    const failedMessage = syncError?.trim() || "此項目同步失敗";

    return (
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-label="同步失敗"
                    data-slot="todo-sync-dot"
                    data-sync-status="failed"
                    className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 forest:hover:bg-red-950/55 forest:focus-visible:bg-red-950/55 motion-reduce:transition-none"
                >
                    <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full bg-red-600 forest:bg-red-400"
                    />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="end"
                    sideOffset={4}
                    collisionPadding={12}
                    data-slot="todo-failed-menu"
                    className="z-50 min-w-44 max-w-60 rounded-xl border border-border bg-surface p-1.5 text-text-main shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                >
                    <p className="px-2.5 py-1 text-xs leading-4 font-semibold wrap-anywhere text-red-600 forest:text-red-300">
                        {failedMessage}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setMenuOpen(false);
                            onRetry?.();
                        }}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium text-text-main transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                    >
                        <RotateCw
                            aria-hidden="true"
                            className="size-4 shrink-0 text-primary"
                        />
                        <span>重試</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMenuOpen(false);
                            onDiscard?.();
                        }}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 forest:text-red-300 forest:hover:bg-red-950/55 motion-reduce:transition-none"
                    >
                        <Undo2
                            aria-hidden="true"
                            className="size-4 shrink-0"
                        />
                        <span>捨棄變更</span>
                    </button>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

export function TodoRow({
    item,
    canEdit,
    mode,
    syncStatus,
    syncError,
    existingCategories,
    setTextButtonRef,
    setDeleteButtonRef,
    onToggleCheck,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onStartDelete,
    onCancelDelete,
    onConfirmDelete,
    onRetrySync,
    onDiscardSync,
}: TodoRowProps) {
    if (canEdit && mode === "edit") {
        return (
            <li data-todo-id={item.id}>
                <TodoEditRow
                    item={item}
                    existingCategories={existingCategories}
                    onCancel={() => onCancelEdit(item.id)}
                    onSave={(updates) => onSaveEdit(item.id, updates)}
                />
            </li>
        );
    }

    if (canEdit && mode === "delete") {
        return (
            <li data-todo-id={item.id}>
                <TodoDeleteConfirmRow
                    item={item}
                    onCancel={() => onCancelDelete(item.id)}
                    onConfirm={() => onConfirmDelete(item)}
                />
            </li>
        );
    }

    if (!canEdit) {
        return (
            <li data-todo-id={item.id}>
                <div className="flex min-h-[48px] items-start gap-3 px-4 py-3">
                    <span
                        aria-hidden="true"
                        className={cn(
                            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                            item.checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-text-main/28 bg-background/40 forest:border-text-main/38",
                        )}
                    >
                        {item.checked && (
                            <Check className="size-3 stroke-[3]" />
                        )}
                    </span>
                    <span
                        className={cn(
                            "min-w-0 flex-1 text-[15px] leading-[22px] wrap-anywhere",
                            item.checked
                                ? "text-text-main/58 line-through decoration-current/60 forest:text-text-main/72 ocean:text-text-main/68"
                                : "text-text-main",
                        )}
                    >
                        <span className="sr-only">
                            {item.checked ? "已完成：" : "未完成："}
                        </span>
                        {item.text}
                    </span>
                </div>
            </li>
        );
    }

    return (
        <li data-todo-id={item.id}>
            <div className="flex min-h-[52px] items-start gap-1 px-1.5 py-1 transition-colors duration-150 motion-reduce:transition-none">
                <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
                    <input
                        type="checkbox"
                        checked={item.checked}
                        aria-label={item.text}
                        onChange={() => {
                            onToggleCheck(item);
                        }}
                        className="peer sr-only"
                    />
                    <span
                        aria-hidden="true"
                        className={cn(
                            "grid size-[22px] place-items-center rounded-[6px] border-2 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface motion-reduce:transition-none",
                            item.checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-text-main/35 bg-surface forest:border-text-main/45",
                        )}
                    >
                        {item.checked ? (
                            <Check className="size-3.5 stroke-[3]" />
                        ) : null}
                    </span>
                </label>

                <button
                    ref={(node) => setTextButtonRef(item.id, node)}
                    type="button"
                    aria-label={`編輯「${item.text}」`}
                    onClick={() => {
                        onStartEdit(item);
                    }}
                    className={cn(
                        "min-h-11 min-w-0 flex-1 cursor-pointer rounded-xl px-1.5 py-2.5 text-left text-[15px] leading-[22px] wrap-anywhere transition-colors hover:bg-background/80 active:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
                        item.checked
                            ? "text-text-main/58 line-through decoration-current/60 forest:text-text-main/72 ocean:text-text-main/68"
                            : "text-text-main",
                    )}
                >
                    {item.text}
                </button>

                <TodoRowSyncDot
                    syncStatus={syncStatus}
                    syncError={syncError}
                    onRetry={
                        onRetrySync ? () => onRetrySync(item.id) : undefined
                    }
                    onDiscard={
                        onDiscardSync
                            ? () => onDiscardSync(item.id)
                            : undefined
                    }
                />

                <button
                    ref={(node) => setDeleteButtonRef(item.id, node)}
                    type="button"
                    aria-label={`刪除「${item.text}」`}
                    onClick={() => {
                        onStartDelete(item);
                    }}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-text-main/38 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:bg-red-50 focus-visible:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary forest:text-text-main/48 forest:hover:bg-red-950/55 forest:hover:text-red-300 forest:focus-visible:bg-red-950/55 forest:focus-visible:text-red-300 motion-reduce:transition-none"
                >
                    <Trash2 aria-hidden="true" className="size-[17px]" />
                </button>
            </div>
        </li>
    );
}
