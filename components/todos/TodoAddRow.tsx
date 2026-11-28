"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, CircleAlert, Loader2, Plus, X } from "lucide-react";
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
    isTodoCategoryRegionVisible,
    validateRequiredTodoCategory,
    validateTodoText,
} from "@/src/utils/todoList";

interface TodoAddRowProps {
    isSubmitting?: boolean;
    existingCategories: readonly string[];
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
    isSubmitting = false,
    existingCategories,
    inputRef,
    onAdd,
}: TodoAddRowProps) {
    const [draft, setDraft] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
    const [categoryDraft, setCategoryDraft] = useState("");
    const [categoryError, setCategoryError] = useState<string | null>(null);
    // True once the user has focused/tapped anywhere in the add form; cleared by
    // Escape, a pointerdown outside the form, or focus moving to another element.
    // A blur with no related target (mobile taps do not focus buttons) never clears it.
    const [isEngaged, setIsEngaged] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const categoryRegionRef = useRef<HTMLDivElement | null>(null);
    const submittingRef = useRef(false);
    const shouldRefocusRef = useRef(false);
    const shouldFocusCategoryInputRef = useRef(false);
    const newCategoryToggleRef = useRef<HTMLButtonElement>(null);
    const categoryInputRef = useRef<HTMLInputElement>(null);

    const categoryRegionId = useId();
    const categoryGroupLabelId = useId();
    const newCategoryPanelId = useId();
    const categoryInputId = useId();
    const categoryHintId = useId();
    const categoryErrorId = useId();
    const categoryNoteId = useId();

    const validation = validateTodoText(draft);
    const counter = getTextCounter(draft.length);
    const isInputDisabled = isSubmitting;

    const hasExistingCategories = existingCategories.length > 0;
    const effectiveSelectedCategory = hasExistingCategories
        ? snapToExistingCategory(selectedCategory, existingCategories)
        : "";
    const hasCategory = effectiveSelectedCategory.length > 0;

    const displayedCategories =
        effectiveSelectedCategory &&
        !existingCategories.includes(effectiveSelectedCategory)
            ? [...existingCategories, effectiveSelectedCategory]
            : existingCategories;

    const isNewCategoryVisible = hasExistingCategories && isNewCategoryOpen;
    const isCategoryInputShown = !hasExistingCategories || isNewCategoryVisible;

    const categoryCodePoints = countUnicodeCodePoints(categoryDraft);
    const categoryCounter = getCategoryCounter(categoryCodePoints);
    const draftValidation = validateRequiredTodoCategory(categoryDraft);
    const hasDraftInput = categoryDraft.trim().length > 0;
    const snappedDraftCategory = draftValidation.ok
        ? snapToExistingCategory(draftValidation.category, existingCategories)
        : "";
    const isExistingDraftMatch =
        Boolean(snappedDraftCategory) &&
        existingCategories.includes(snappedDraftCategory);

    const hasReadyCategory = hasExistingCategories
        ? isNewCategoryVisible && hasDraftInput
            ? draftValidation.ok
            : hasCategory
        : draftValidation.ok;

    const isNativeButtonDisabled = isInputDisabled || !validation.ok;
    const isMissingCategorySubmit =
        !isNativeButtonDisabled && !hasReadyCategory;
    const isVisuallyDisabledSubmit =
        isNativeButtonDisabled || !hasReadyCategory;

    const isCategoryRegionVisible = isTodoCategoryRegionVisible({
        focusWithin: isEngaged,
        textDraft: draft,
        hasCategoryError: categoryError !== null,
    });

    const showRequiredHint = hasExistingCategories ? !hasCategory : true;
    const describedByIds = showRequiredHint ? categoryHintId : undefined;

    // Applied in the commit phase (not a passive effect) so the block is
    // already focusable when a keydown/submit right after typing moves focus into it.
    const setCategoryRegionNode = useCallback(
        (node: HTMLDivElement | null) => {
            categoryRegionRef.current = node;
            if (!node) return;
            if (isCategoryRegionVisible) {
                node.removeAttribute("inert");
            } else {
                node.setAttribute("inert", "");
            }
        },
        [isCategoryRegionVisible],
    );

    useEffect(() => {
        if (!isEngaged) return;
        const handlePointerDown = (event: PointerEvent) => {
            const form = formRef.current;
            if (form && event.target instanceof Node && !form.contains(event.target)) {
                setIsEngaged(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [isEngaged]);

    const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
        if (
            event.key !== "Escape" ||
            event.defaultPrevented ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229
        ) {
            return;
        }
        // Drafts and validation errors keep the block open.
        if (draft.trim() !== "" || categoryError !== null) {
            return;
        }
        const active = document.activeElement;
        if (active && categoryRegionRef.current?.contains(active)) {
            // The focused control is about to become inert; keep focus in the add row.
            inputRef.current?.focus();
        }
        setIsEngaged(false);
    };

    useEffect(() => {
        if (!isSubmitting && shouldRefocusRef.current) {
            shouldRefocusRef.current = false;
            inputRef.current?.focus();
        }
    }, [isSubmitting, draft, inputRef]);

    useEffect(() => {
        if (isNewCategoryVisible && shouldFocusCategoryInputRef.current) {
            shouldFocusCategoryInputRef.current = false;
            categoryInputRef.current?.focus();
        }
    }, [isNewCategoryVisible]);

    const openNewCategoryAndFocusInput = () => {
        if (isInputDisabled) return;
        if (isCategoryInputShown) {
            categoryInputRef.current?.focus();
            return;
        }
        shouldFocusCategoryInputRef.current = true;
        setCategoryError(null);
        setIsNewCategoryOpen(true);
    };

    const handleSelectCategory = (category: string) => {
        if (isInputDisabled) return;
        const resolved = snapToExistingCategory(category, existingCategories);
        if (!resolved) return;
        if (effectiveSelectedCategory === resolved) {
            const isTemporaryChip = !existingCategories.includes(resolved);
            setSelectedCategory("");
            setCategoryError(null);
            if (isTemporaryChip) {
                inputRef.current?.focus();
            }
            return;
        }
        setSelectedCategory(resolved);
        setCategoryDraft("");
        setCategoryError(null);
        setIsNewCategoryOpen(false);
        inputRef.current?.focus();
    };

    const handleClearCategory = () => {
        if (isInputDisabled) return;
        setSelectedCategory("");
        setCategoryDraft("");
        setCategoryError(null);
        setIsNewCategoryOpen(false);
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
        setIsNewCategoryOpen(false);
        inputRef.current?.focus();
    };

    const handleCategoryInputKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
        }
        if (!hasExistingCategories) {
            if (event.key === "Enter") {
                event.preventDefault();
                const checkedCategory =
                    validateRequiredTodoCategory(categoryDraft);
                if (!checkedCategory.ok) {
                    setCategoryError(
                        getRequiredCategoryErrorMessage(checkedCategory.reason),
                    );
                    categoryInputRef.current?.focus();
                    return;
                }
                setCategoryError(null);
                if (validateTodoText(draft).ok) {
                    formRef.current?.requestSubmit();
                } else {
                    inputRef.current?.focus();
                }
            }
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
            setIsNewCategoryOpen(false);
            newCategoryToggleRef.current?.focus();
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submittingRef.current || isSubmitting) {
            return;
        }
        const checked = validateTodoText(draft);
        if (!checked.ok) {
            return;
        }

        const rawCategory = !hasExistingCategories
            ? categoryDraft
            : isNewCategoryVisible && hasDraftInput
              ? categoryDraft
              : effectiveSelectedCategory;

        if (!rawCategory.trim()) {
            if (isCategoryInputShown) {
                setCategoryError(getRequiredCategoryErrorMessage("required"));
            }
            openNewCategoryAndFocusInput();
            return;
        }

        const checkedCategory = validateRequiredTodoCategory(rawCategory);
        if (!checkedCategory.ok) {
            setCategoryError(
                getRequiredCategoryErrorMessage(checkedCategory.reason),
            );
            if (isCategoryInputShown) {
                categoryInputRef.current?.focus();
            } else {
                shouldFocusCategoryInputRef.current = true;
                setIsNewCategoryOpen(true);
            }
            return;
        }

        const resolvedCategory = snapToExistingCategory(
            checkedCategory.category,
            existingCategories,
        );
        if (!resolvedCategory) {
            openNewCategoryAndFocusInput();
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
                setIsNewCategoryOpen(false);
            }
        } finally {
            submittingRef.current = false;
        }
    };

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            onFocus={() => setIsEngaged(true)}
            onBlur={(event) => {
                const next = event.relatedTarget;
                if (next instanceof Node && !event.currentTarget.contains(next)) {
                    setIsEngaged(false);
                }
            }}
            onPointerDown={() => setIsEngaged(true)}
            onKeyDown={handleFormKeyDown}
            className="border-b border-border bg-background/55 p-2.5 min-[360px]:p-3"
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
                    aria-controls={categoryRegionId}
                    aria-describedby={describedByIds}
                    placeholder="新增待辦…"
                    onChange={(event) => {
                        const sanitized = sanitizeTodoLineBreaks(
                            event.target.value,
                        ).slice(0, TODO_TEXT_MAX_LENGTH);
                        setDraft(sanitized);
                    }}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base text-text-main placeholder:text-text-main/45 transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:bg-background disabled:text-text-main/50 min-[360px]:px-3.5 forest:placeholder:text-text-main/50 motion-reduce:transition-none"
                />

                <button
                    type="submit"
                    disabled={isNativeButtonDisabled}
                    aria-disabled={isMissingCategorySubmit ? "true" : undefined}
                    aria-describedby={describedByIds}
                    className={cn(
                        "inline-flex min-h-11 min-w-12 shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface min-[360px]:px-3.5 min-[360px]:text-sm motion-reduce:transition-none",
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
                                className="size-4 shrink-0"
                            />
                            <span>新增</span>
                        </>
                    )}
                </button>
            </div>

            <div
                ref={setCategoryRegionNode}
                id={categoryRegionId}
                data-slot="todo-category-region"
                data-open={isCategoryRegionVisible ? "true" : "false"}
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none",
                    isCategoryRegionVisible
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                )}
            >
                <div className="-mx-1 min-h-0 overflow-hidden px-1">
            {hasExistingCategories ? (
                <div
                    className={cn(
                        hasCategory
                            ? "mt-2"
                            : "mt-2.5 rounded-xl border-[1.5px] border-dashed border-accent bg-orange-50 px-2.5 pt-2 pb-2 forest:bg-accent/15",
                    )}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span
                            id={categoryGroupLabelId}
                            className="inline-flex items-center gap-1.5 text-xs leading-4 font-bold text-text-main"
                        >
                            <span>分類</span>
                            <span
                                className={cn(
                                    "rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-semibold",
                                    hasCategory
                                        ? "border-border bg-surface text-text-main/62 forest:text-text-main/72"
                                        : "border-accent/35 bg-orange-100/80 text-orange-900 forest:bg-accent/25 forest:text-orange-100",
                                )}
                            >
                                必填
                            </span>
                        </span>

                        {hasCategory ? (
                            <button
                                type="button"
                                disabled={isInputDisabled}
                                aria-label={`清除分類「${effectiveSelectedCategory}」`}
                                onClick={handleClearCategory}
                                className="inline-flex min-h-11 -my-3 -mr-1.5 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold whitespace-nowrap text-text-main/62 transition-colors hover:bg-surface hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45 forest:text-text-main/72 ocean:text-text-main/68 motion-reduce:transition-none"
                            >
                                <X aria-hidden="true" className="size-3.5" />
                                <span>清除分類</span>
                            </button>
                        ) : (
                            <span className="shrink-0 rounded-md border border-accent/35 bg-orange-100 px-1.5 py-0.5 text-[11px] leading-4 font-semibold text-orange-900 forest:bg-accent/25 forest:text-orange-100">
                                尚未選擇
                            </span>
                        )}
                    </div>

                    <div
                        role="group"
                        aria-labelledby={categoryGroupLabelId}
                        className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0"
                    >
                        {displayedCategories.map((category) => {
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
                                    className="group inline-flex min-h-11 max-w-full shrink-0 items-center py-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <span
                                        className={cn(
                                            "inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border px-3 py-1 text-[13px] leading-[18px] whitespace-nowrap transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary motion-reduce:transition-none",
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
                                        <span className="min-w-0 truncate">
                                            {category}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}

                        <button
                            ref={newCategoryToggleRef}
                            type="button"
                            disabled={isInputDisabled}
                            aria-expanded={isNewCategoryVisible}
                            aria-controls={newCategoryPanelId}
                            onClick={() => {
                                if (isInputDisabled) return;
                                setCategoryError(null);
                                if (isNewCategoryVisible) {
                                    setCategoryDraft("");
                                    setIsNewCategoryOpen(false);
                                    return;
                                }
                                shouldFocusCategoryInputRef.current = true;
                                setIsNewCategoryOpen(true);
                            }}
                            className="group inline-flex min-h-11 max-w-full shrink-0 items-center py-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <span
                                className={cn(
                                    "inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border px-3 py-1 text-[13px] leading-[18px] font-semibold whitespace-nowrap text-text-main transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary motion-reduce:transition-none",
                                    isNewCategoryVisible
                                        ? "border-solid border-primary bg-primary/12 forest:bg-primary/22"
                                        : "border-dashed border-primary/70 bg-surface hover:bg-background",
                                )}
                            >
                                <Plus
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0"
                                />
                                <span>新增分類</span>
                            </span>
                        </button>
                    </div>

                    {isNewCategoryVisible && (
                        <div
                            id={newCategoryPanelId}
                            className="mt-1.5 rounded-xl border border-primary/25 bg-surface p-2"
                        >
                            <div className="flex items-center gap-1.5">
                                <input
                                    ref={categoryInputRef}
                                    id={categoryInputId}
                                    type="text"
                                    autoComplete="off"
                                    value={categoryDraft}
                                    disabled={isInputDisabled}
                                    aria-label="輸入新分類名稱"
                                    aria-invalid={
                                        categoryError ? "true" : undefined
                                    }
                                    aria-describedby={
                                        categoryError
                                            ? categoryErrorId
                                            : categoryNoteId
                                    }
                                    placeholder="輸入新分類（例如：交通）"
                                    onChange={(event) => {
                                        const sanitized =
                                            truncateUnicodeCodePoints(
                                                sanitizeTodoLineBreaks(
                                                    event.target.value,
                                                ),
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
                                            : "border-primary/60 focus-visible:border-primary focus-visible:ring-primary/25",
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
                                    <span>
                                        {isExistingDraftMatch ? "選用" : "建立"}
                                    </span>
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

                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                <p
                                    id={categoryNoteId}
                                    className="text-[11px] leading-4 text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68"
                                >
                                    大小寫相同會自動對應既有分類；不可使用「
                                    {UNCATEGORIZED_LABEL}」。
                                </p>
                                {categoryCounter && (
                                    <span
                                        aria-live="polite"
                                        className={cn(
                                            "shrink-0 text-[11px] font-semibold tabular-nums",
                                            categoryCounter.level === "limit"
                                                ? "text-red-700 forest:text-red-200"
                                                : categoryCounter.level ===
                                                    "warn"
                                                  ? "text-accent"
                                                  : "text-text-main/62 forest:text-text-main/72",
                                        )}
                                    >
                                        {categoryCounter.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {!hasCategory && (
                        <p
                            id={categoryHintId}
                            className="mt-1.5 flex items-center gap-1.5 text-xs leading-4 font-semibold text-orange-900 forest:text-orange-200"
                        >
                            <CircleAlert
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-accent"
                            />
                            <span>新增前請先選擇或建立分類</span>
                        </p>
                    )}
                </div>
            ) : (
                <div className="mt-2.5 rounded-xl border-[1.5px] border-primary/40 bg-surface p-2.5 shadow-2xs">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <label
                            htmlFor={categoryInputId}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-text-main"
                        >
                            <span>建立第一個分類</span>
                            <span className="rounded-md border border-accent/35 bg-orange-50 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-orange-900 forest:bg-accent/20 forest:text-orange-100">
                                必填
                            </span>
                        </label>
                        <span
                            aria-live="polite"
                            className={cn(
                                "shrink-0 text-[11px] font-semibold tabular-nums",
                                categoryCounter?.level === "limit"
                                    ? "text-red-700 forest:text-red-200"
                                    : categoryCounter?.level === "warn"
                                      ? "text-accent"
                                      : "text-text-main/62 forest:text-text-main/72",
                            )}
                        >
                            {categoryCounter?.label ??
                                `${categoryCodePoints} / ${TODO_CATEGORY_MAX_LENGTH}`}
                        </span>
                    </div>

                    <input
                        ref={categoryInputRef}
                        id={categoryInputId}
                        type="text"
                        autoComplete="off"
                        value={categoryDraft}
                        disabled={isInputDisabled}
                        aria-invalid={categoryError ? "true" : undefined}
                        aria-describedby={
                            categoryError
                                ? `${categoryErrorId} ${categoryHintId}`
                                : categoryHintId
                        }
                        placeholder="例如：行李"
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
                            "min-h-11 w-full min-w-0 rounded-[10px] border-[1.5px] bg-surface px-3 text-base text-text-main placeholder:text-text-main/45 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-background disabled:text-text-main/50 forest:placeholder:text-text-main/50 motion-reduce:transition-none",
                            categoryError
                                ? "border-red-600 focus-visible:border-red-600 focus-visible:ring-red-600/20 forest:border-red-400"
                                : "border-primary/70 focus-visible:border-primary focus-visible:ring-primary/20",
                        )}
                    />

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

                    <p
                        id={categoryHintId}
                        className="mt-2 text-xs leading-[17px] text-text-main/62 forest:text-text-main/72 ocean:text-text-main/68"
                    >
                        首次使用請先輸入分類名稱，新增後會顯示為快捷分類；不可使用「
                        {UNCATEGORIZED_LABEL}」。
                    </p>
                </div>
            )}
                </div>
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
