export type PackingCategory =
    | "documents"
    | "clothing"
    | "cycling"
    | "toiletries"
    | "electronics"
    | "other";

export interface PackingItem {
    id: string;
    label: string;
    category: PackingCategory;
    weightGrams: number;
    priority: "required" | "recommended" | "optional";
    packed: boolean;
    custom?: boolean;
    note?: string;
}

export const PACKING_CATEGORY_LABEL: Record<PackingCategory, string> = {
    documents: "證件與金流",
    clothing: "衣物",
    cycling: "騎行與天候",
    toiletries: "盥洗與健康",
    electronics: "電子用品",
    other: "其他",
};

export const SHIMANAMI_PACKING_ITEMS: readonly PackingItem[] = [
    {
        id: "passport",
        label: "護照",
        category: "documents",
        weightGrams: 40,
        priority: "required",
        packed: false,
        note: "另存護照資料頁電子備份",
    },
    {
        id: "wallet",
        label: "錢包、信用卡與少量日圓",
        category: "documents",
        weightGrams: 180,
        priority: "required",
        packed: false,
    },
    {
        id: "travel-documents",
        label: "機票、住宿與租車資料",
        category: "documents",
        weightGrams: 0,
        priority: "required",
        packed: false,
        note: "建議存入手機並開放離線查看",
    },
    {
        id: "insurance",
        label: "旅遊保險與緊急聯絡資料",
        category: "documents",
        weightGrams: 0,
        priority: "recommended",
        packed: false,
    },
    {
        id: "backpack",
        label: "40L 後背包",
        category: "other",
        weightGrams: 1200,
        priority: "required",
        packed: false,
        note: "請依實重調整；裝妥後須符合 54×38×23cm",
    },
    {
        id: "packing-cubes",
        label: "輕量收納袋／壓縮袋",
        category: "other",
        weightGrams: 150,
        priority: "recommended",
        packed: false,
    },
    {
        id: "tops",
        label: "快乾上衣 × 3",
        category: "clothing",
        weightGrams: 450,
        priority: "required",
        packed: false,
    },
    {
        id: "bottoms",
        label: "快乾短褲／長褲 × 2",
        category: "clothing",
        weightGrams: 500,
        priority: "required",
        packed: false,
    },
    {
        id: "underwear",
        label: "內著與襪子各 4 套",
        category: "clothing",
        weightGrams: 400,
        priority: "required",
        packed: false,
        note: "旅途中清洗，避免帶滿 8 天份",
    },
    {
        id: "sleepwear",
        label: "輕量睡衣",
        category: "clothing",
        weightGrams: 250,
        priority: "recommended",
        packed: false,
    },
    {
        id: "light-layer",
        label: "薄外套／防風層",
        category: "clothing",
        weightGrams: 280,
        priority: "recommended",
        packed: false,
    },
    {
        id: "rain-jacket",
        label: "透氣雨衣",
        category: "cycling",
        weightGrams: 280,
        priority: "required",
        packed: false,
        note: "島波海道騎行期間不建議以雨傘取代",
    },
    {
        id: "dry-bags",
        label: "防水袋／夾鏈袋",
        category: "cycling",
        weightGrams: 100,
        priority: "required",
        packed: false,
        note: "保護護照、手機與充電用品",
    },
    {
        id: "sun-protection",
        label: "太陽眼鏡、帽套與防曬",
        category: "cycling",
        weightGrams: 220,
        priority: "required",
        packed: false,
    },
    {
        id: "bottle",
        label: "水壺（空瓶）",
        category: "cycling",
        weightGrams: 120,
        priority: "required",
        packed: false,
    },
    {
        id: "toiletry-kit",
        label: "旅行分裝盥洗包",
        category: "toiletries",
        weightGrams: 350,
        priority: "required",
        packed: false,
        note: "液體單瓶不超過 100ml",
    },
    {
        id: "medicine",
        label: "個人藥品、止痛與腸胃藥",
        category: "toiletries",
        weightGrams: 150,
        priority: "required",
        packed: false,
    },
    {
        id: "towel",
        label: "快乾小毛巾",
        category: "toiletries",
        weightGrams: 100,
        priority: "recommended",
        packed: false,
    },
    {
        id: "phone",
        label: "手機",
        category: "electronics",
        weightGrams: 200,
        priority: "required",
        packed: false,
    },
    {
        id: "power-bank",
        label: "行動電源",
        category: "electronics",
        weightGrams: 220,
        priority: "required",
        packed: false,
        note: "須隨身登機、不可託運；虎航機上禁止使用",
    },
    {
        id: "compact-charger",
        label: "GaN 充電器與充電線",
        category: "electronics",
        weightGrams: 220,
        priority: "required",
        packed: false,
        note: "用一組多孔充電器取代多顆充電頭",
    },
    {
        id: "earbuds",
        label: "耳機",
        category: "electronics",
        weightGrams: 60,
        priority: "recommended",
        packed: false,
    },
    {
        id: "macbook",
        label: "MacBook Pro 14 吋（2024）",
        category: "electronics",
        weightGrams: 1600,
        priority: "optional",
        packed: false,
        note: "依機型約 1.55–1.62kg；不含充電器",
    },
];

export function createDefaultPackingItems(): PackingItem[] {
    return SHIMANAMI_PACKING_ITEMS.map((item) => ({ ...item }));
}
