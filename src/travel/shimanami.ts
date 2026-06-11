import { SHIMANAMI_TRAVEL_BOOK } from "./registry";

export type ShimanamiEventType =
    | "transport"
    | "activity"
    | "food"
    | "lodging"
    | "cycling"
    | "task"
    | "reminder";

export type ShimanamiStatus =
    | "confirmed"
    | "to-confirm"
    | "cancelled"
    | "informational";

export interface ShimanamiLink {
    label: string;
    url: string;
    kind: "map" | "official";
}

export interface ShimanamiEvent {
    id: string;
    time: string;
    title: string;
    type: ShimanamiEventType;
    location?: string;
    description?: string;
    priority?: "required" | "recommended" | "optional";
    status?: ShimanamiStatus;
    links?: ShimanamiLink[];
    warning?: string;
}

export interface ShimanamiDay {
    id: string;
    date: string;
    dayLabel: string;
    weekday: string;
    city: string;
    theme: string;
    cycling?: {
        label: string;
        route: string;
        distance: string;
        rideWindow: string;
        progress: number;
        startLabel: string;
        endLabel: string;
    };
    note?: string;
    events: ShimanamiEvent[];
    contingencies?: string[];
}

export interface ShimanamiTrip {
    title: string;
    year: string;
    heroTitle: string;
    heroAccent: string;
    routeSummary: string;
    timezone: string;
    timezoneLabel: string;
    startDate: string;
    endDate: string;
    sourceUrl: string;
    preparationTitle: string;
    preparationVisibleThroughDay: number;
    days: ShimanamiDay[];
}

