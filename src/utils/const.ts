export const TWD_CURRENCY = { TWD: 1 };

export interface ChecklistItem {
    text: string;
    users?: string[];
}

export interface ChecklistCategory {
    category: string;
    items: ChecklistItem[];
}

export const TRAVEL_CHECKLIST: ChecklistCategory[] = [
    {
        category: "衣物",
        items: [
            { text: "內褲x5" },
            { text: "發熱衣x3" },
            { text: "內搭褲(睡褲)x2" },
            { text: "襪子x2" },
            { text: "厚棉Tx2" },
            { text: "毛衣x1" },
            { text: "短袖x2" },
            { text: "長褲x1" },
            { text: "輕羽絨" },
            { text: "洗衣袋" },
            { text: "輕便衣架x5" },
            { text: "拖鞋" },
            { text: "裝髒衣物袋子" },
        ],
    },
    {
        category: "雪具",
        items: [
            { text: "雪衣" },
            { text: "雪褲" },
            { text: "內層x2" },
            { text: "手套" },
            { text: "Goggle" },
            { text: "防摔褲" },
            { text: "護腕" },
            { text: "脖圍" },
            { text: "雪襪x2" },
        ],
    },
    {
        category: "必帶",
        items: [
            { text: "護照" },
            { text: "身分證" },
            { text: "信用卡" },
            { text: "網卡" },
        ],
    },
    {
        category: "隨身",
        items: [
            { text: "牙線棒" },
            { text: "抽取衛生紙" },
            { text: "頸枕" },
            { text: "保溫水壺" },
        ],
    },
    {
        category: "個人用品",
        items: [
            { text: "刮鬍刀" },
            { text: "指甲刀" },
            { text: "電動牙刷" },
            { text: "棉花棒" },
            { text: "牙膏" },
            { text: "髮蠟" },
            { text: "毛巾（速乾）" },
            { text: "洗面乳" },
            { text: "沐浴乳洗髮乳" },
            { text: "隱形眼鏡x8" },
            { text: "眼鏡盒" },
            { text: "耳環" },
            { text: "雨傘" },
            { text: "衛生紙" },
            { text: "墨鏡" },
            { text: "酸痛貼布" },
            { text: "肌肉鬆弛劑" },
        ],
    },
    {
        category: "藥品",
        items: [
            { text: "口罩" },
            { text: "感冒藥" },
            { text: "頭痛藥" },
            { text: "胃藥" },
            { text: "OK蹦" },
            { text: "乳液" },
            { text: "眼藥水" },
            { text: "護唇膏" },
        ],
    },
    {
        category: "3C",
        items: [
            { text: "耳機" },
            { text: "底片相機" },
            { text: "底片" },
            { text: "4號電池" },
            { text: "腳架" },
            { text: "行動電源" },
            { text: "行動電源充電線" },
            { text: "充電線 lighting" },
        ],
    },
];