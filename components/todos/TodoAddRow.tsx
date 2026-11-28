"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Plus, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    countUnicodeCodePoints,
    getCategoryCounter,
    getTextCounter,
    sanitizeTodoLineBreaks,
    snapToExistingCategory,
    TODO_CATEGORY_MAX_LENGTH,
    TODO_TEXT_MAX_LENGTH,
    truncateUnicodeCodePoints,
    UNCATEGORIZED_LABEL,
    validateTodoCategory,
    validateTodoText,
} from "@/src/utils/todoList";

interface TodoAddRowProps {
    isOnline: boolean;
    isSubmitting: boolean;
    existingCategories: readonly string[];
    offlineBannerId?: string;
    inputRef: React.RefObject<HTMLInputElement>;
    onAdd: (text: string, category: string) => Promise<boolean>;
}

export function TodoAddRow({
    isOnline,
    isSubmitting,
    existingCategories,
    offlineBannerId,
    inputRef,
    onAdd,
}: TodoAddRowProps) {
    const [draft, setDraft] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [categoryDraft, setCategoryDraft] = useState("");

    const submittingRef = useRef(false);
    const shouldRefocusRef = useRef(false);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);
    const categoryInputRef = useRef<HTMLInputElement>(null);
    const pickerId = useId();
    const categoryInputId = useId();

    const validation = validateTodoText(draft);
    const counter = getTextCounter(draft.length);
    const isInputDisabled = !isOnline || isSubmitting;
    const isButtonDisabled = isInputDisabled || !validation.ok;
    const isTrayOpen = isPickerOpen && isOnline;

    const categoryCodePoints = countUnicodeCodePoints(categoryDraft);
    const categoryCounter = getCategoryCounter(categoryCodePoints);
    const snappedDraftCategory = snapToExistingCategory(
        categoryDraft,
        existingCategories,
    );
    const isExistingDraftMatch =
        Boolean(snappedDraftCategory) &&
        existingCategories.includes(snappedDraftCategory);
    const hasDraftInput = categoryDraft.trim().length > 0;
    const effectiveSelectedCategory = snapToExistingCategory(
        selectedCategory,
        existingCategories,
    );

    useEffect(() => {
        if (!isSubmitting && shouldRefocusRef.current) {
            shouldRefocusRef.current = false;
            inputRef.current?.focus();
        }
    }, [isSubmitting, draft, inputRef]);

    useEffect(() => {
        if (!isOnline && isPickerOpen) {
            setIsPickerOpen(false);
            setCategoryDraft("");
        }
    }, [isOnline, isPickerOpen]);

    const handleSelectCategory = (category: string) => {
        if (isInputDisabled) return;
        const resolved = snapToExistingCategory(category, existingCategories);
        setSelectedCategory(resolved);
        setCategoryDraft("");
        setIsPickerOpen(false);
        inputRef.current?.focus();
    };

    const handleClearCategory = () => {
        if (isInputDisabled) return;
        setSelectedCategory("");
        setCategoryDraft("");
        setIsPickerOpen(false);
        inputRef.current?.focus();
    };

    const handleApplyCategoryDraft = () => {
        if (isInputDisabled) return;
        const checkedCategory = validateTodoCategory(categoryDraft);
        if (!checkedCategory.ok) {
            return;
        }
        const resolved = snapToExistingCategory(
            checkedCategory.category,
            existingCategories,
        );
        setSelectedCategory(resolved);
        setCategoryDraft("");
        setIsPickerOpen(false);
        inputRef.current?.focus();
    };

    const handleCategoryInputKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            handleApplyCategoryDraft();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            setCategoryDraft("");
            setIsPickerOpen(false);
            triggerButtonRef.current?.focus();
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submittingRef.current || isSubmitting || !isOnline) {
            return;
        }
        const checked = validateTodoText(draft);
        if (!checked.ok) {
            return;
        }

        const rawCategory =
            isTrayOpen && hasDraftInput
                ? categoryDraft
                : effectiveSelectedCategory;
        const checkedCategory = validateTodoCategory(rawCategory);
        if (!checkedCategory.ok) {
            categoryInputRef.current?.focus();
            return;
        }
        const resolvedCategory = snapToExistingCategory(
            checkedCategory.category,
            existingCategories,
        );

        submittingRef.current = true;
        try {
            const succeeded = await onAdd(checked.text, resolvedCategory);
            if (succeeded) {
                shouldRefocusRef.current = true;
                setDraft("");
                setSelectedCategory(resolvedCategory);
                setCategoryDraft("");
                setIsPickerOpen(false);
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
            <div className="flex items-center gap-1.5">
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
                    ref={triggerButtonRef}
                    type="button"
                    disabled={isInputDisabled}
                    aria-expanded={isTrayOpen}
                    aria-controls={pickerId}
                    aria-label={
                        effectiveSelectedCategory
                            ? `選擇分類（目前：${effectiveSelectedCategory}）`
                            : `選擇分類（目前：${UNCATEGORIZED_LABEL}）`
                    }
                    aria-describedby={!isOnline ? offlineBannerId : undefined}
                    onClick={() => {
                        if (isInputDisabled) {
                            return;
                        }
                        setIsPickerOpen((open) => {
                            if (open) {
                                setCategoryDraft("");
                                return false;
                            }
                            return true;
                        });
                    }}
                    className={cn(
                        "inline-flex min-h-11 min-w-11 max-w-[84px] min-[360px]:max-w-[96px] shrink-0 items-center justify-center gap-1 rounded-xl border px-2.5 text-[13px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                        isTrayOpen || effectiveSelectedCategory
                            ? "border-primary bg-primary/12 font-semibold text-text-main forest:bg-primary/20"
                            : "border-border bg-surface font-medium text-text-main/62 hover:bg-background hover:text-text-main forest:text-text-main/72 ocean:text-text-main/68",
                    )}
                >
                    <Tag aria-hidden="true" className="size-[15px] shrink-0" />
                    {effectiveSelectedCategory ? (
                        <span className="truncate">{effectiveSelectedCategory}</span>
                    ) : (
                        <span className="hidden truncate min-[360px]:inline">
                            分類
                        </span>
                    )}
                </button>

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

            {effectiveSelectedCategory && !isTrayOpen && (
                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-text-main forest:border-primary/45 forest:bg-primary/18">
                        <Tag
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-primary forest:text-text-main"
                        />
                        <span className="min-w-0 truncate">
                            分類：{effectiveSelectedCategory}
                        </span>
                    </span>
                    <button
                        type="button"
                        disabled={isInputDisabled}
                        aria-label={`清除分類「${effectiveSelectedCategory}」`}
                        onClick={handleClearCategory}
                        className="inline-flex min-h-11 -my-2 -mr-1.5 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold whitespace-nowrap text-text-main/62 transition-colors hover:bg-surface hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45 forest:text-text-main/72 ocean:text-text-main/68 motion-reduce:transition-none"
                    >
                        <X aria-hidden="true" className="size-3.5" />
                        <span>清除分類</span>
                    </button>
                </div>
            )}

            {isTrayOpen && (
                <div
                    id={pickerId}
                    role="region"
                    aria-label="選擇或新增分類"
                    className="mt-2.5 rounded-xl border border-primary/25 bg-surface px-2.5 pt-2.5 pb-1.5 shadow-2xs"
                >
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <label
                            htmlFor={categoryInputId}
                            className="text-xs font-semibold text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68"
                        >
                            選擇既有分類或輸入新分類
                        </label>
                        {categoryCounter && (
                            <span
                                aria-live="polite"
                                className={cn(
                                    "shrink-0 text-[11px] font-semibold tabular-nums",
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
                    </div>

                    <div className="flex items-center gap-1.5">
                        <input
                            ref={categoryInputRef}
                            id={categoryInputId}
                            type="text"
                            autoComplete="off"
                            value={categoryDraft}
                            disabled={isInputDisabled}
                            placeholder="輸入新分類名稱…"
                            onChange={(event) => {
                                const sanitized = truncateUnicodeCodePoints(
                                    sanitizeTodoLineBreaks(event.target.value),
                                    TODO_CATEGORY_MAX_LENGTH,
                                );
                                setCategoryDraft(sanitized);
                            }}
                            onKeyDown={handleCategoryInputKeyDown}
                            className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-3 text-sm text-text-main placeholder:text-text-main/45 transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                        />
                        {hasDraftInput && (
                            <button
                                type="button"
                                disabled={isInputDisabled}
                                onClick={handleApplyCategoryDraft}
                                className="inline-flex min-h-11 max-w-[140px] shrink-0 items-center gap-1 rounded-[10px] bg-primary/12 px-3 text-[13px] font-semibold text-text-main transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 forest:bg-primary/22 motion-reduce:transition-none"
                            >
                                {snappedDraftCategory ? (
                                    <>
                                        {!isExistingDraftMatch && (
                                            <Plus
                                                aria-hidden="true"
                                                className="size-3.5 shrink-0"
                                            />
                                        )}
                                        <span className="truncate">
                                            {isExistingDraftMatch
                                                ? `選用「${snappedDraftCategory}」`
                                                : `新增「${snappedDraftCategory}」`}
                                        </span>
                                    </>
                                ) : (
                                    <span className="whitespace-nowrap">
                                        設為{UNCATEGORIZED_LABEL}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    <div
                        role="group"
                        aria-label="建議分類"
                        className="mt-1 flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5"
                    >
                        <button
                            type="button"
                            disabled={isInputDisabled}
                            aria-pressed={effectiveSelectedCategory === ""}
                            onClick={handleClearCategory}
                            className="inline-flex min-h-11 shrink-0 items-center py-1 focus-visible:outline-none group"
                        >
                            <span
                                className={cn(
                                    "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[13px] whitespace-nowrap transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary motion-reduce:transition-none",
                                    effectiveSelectedCategory === ""
                                        ? "border-text-main/55 bg-background font-semibold text-text-main"
                                        : "border-dashed border-border bg-surface font-medium text-text-main/62 hover:bg-background forest:text-text-main/72",
                                )}
                            >
                                {UNCATEGORIZED_LABEL}
                            </span>
                        </button>

                        {existingCategories.map((category) => {
                            const isSelected = effectiveSelectedCategory === category;
                            return (
                                <button
                                    key={category}
                                    type="button"
                                    disabled={isInputDisabled}
                                    aria-pressed={isSelected}
                                    onClick={() =>
                                        handleSelectCategory(category)
                                    }
                                    className="inline-flex min-h-11 shrink-0 items-center py-1 focus-visible:outline-none group"
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
                                        <span className="truncate">
                                            {category}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <p className="pt-0.5 pb-1 text-[11px] leading-4 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68">
                        留空或輸入「{UNCATEGORIZED_LABEL}
                        」會放入未分類；大小寫相同會自動對應既有分類。
                    </p>
                </div>
            )}

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