const map = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const SHIMANAMI_TRIP = {
    title: "瀨戶內・島波海道",
    year: "2026",
    heroTitle: "瀨戶內",
    heroAccent: "島波海道",
    routeSummary: "岡山 → 尾道 → 今治 → 松山",
    timezone: "Asia/Tokyo",
    timezoneLabel: "JST · 日本時間",
    startDate: "2026-06-25",
    endDate: "2026-07-02",
    sourceUrl:
        `https://docs.google.com/document/d/${SHIMANAMI_TRAVEL_BOOK.sourceDocumentIds[0]}/edit?usp=drivesdk`,
    preparationTitle: "騎行準備",
    preparationVisibleThroughDay: 3,
    days: [
        {
            id: "day-1",
            date: "2026-06-25",
            dayLabel: "D1",
            weekday: "週四",
            city: "岡山",
            theme: "抵達、換氣，先把旅程安頓好",
            note: "第一天不塞景點。保留入境與交通延誤的空間。",
            events: [
                {
                    id: "d1-flight",
                    time: "抵達後",
                    title: "抵達岡山機場",
                    type: "transport",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山桃太郎機場",
                    description: "完成入境後先確認利木津巴士班次與乘車處。",
                    warning: "機場巴士時刻可能調整，出發前請重新確認。",
                    links: [
                        { label: "開啟地圖", url: map("岡山桃太郎機場"), kind: "map" },
                        {
                            label: "機場交通",
                            url: "https://www.okayama-airport.org/tw/access/bus",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d1-bus",
                    time: "傍晚",
                    title: "機場巴士 → 岡山站",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "抵達車站後步行前往住宿，晚餐以車站周邊為主。",
                },
                {
                    id: "d1-hotel",
                    time: "晚上",
                    title: "岡山站周邊住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山站",
                    links: [{ label: "開啟地圖", url: map("岡山站"), kind: "map" }],
                },
            ],
        },
        {
            id: "day-2",
            date: "2026-06-26",
            dayLabel: "D2",
            weekday: "週五",
            city: "倉敷",
            theme: "沿著白壁與運河，慢慢走一日",
            note: "以美觀地區為核心。若下雨，縮短戶外散步並增加室內停留。",
            events: [
                {
                    id: "d2-train",
                    time: "09:00 前後",
                    title: "岡山 → 倉敷",
                    type: "transport",
                    priority: "required",
                    status: "informational",
                    description: "搭乘 JR，抵達後步行進入美觀地區。",
                    links: [{ label: "開啟地圖", url: map("倉敷站"), kind: "map" }],
                },
                {
                    id: "d2-bikan",
                    time: "上午",
                    title: "倉敷美觀地區",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "倉敷川沿岸",
                    links: [
                        { label: "開啟地圖", url: map("倉敷美觀地區"), kind: "map" },
                    ],
                },
                {
                    id: "d2-museum",
                    time: "下午",
                    title: "大原美術館",
                    type: "activity",
                    priority: "recommended",
                    status: "to-confirm",
                    description: "視開館資訊與現場步調決定停留時間。",
                    links: [
                        { label: "開啟地圖", url: map("大原美術館"), kind: "map" },
                        {
                            label: "官方網站",
                            url: "https://www.ohara.or.jp/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d2-return",
                    time: "傍晚",
                    title: "返回岡山",
                    type: "transport",
                    priority: "required",
                    status: "informational",
                },
            ],
            contingencies: [
                "雨勢大時，以大原美術館與室內商店為主，取消長距離街區散步。",
                "體力不足時提早返回岡山，保留隔日移動與單車準備的精神。",
            ],
        },
        {
            id: "day-3",
            date: "2026-06-27",
            dayLabel: "D3",
            weekday: "週六",
            city: "尾道",
            theme: "把大行李送走，把單車旅程準備好",
            note: "今日的核心是行李轉送、租車確認與裝備補給，不追求景點數量。",
            events: [
                {
                    id: "d3-train",
                    time: "上午",
                    title: "岡山 → 尾道",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "預留轉車與找寄送櫃台的時間。",
                    links: [{ label: "開啟地圖", url: map("尾道站"), kind: "map" }],
                },
                {
                    id: "d3-luggage",
                    time: "抵達後",
                    title: "辦理大行李轉送",
                    type: "task",
                    priority: "required",
                    status: "to-confirm",
                    description: "確認送達今治或道後住宿的日期；三日騎行只帶隨身裝備。",
                },
                {
                    id: "d3-bike",
                    time: "下午",
                    title: "確認租車與還車條件",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    location: "尾道港周邊租車點",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("尾道港 單車租借"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-supplies",
                    time: "傍晚前",
                    title: "補齊三日騎行裝備",
                    type: "reminder",
                    priority: "required",
                    status: "informational",
                    description: "雨具、防曬、水、行動電源、簡單補給與隔日早餐。",
                    warning: "今晚完成補給，避免隔天臨時找店延後出發。",
                },
                {
                    id: "d3-walk",
                    time: "有餘裕",
                    title: "尾道本通與海岸散步",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    links: [{ label: "開啟地圖", url: map("尾道本通商店街"), kind: "map" }],
                },
            ],
        },
        {
            id: "day-4",
            date: "2026-06-28",
            dayLabel: "D4",
            weekday: "週日",
            city: "尾道 → 瀨戶田",
            theme: "第一段藍線：跨過向島與因島",
            cycling: {
                label: "SHIMANAMI RIDE",
                route: "尾道 → 向島 → 因島 → 生口島・瀨戶田",
                distance: "約 35–40 km",
                rideWindow: "08:00 出發 · 16:00 前抵達",
                progress: 34,
                startLabel: "尾道",
                endLabel: "今治",
            },
            note: "第一天刻意保守配速，熟悉車況、橋面風勢與補水節奏。",
            events: [
                {
                    id: "d4-ferry",
                    time: "08:00",
                    title: "尾道渡船 → 向島",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "過海後沿路面藍線開始騎行。",
                    links: [{ label: "開啟地圖", url: map("尾道渡船 向島"), kind: "map" }],
                },
                {
                    id: "d4-ride",
                    time: "上午至下午",
                    title: "向島、因島、生口島",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    description: "每座橋前都有爬升，過橋後主動補水，不等口渴。",
                    warning: "16:00 前結束騎行，不因趕行程進入夜騎。",
                },
                {
                    id: "d4-temple",
                    time: "體力許可",
                    title: "耕三寺或島上短停",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    description: "只在抵達時間充足時安排，不壓縮安全緩衝。",
                    links: [{ label: "開啟地圖", url: map("耕三寺"), kind: "map" }],
                },
                {
                    id: "d4-hotel",
                    time: "16:00 前",
                    title: "瀨戶田住宿 Check-in",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    links: [{ label: "開啟地圖", url: map("瀨戶田港"), kind: "map" }],
                },
            ],
            contingencies: [
                "雨勢或強風不適合騎乘時，先向租車與住宿方確認取消、延後或替代交通。",
                "體力落後時取消所有支線，沿主線直接前往瀨戶田。",
                "若已無法在天黑前抵達，停止騎行並尋找渡船或計程車等安全替代。",
            ],
        },
        {
            id: "day-5",
            date: "2026-06-29",
            dayLabel: "D5",
            weekday: "週一",
            city: "瀨戶田 → 伯方島",
            theme: "島與橋的正中央，留力比里程重要",
            cycling: {
                label: "SHIMANAMI RIDE",
                route: "生口島 → 大三島 → 伯方島",
                distance: "約 40–50 km",
                rideWindow: "08:30 出發 · 16:30 前抵達",
                progress: 67,
                startLabel: "尾道",
                endLabel: "今治",
            },
            note: "住宿周邊餐飲與商店有限，離開大三島主要聚落前完成晚餐與補給確認。",
            events: [
                {
                    id: "d5-breakfast",
                    time: "出發前",
                    title: "早餐、飲水與胎壓確認",
                    type: "task",
                    priority: "required",
                    status: "informational",
                },
                {
                    id: "d5-ride",
                    time: "08:30",
                    title: "生口島 → 大三島",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    description: "保持能對話的速度，上午先完成主要里程。",
                    warning: "避免夜騎；下午提早判斷是否取消繞路。",
                },
                {
                    id: "d5-shrine",
                    time: "中午前後",
                    title: "大山祇神社",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    links: [{ label: "開啟地圖", url: map("大山祇神社"), kind: "map" }],
                },
                {
                    id: "d5-detour",
                    time: "體力充足",
                    title: "大三島支線",
                    type: "cycling",
                    priority: "optional",
                    status: "informational",
                    description: "支線會增加里程與爬升。只在天氣穩定且時間領先時考慮。",
                },
                {
                    id: "d5-supplies",
                    time: "15:00 前",
                    title: "購買晚餐、早餐與飲水",
                    type: "task",
                    priority: "required",
                    status: "informational",
                    warning: "伯方島住宿周邊補給有限，抵達前完成採買。",
                },
                {
                    id: "d5-hotel",
                    time: "16:30 前",
                    title: "伯方島住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    links: [{ label: "開啟地圖", url: map("伯方島"), kind: "map" }],
                },
            ],
            contingencies: [
                "疲勞時完全取消大三島支線，沿島波海道主線前進。",
                "雨勢增強時在有商店的聚落先停留，確認後續交通再移動。",
            ],
        },
        {
            id: "day-6",
            date: "2026-06-30",
            dayLabel: "D6",
            weekday: "週二",
            city: "伯方島 → 今治 → 道後",
            theme: "跨過來島海峽，完成藍線",
            cycling: {
                label: "SHIMANAMI RIDE",
                route: "伯方島 → 大島 → 來島海峽大橋 → 今治",
                distance: "約 40–45 km",
                rideWindow: "08:00 出發 · 15:30 前還車",
                progress: 100,
                startLabel: "尾道",
                endLabel: "今治",
            },
            note: "今天有還車與轉乘時限。景點一律讓位給安全抵達今治。",
            events: [
                {
                    id: "d6-start",
                    time: "08:00",
                    title: "伯方島出發",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    description: "預留大島爬坡與來島海峽大橋風勢造成的時間差。",
                    warning: "最後一天也不夜騎；若進度落後，提早啟動替代方案。",
                },
                {
                    id: "d6-bridge",
                    time: "中午前後",
                    title: "來島海峽大橋",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    links: [{ label: "開啟地圖", url: map("來島海峽大橋"), kind: "map" }],
                },
                {
                    id: "d6-return",
                    time: "15:30 前",
                    title: "今治還車",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    location: "今治站周邊",
                    links: [{ label: "開啟地圖", url: map("今治站"), kind: "map" }],
                },
                {
                    id: "d6-transfer",
                    time: "傍晚",
                    title: "今治 → 松山・道後溫泉",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "依實際還車時間選擇 JR 或巴士，保留轉乘緩衝。",
                },
                {
                    id: "d6-dogo",
                    time: "晚上",
                    title: "道後溫泉住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    links: [{ label: "開啟地圖", url: map("道後溫泉"), kind: "map" }],
                },
            ],
            contingencies: [
                "進度明顯落後時，詢問沿線巴士、渡船或提前還車的可行方式。",
                "強風或豪雨時不要勉強通過長橋，先在安全地點聯絡租車方。",
            ],
        },
        {
            id: "day-7",
            date: "2026-07-01",
            dayLabel: "D7",
            weekday: "週三",
            city: "道後・松山 → 岡山",
            theme: "溫泉城收尾，傍晚回到岡山",
            note: "今天必須回到岡山過夜，松山市區行程要服從跨海移動時刻。",
            events: [
                {
                    id: "d7-dogo",
                    time: "上午",
                    title: "道後溫泉街散步",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    links: [{ label: "開啟地圖", url: map("道後溫泉本館"), kind: "map" }],
                },
                {
                    id: "d7-castle",
                    time: "中午前後",
                    title: "松山城",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    description: "依天氣、腿部疲勞與轉乘時刻決定是否上山。",
                    links: [{ label: "開啟地圖", url: map("松山城"), kind: "map" }],
                },
                {
                    id: "d7-transfer",
                    time: "下午",
                    title: "松山 → 岡山",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "提早前往車站，依最新時刻搭乘前往岡山的列車。",
                    warning: "7 月 1 日必須完成跨海移動；出發前重新確認班次與轉乘。",
                },
                {
                    id: "d7-hotel",
                    time: "晚上",
                    title: "岡山最後一晚",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山站周邊",
                },
            ],
        },
        {
            id: "day-8",
            date: "2026-07-02",
            dayLabel: "D8",
            weekday: "週四",
            city: "岡山 → 回家",
            theme: "輕鬆早晨，留足機場時間",
            note: "最後一天不安排遠距離景點。以準時抵達機場為唯一硬行程。",
            events: [
                {
                    id: "d8-morning",
                    time: "上午",
                    title: "岡山站周邊自由活動",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    description: "早餐、採買與整理行李，避免離開車站太遠。",
                },
                {
                    id: "d8-bus",
                    time: "起飛前預留",
                    title: "岡山站 → 岡山機場",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "依國際線報到時間倒推，提早搭乘利木津巴士。",
                    warning: "機場巴士時刻可能調整，前一晚再次確認。",
                    links: [
                        {
                            label: "機場交通",
                            url: "https://www.okayama-airport.org/tw/access/bus",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d8-flight",
                    time: "依機票",
                    title: "岡山機場起飛",
                    type: "transport",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山桃太郎機場",
                },
            ],
        },
    ] satisfies ShimanamiDay[],
} satisfies ShimanamiTrip;

export const PREPARATION_ITEMS = [
    { id: "rental", label: "確認租車、取車與今治還車條件" },
    { id: "luggage", label: "確認大行李轉送日期與收件住宿" },
    { id: "rain", label: "雨衣、防水袋與鞋套" },
    { id: "sun", label: "防曬、帽套與太陽眼鏡" },
    { id: "power", label: "行動電源、充電線與離線地圖" },
    { id: "repair", label: "確認隨車工具、備胎與救援方式" },
];
