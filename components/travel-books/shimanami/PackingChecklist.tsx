"use client";

import * as React from "react";
import {
    Check,
    Laptop,
    PackageCheck,
    Plus,
    RotateCcw,
    Scale,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    createDefaultPackingItems,
    PACKING_CATEGORY_LABEL,
    type PackingCategory,
    type PackingItem,
} from "@/src/travel/packing";

const STORAGE_VERSION = 1;
const WEIGHT_LIMIT_GRAMS = 10000;
const CATEGORY_ORDER = Object.keys(PACKING_CATEGORY_LABEL) as PackingCategory[];

interface StoredPackingList {
    version: number;
    items: PackingItem[];
}

function formatWeight(grams: number) {
    if (grams === 0) return "未計重";
    if (grams < 1000) return `${grams}g`;
    return `${(grams / 1000).toFixed(2).replace(/0$/, "")}kg`;
}

function isStoredPackingList(value: unknown): value is StoredPackingList {
    if (!value || typeof value !== "object") return false;
    const stored = value as StoredPackingList;
    return (
        stored.version === STORAGE_VERSION &&
        Array.isArray(stored.items) &&
        stored.items.every(
            (item) =>
                typeof item?.id === "string" &&
                typeof item?.label === "string" &&
                typeof item?.weightGrams === "number" &&
                typeof item?.packed === "boolean",
        )
    );
}

