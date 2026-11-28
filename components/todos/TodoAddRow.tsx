"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Check, CircleAlert, Loader2, Plus, Tag, X } from "lucide-react";
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
    validateRequiredTodoCategory,
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

function getRequiredCategoryErrorMessage(
    reason: "required" | "uncategorized" | "too-long",
): string {
    if (reason === "uncategorized") {
        return `不可使用「${UNCATEGORIZED_LABEL}」作為分類名稱，請改用其他名稱`;
    }
    if (reason === "too-long") {
        return `分類不可超過 ${TODO_CATEGORY_MAX_LENGTH} 字`;
    }
    return "請輸入分類名稱";
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
    const [categoryError, setCategoryError] = useState<string | null>(null);

    const submittingRef = useRef(false);
    const shouldRefocusRef = useRef(false);
    const shouldFocusCategoryInputRef = useRef(false);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);
    const categoryInputRef = useRef<HTMLInputElement>(null);

    const pickerId = useId();
    const categoryInputId = useId();
    const categoryHintId = useId();
    const categoryErrorId = useId();
    const categoryNoteId = useId();

    const validation = validateTodoText(draft);
    const counter = getTextCounter(draft.length);
    const isInputDisabled = !isOnline || isSubmitting;
    const isTrayOpen = isPickerOpen && isOnline;

    const effectiveSelectedCategory = snapToExistingCategory(
        selectedCategory,
        existingCategories,
    );
    const hasCategory = effectiveSelectedCategory.length > 0;
    const hasExistingCategories = existingCategories.length > 0;

    const isNativeButtonDisabled = isInputDisabled || !validation.ok;
    const isMissingCategorySubmit = !isNativeButtonDisabled && !hasCategory;
    const isVisuallyDisabledSubmit = isNativeButtonDisabled || !hasCategory;

    const categoryCodePoints = countUnicodeCodePoints(categoryDraft);
    const categoryCounter = getCategoryCounter(categoryCodePoints);
    const draftValidation = validateRequiredTodoCategory(categoryDraft);
    const snappedDraftCategory = draftValidation.ok
        ? snapToExistingCategory(draftValidation.category, existingCategories)
        : "";
    const isExistingDraftMatch =
        Boolean(snappedDraftCategory) &&
        existingCategories.includes(snappedDraftCategory);
    const hasDraftInput = categoryDraft.trim().length > 0;

    const describedByIds =
        [
            !isOnline ? offlineBannerId : undefined,
            !hasCategory ? categoryHintId : undefined,
        ]
            .filter(Boolean)
            .join(" ") || undefined;

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
            setCategoryError(null);
        }
    }, [isOnline, isPickerOpen]);

    useEffect(() => {
        if (isTrayOpen && shouldFocusCategoryInputRef.current) {
            shouldFocusCategoryInputRef.current = false;
            categoryInputRef.current?.focus();
        }
    }, [isTrayOpen]);

    const openTrayAndFocusInput = () => {
        if (isInputDisabled) return;
        if (isTrayOpen) {
            categoryInputRef.current?.focus();
            return;
        }
        shouldFocusCategoryInputRef.current = true;
        setCategoryError(null);
        setIsPickerOpen(true);
    };

    const handleSelectCategory = (category: string) => {
        if (isInputDisabled) return;
        const resolved = snapToExistingCategory(category, existingCategories);
        if (!resolved) return;
        setSelectedCategory(resolved);
        setCategoryDraft("");
        setCategoryError(null);
        setIsPickerOpen(false);
        inputRef.current?.focus();
    };

    const handleClearCategory = () => {
        if (isInputDisabled) return;
        setSelectedCategory("");
        setCategoryDraft("");
        setCategoryError(null);
        setIsPickerOpen(false);
        inputRef.current?.focus();
    };

    const handleApplyCategoryDraft = () => {
        if (isInputDisabled) return;
        const checkedCategory = validateRequiredTodoCategory(categoryDraft);
        if (!checkedCategory.ok) {
            setCategoryError(
                getRequiredCategoryErrorMessage(checkedCategory.reason),
            );
            categoryInputRef.current?.focus();
            return;
        }
        const resolved = snapToExistingCategory(
            checkedCategory.category,
            existingCategories,
        );
        if (!resolved) {
            setCategoryError(getRequiredCategoryErrorMessage("required"));
            categoryInputRef.current?.focus();
            return;
        }
        setSelectedCategory(resolved);
        setCategoryDraft("");
        setCategoryError(null);
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
            setCategoryError(null);
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

        if (!hasCategory) {
            openTrayAndFocusInput();
            return;
        }

        const rawCategory =
            isTrayOpen && hasDraftInput
                ? categoryDraft
                : effectiveSelectedCategory;
        const checkedCategory = validateRequiredTodoCategory(rawCategory);
        if (!checkedCategory.ok) {
            setCategoryError(
                getRequiredCategoryErrorMessage(checkedCategory.reason),
            );
            openTrayAndFocusInput();
            return;
        }
        const resolvedCategory = snapToExistingCategory(
            checkedCategory.category,
            existingCategories,
        );
        if (!resolvedCategory) {
            openTrayAndFocusInput();
            return;
        }

        submittingRef.current = true;
        try {
            const succeeded = await onAdd(checked.text, resolvedCategory);
            if (succeeded) {
                shouldRefocusRef.current = true;
                setDraft("");
                setSelectedCategory(resolvedCategory);
                setCategoryDraft("");
                setCategoryError(null);
                setIsPickerOpen(false);
            }
        } finally {
            submittingRef.current = false;
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="border-b border-border bg-background/55 p-2.5 min-[360px]:p-3"
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
                    aria-describedby={describedByIds}
                    placeholder={isOnline ? "新增待辦…" : "離線中，無法新增"}
                    onChange={(event) => {
                        const sanitized = sanitizeTodoLineBreaks(
                            event.target.value,
                        ).slice(0, TODO_TEXT_MAX_LENGTH);
                        setDraft(sanitized);
                    }}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-2.5 text-base text-text-main placeholder:text-text-main/45 transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:bg-background disabled:text-text-main/50 min-[360px]:px-3.5 forest:placeholder:text-text-main/50 motion-reduce:transition-none"
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
                            : "選擇分類（尚未選擇）"
                    }
                    aria-describedby={!isOnline ? offlineBannerId : undefined}
                    onClick={() => {
                        if (isInputDisabled) {
                            return;
                        }
                        setIsPickerOpen((open) => {
                            if (open) {
                                setCategoryDraft("");
                                setCategoryError(null);
                                return false;
                            }
                            shouldFocusCategoryInputRef.current = true;
                            setCategoryError(null);
                            return true;
                        });
                    }}
                    className={cn(
                        "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 min-[360px]:px-2.5 min-[360px]:text-[13px] motion-reduce:transition-none",
                        effectiveSelectedCategory
                            ? "max-w-[88px] border border-primary bg-primary/12 font-semibold text-text-main min-[360px]:max-w-[96px] forest:bg-primary/20"
                            : isTrayOpen
                              ? "border-[1.5px] border-solid border-accent bg-orange-100/90 font-semibold text-orange-900 ring-2 ring-accent/20 forest:bg-accent/25 forest:text-orange-100"
                              : "border-[1.5px] border-dashed border-accent bg-orange-50 font-semibold text-orange-900 hover:bg-orange-100/80 forest:bg-accent/18 forest:text-orange-100",
                    )}
                >
                    <Tag
                        aria-hidden="true"
                        className="size-3.5 shrink-0 min-[360px]:size-[15px]"
                    />
                    {effectiveSelectedCategory ? (
                        <span className="truncate">
                            {effectiveSelectedCategory}
                        </span>
                    ) : (
                        <span>選擇分類</span>
                    )}
                </button>

                <button
                    type="submit"
                    disabled={isNativeButtonDisabled}
                    aria-disabled={isMissingCategorySubmit ? "true" : undefined}
                    aria-describedby={describedByIds}
                    className={cn(
                        "inline-flex min-h-11 min-w-12 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface min-[360px]:px-3.5 min-[360px]:text-sm motion-reduce:transition-none",
                        isVisuallyDisabledSubmit
                            ? "cursor-not-allowed border border-border bg-surface text-text-main/45 active:scale-100"
                            : "bg-primary text-gray-950 hover:opacity-90 active:scale-[0.98] ocean:text-white",
                    )}
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
                            <Plus
                                aria-hidden="true"
                                className="hidden size-4 min-[360px]:inline-block"
                            />
                            <span>新增</span>
                        </>
                    )}
                </button>
            </div>

            {!hasCategory && (
                <p
                    id={categoryHintId}
                    className="mt-2 flex items-center gap-1.5 text-xs leading-4 font-semibold text-orange-900 forest:text-orange-200"
                >
                    <CircleAlert
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-accent"
                    />
                    <span>新增前請先選擇或建立分類</span>
                </p>
            )}

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
                    aria-label={
                        hasExistingCategories
                            ? "選擇或建立分類"
                            : "建立第一個分類"
                    }
                    className={cn(
                        "mt-2.5 rounded-xl border bg-surface px-2.5 pt-2.5 pb-2 shadow-2xs",
                        hasCategory
                            ? "border-primary/25"
                            : "border-[1.5px] border-accent/45",
                    )}
                >
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <label
                            htmlFor={categoryInputId}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-main"
                        >
                            <span>
                                {hasExistingCategories
                                    ? "選擇或建立分類"
                                    : "建立第一個分類"}
                            </span>
                            <span className="rounded-md border border-accent/35 bg-orange-50 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-orange-900 forest:bg-accent/20 forest:text-orange-100">
                                必填
                            </span>
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
                            aria-invalid={categoryError ? "true" : undefined}
                            aria-describedby={
                                categoryError ? categoryErrorId : categoryNoteId
                            }
                            placeholder={
                                hasExistingCategories
                                    ? "輸入新分類（例如：交通）"
                                    : "例如：行李"
                            }
                            onChange={(event) => {
                                const sanitized = truncateUnicodeCodePoints(
                                    sanitizeTodoLineBreaks(event.target.value),
                                    TODO_CATEGORY_MAX_LENGTH,
                                );
                                setCategoryDraft(sanitized);
                                if (categoryError) {
                                    setCategoryError(null);
                                }
                            }}
                            onKeyDown={handleCategoryInputKeyDown}
                            className={cn(
                                "min-h-11 min-w-0 flex-1 rounded-[10px] border bg-surface px-3 text-base text-text-main placeholder:text-text-main/45 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                                categoryError
                                    ? "border-red-600 focus-visible:border-red-600 focus-visible:ring-red-600/20 forest:border-red-400"
                                    : "border-border focus-visible:border-primary focus-visible:ring-primary/25",
                            )}
                        />
                        <button
                            type="button"
                            disabled={isInputDisabled}
                            aria-label={
                                snappedDraftCategory
                                    ? isExistingDraftMatch
                                        ? `選用既有分類「${snappedDraftCategory}」`
                                        : `建立新分類「${snappedDraftCategory}」`
                                    : "建立分類"
                            }
                            onClick={handleApplyCategoryDraft}
                            className={cn(
                                "inline-flex min-h-11 min-w-14 shrink-0 items-center justify-center gap-1 rounded-[10px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                                draftValidation.ok
                                    ? "bg-primary/12 text-text-main hover:bg-primary/20 forest:bg-primary/22"
                                    : "border border-border bg-surface text-text-main/55 hover:bg-background",
                            )}
                        >
                            <span>{isExistingDraftMatch ? "選用" : "建立"}</span>
                        </button>
                    </div>

                    {categoryError && (
                        <p
                            id={categoryErrorId}
                            role="alert"
                            className="mt-1.5 flex items-start gap-1 text-xs leading-4 font-semibold text-red-700 forest:text-red-200"
                        >
                            <CircleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-3.5 shrink-0"
                            />
                            <span className="min-w-0 wrap-anywhere">
                                {categoryError}
                            </span>
                        </p>
                    )}

                    {hasExistingCategories && (
                        <div
                            role="group"
                            aria-label="既有分類"
                            className="mt-1 flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5"
                        >
                            {existingCategories.map((category) => {
                                const isSelected =
                                    effectiveSelectedCategory === category;
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
                    )}

                    <p
                        id={categoryNoteId}
                        className="mt-1.5 text-[11px] leading-4 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68"
                    >
                        大小寫相同會自動對應既有分類；不可使用「
                        {UNCATEGORIZED_LABEL}」。
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