export function PackingChecklist({ storageKey }: { storageKey: string }) {
    const [items, setItems] = React.useState<PackingItem[]>(createDefaultPackingItems);
    const [hydrated, setHydrated] = React.useState(false);
    const [newLabel, setNewLabel] = React.useState("");
    const [newWeight, setNewWeight] = React.useState("");
    const [newCategory, setNewCategory] = React.useState<PackingCategory>("other");

    React.useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
            if (isStoredPackingList(saved)) setItems(saved.items);
        } catch {
            // Keep the recommended list when saved data is unavailable or malformed.
        } finally {
            setHydrated(true);
        }
    }, [storageKey]);

    React.useEffect(() => {
        if (!hydrated) return;
        const value: StoredPackingList = { version: STORAGE_VERSION, items };
        localStorage.setItem(storageKey, JSON.stringify(value));
    }, [hydrated, items, storageKey]);

    const totalWeight = items.reduce((sum, item) => sum + item.weightGrams, 0);
    const packedCount = items.filter((item) => item.packed).length;
    const requiredRemaining = items.filter(
        (item) => item.priority === "required" && !item.packed,
    ).length;
    const weightPercent = Math.min((totalWeight / WEIGHT_LIMIT_GRAMS) * 100, 100);
    const overweight = totalWeight > WEIGHT_LIMIT_GRAMS;
    const hasMacBook = items.some((item) => item.id === "macbook");

    const toggleItem = (id: string) => {
        setItems((current) =>
            current.map((item) =>
                item.id === id ? { ...item, packed: !item.packed } : item,
            ),
        );
    };

    const removeItem = (id: string) => {
        setItems((current) => current.filter((item) => item.id !== id));
    };

    const addItem = (event: React.FormEvent) => {
        event.preventDefault();
        const label = newLabel.trim();
        if (!label) return;

        const parsedWeight = Number(newWeight);
        const weightGrams = Number.isFinite(parsedWeight)
            ? Math.max(0, Math.round(parsedWeight))
            : 0;

        setItems((current) => [
            ...current,
            {
                id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                label,
                category: newCategory,
                weightGrams,
                priority: "optional",
                packed: false,
                custom: true,
            },
        ]);
        setNewLabel("");
        setNewWeight("");
    };

    const resetItems = () => {
        if (window.confirm("要恢復推薦清單嗎？目前的自訂項目與勾選狀態會被清除。")) {
            setItems(createDefaultPackingItems());
        }
    };

    return (
        <section className="overflow-hidden bg-white shadow-[0_12px_32px_rgba(19,50,59,0.06)]">
            <header className="flex min-h-16 items-center gap-3 p-4">
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#17323b] text-[#f2c94c]">
                        <PackageCheck className="size-5" />
                    </span>
                    <span className="min-w-0">
                        <span className="block font-extrabold text-[#17323b]">
                            40L／10kg 背包清單
                        </span>
                        <span className="mt-0.5 block text-xs font-medium text-[#607983]">
                            已打包 {packedCount}/{items.length}
                            {requiredRemaining > 0 && ` · 必須項目尚缺 ${requiredRemaining}`}
                        </span>
                    </span>
                </span>
            </header>

            <div className="border-t border-[#e2ebed]">
                <div className="bg-[#17323b] p-4 text-white">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#a9c7d0]">
                                <Scale className="size-4" />
                                預估總重
                            </p>
                            <p className="mt-1 font-mono text-3xl font-black">
                                {formatWeight(totalWeight)}
                                <span className="ml-1 text-sm text-[#a9c7d0]">/ 10kg</span>
                            </p>
                        </div>
                        <p
                            className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-extrabold",
                                overweight
                                    ? "bg-[#ffded9] text-[#8e352e]"
                                    : "bg-[#dcefe6] text-[#27664c]",
                            )}
                        >
                            {overweight
                                ? `超重 ${formatWeight(totalWeight - WEIGHT_LIMIT_GRAMS)}`
                                : `餘裕 ${formatWeight(WEIGHT_LIMIT_GRAMS - totalWeight)}`}
                        </p>
                    </div>
                    <div
                        className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"
                        aria-label={`預估重量為 7 公斤上限的 ${Math.round(weightPercent)}%`}
                    >
                        <div
                            className={cn(
                                "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
                                overweight ? "bg-[#ef7c6d]" : "bg-[#f2c94c]",
                            )}
                            style={{ width: `${weightPercent}%` }}
                        />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#c6dce2]">
                        台灣虎航允許 1 件手提行李與 1 件個人隨身物品，兩件合計不得超過
                        10kg。重量為行前估算，請以機場實際秤重為準。
                    </p>
                </div>

                {hasMacBook && (
                    <div className="flex gap-3 border-b border-[#e2ebed] bg-[#fff8df] p-4 text-sm leading-5 text-[#6f5708]">
                        <Laptop className="mt-0.5 size-5 shrink-0" />
                        <p>
                            <strong>MBP 約占上限 16%。</strong>
                            若旅途中沒有明確工作需求，改帶手機可保留約 1.6kg 給衣物、雨具與騎行裝備。
                        </p>
                    </div>
                )}

                <div className="space-y-5 p-3 sm:p-4">
                    {CATEGORY_ORDER.map((category) => {
                        const categoryItems = items.filter(
                            (item) => item.category === category,
                        );
                        if (categoryItems.length === 0) return null;

                        return (
                            <section key={category} aria-labelledby={`packing-${category}`}>
                                <h3
                                    id={`packing-${category}`}
                                    className="px-2 font-mono text-[11px] font-bold tracking-[0.14em] text-[#126b8a]"
                                >
                                    {PACKING_CATEGORY_LABEL[category]}
                                </h3>
                                <div className="mt-1 space-y-1">
                                    {categoryItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className="group/item flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-[#f2f7f8]"
                                        >
                                            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    aria-label={item.label}
                                                    checked={item.packed}
                                                    onChange={() => toggleItem(item.id)}
                                                    className="sr-only"
                                                />
                                                <span
                                                    className={cn(
                                                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                                                        item.packed
                                                            ? "border-[#126b8a] bg-[#126b8a] text-white"
                                                            : "border-[#9cb9c2] bg-white",
                                                    )}
                                                >
                                                    {item.packed && (
                                                        <Check className="size-4" strokeWidth={3} />
                                                    )}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                "text-sm font-semibold text-[#294852]",
                                                                item.packed &&
                                                                    "text-[#7c9096] line-through",
                                                            )}
                                                        >
                                                            {item.label}
                                                        </span>
                                                        {item.priority === "required" && (
                                                            <span className="rounded-full bg-[#17323b] px-2 py-0.5 text-[9px] font-bold text-white">
                                                                必須
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="mt-0.5 block text-[11px] leading-4 text-[#789098]">
                                                        {formatWeight(item.weightGrams)}
                                                        {item.note && ` · ${item.note}`}
                                                    </span>
                                                </span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                                aria-label={`刪除 ${item.label}`}
                                                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#789098] hover:bg-[#ffe5e1] hover:text-[#9b3f36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126b8a]"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}

                    {items.length === 0 && (
                        <p className="rounded-xl bg-[#f2f7f8] p-4 text-center text-sm text-[#607983]">
                            清單目前是空的，請新增項目或恢復推薦清單。
                        </p>
                    )}
                </div>

                <form
                    onSubmit={addItem}
                    className="border-t border-[#e2ebed] bg-[#f7faf8] p-4"
                >
                    <p className="text-sm font-extrabold text-[#17323b]">新增自己的項目</p>
                    <div className="mt-3 grid grid-cols-[1fr_92px] gap-2">
                        <label className="sr-only" htmlFor="packing-item-name">
                            項目名稱
                        </label>
                        <input
                            id="packing-item-name"
                            value={newLabel}
                            onChange={(event) => setNewLabel(event.target.value)}
                            placeholder="例如：拖鞋"
                            className="h-11 min-w-0 rounded-xl border border-[#b8d1d8] bg-white px-3 text-sm text-[#17323b] outline-none placeholder:text-[#91a3a8] focus:border-[#126b8a] focus:ring-2 focus:ring-[#126b8a]/20"
                        />
                        <label className="sr-only" htmlFor="packing-item-weight">
                            重量（克）
                        </label>
                        <input
                            id="packing-item-weight"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={newWeight}
                            onChange={(event) => setNewWeight(event.target.value)}
                            placeholder="重量 g"
                            className="h-11 rounded-xl border border-[#b8d1d8] bg-white px-3 text-sm text-[#17323b] outline-none placeholder:text-[#91a3a8] focus:border-[#126b8a] focus:ring-2 focus:ring-[#126b8a]/20"
                        />
                    </div>
                    <div className="mt-2 flex gap-2">
                        <label className="sr-only" htmlFor="packing-item-category">
                            分類
                        </label>
                        <select
                            id="packing-item-category"
                            value={newCategory}
                            onChange={(event) =>
                                setNewCategory(event.target.value as PackingCategory)
                            }
                            className="h-11 min-w-0 flex-1 rounded-xl border border-[#b8d1d8] bg-white px-3 text-sm font-medium text-[#294852] outline-none focus:border-[#126b8a] focus:ring-2 focus:ring-[#126b8a]/20"
                        >
                            {CATEGORY_ORDER.map((category) => (
                                <option key={category} value={category}>
                                    {PACKING_CATEGORY_LABEL[category]}
                                </option>
                            ))}
                        </select>
                        <Button
                            type="submit"
                            disabled={!newLabel.trim()}
                            className="h-11 rounded-xl bg-[#126b8a] px-4 font-bold text-white hover:bg-[#0e5973]"
                        >
                            <Plus className="size-4" />
                            新增
                        </Button>
                    </div>
                </form>

                <div className="flex justify-end border-t border-[#e2ebed] px-4 py-3">
                    <button
                        type="button"
                        onClick={resetItems}
                        className="flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-bold text-[#607983] hover:bg-[#f2f7f8] hover:text-[#17323b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126b8a]"
                    >
                        <RotateCcw className="size-3.5" />
                        恢復推薦清單
                    </button>
                </div>
            </div>
        </section>
    );
}
