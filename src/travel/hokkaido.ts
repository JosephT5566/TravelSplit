import { HOKKAIDO_CAR_TRAVEL_BOOK } from "./registry";

export type HokkaidoEventType =
    | "drive"
    | "ferry"
    | "flight"
    | "transit"
    | "activity"
    | "food"
    | "lodging"
    | "task"
    | "reminder"
    | "safety";

export type HokkaidoStatus =
    | "confirmed"
    | "to-confirm"
    | "informational";

export type HokkaidoPriority = "required" | "recommended" | "optional";

export type HokkaidoWarningSeverity = "notice" | "deadline" | "safety";

export interface HokkaidoLink {
    label: string;
    url: string;
    kind: "map" | "official";
}

export interface HokkaidoLodging {
    name: string;
    secondaryName?: string;
    nights?: number;
    meals?: string;
    platform?: string;
    payment?: string;
}

export interface HokkaidoEvent {
    id: string;
    time: string;
    title: string;
    type: HokkaidoEventType;
    location?: string;
    description?: string;
    priority?: HokkaidoPriority;
    status?: HokkaidoStatus;
    warning?: string;
    warningSeverity?: HokkaidoWarningSeverity;
    links?: HokkaidoLink[];
    lodging?: HokkaidoLodging;
}

export interface HokkaidoDrivingSegment {
    mode: "driving" | "parked" | "returned";
    origin: string;
    destination: string;
    waypoints: string[];
    distanceKm: number;
    duration?: string;
    note: string;
    mapUrl?: string;
    alerts?: {
        label: string;
        severity: HokkaidoWarningSeverity;
    }[];
}

export interface HokkaidoDay {
    id: string;
    date: string;
    dayLabel: string;
    weekday: string;
    region: string;
    destination: string;
    theme: string;
    note?: string;
    driving: HokkaidoDrivingSegment;
    events: HokkaidoEvent[];
}

export interface HokkaidoTrip {
    year: string;
    title: string;
    heroTitle: string;
    heroAccent: string;
    routeSummary: string;
    timezone: string;
    timezoneLabel: string;
    startDate: string;
    endDate: string;
    rentalPeriod: string;
    sourceUrl: string;
    days: HokkaidoDay[];
}

const map = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const directions = (
    origin: string,
    destination: string,
    waypoints: string[] = [],
) => {
    const params = new URLSearchParams({
        api: "1",
        origin,
        destination,
        travelmode: "driving",
    });

    if (waypoints.length > 0) {
        params.set("waypoints", waypoints.join("|"));
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const HOKKAIDO_PREPARATION_ITEMS = [
    { id: "rishiri-ferry", label: "確認並購買稚內 ↔ 利尻島船票" },
    { id: "rishiri-scooter", label: "聯絡利尻島機車租借" },
    { id: "shiretoko-lakes", label: "預約知床五湖講習／導覽" },
    { id: "shiretoko-cruise", label: "確認知床觀光船或賞鯨行程" },
    { id: "tripod", label: "準備相機腳架" },
    { id: "power", label: "準備行動電源與車用充電線" },
    { id: "hiking-shorts", label: "準備登山短褲" },
    { id: "hiking-vest", label: "評估是否攜帶登山背心" },
] as const;

export const HOKKAIDO_TRIP: HokkaidoTrip = {
    year: "2026",
    title: "北海道自駕",
    heroTitle: "北緯 45°",
    heroAccent: "夏日公路",
    routeSummary: "新千歲 → 宗谷岬 → 知床 → 阿寒湖 → 美瑛 → 札幌",
    timezone: "Asia/Tokyo",
    timezoneLabel: "JST · 日本時間",
    startDate: "2026-08-05",
    endDate: "2026-08-16",
    rentalPeriod: "8/5 13:30 → 8/14 13:30",
    sourceUrl:
        `https://docs.google.com/document/d/${HOKKAIDO_CAR_TRAVEL_BOOK.sourceDocumentIds[0]}/edit?usp=drivesdk`,
    days: [
        {
            id: "day-1",
            date: "2026-08-05",
            dayLabel: "D1",
            weekday: "週三",
            region: "道央 → 道北",
            destination: "新千歲 → 名寄",
            theme: "落地後一路向北，先完成第一段長移動",
            note: "下機、午餐與取車都需要時間。第一天只安排道路休息，不塞額外景點。",
            driving: {
                mode: "driving",
                origin: "新千歲機場",
                destination: "名寄",
                waypoints: ["砂川 Highway Oasis"],
                distanceKm: 210,
                duration: "約 3 小時",
                note: "13:30 取車後出發；中途在砂川休息、補給與確認精神狀態。",
                mapUrl: directions("新千歲機場", "HOTEL MYSTAYS Nayoro", [
                    "砂川 Highway Oasis",
                ]),
                alerts: [
                    { label: "第一天長途移動，疲勞時立即增加休息", severity: "safety" },
                ],
            },
            events: [
                {
                    id: "d1-flight",
                    time: "06:20–11:05",
                    title: "IT234 台北 → 新千歲",
                    type: "flight",
                    priority: "required",
                    status: "confirmed",
                    location: "新千歲機場",
                    description: "抵達後先用餐，再前往租車櫃台。",
                    links: [{ label: "機場地圖", url: map("新千歲機場"), kind: "map" }],
                },
                {
                    id: "d1-car",
                    time: "13:30",
                    title: "取車，開始北海道公路段",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    description: "確認車況、油種、ETC、還車地點與 8/14 13:30 截止時間。",
                    warning: "訂單代碼未放入公開頁面，需要時請查看原始文件。",
                    warningSeverity: "notice",
                },
                {
                    id: "d1-sunagawa",
                    time: "途中",
                    title: "砂川 Highway Oasis 休息",
                    type: "drive",
                    priority: "recommended",
                    status: "informational",
                    description: "大型休息站，可補充甜點、伴手禮與駕駛體力。",
                    links: [{ label: "開啟地圖", url: map("砂川 Highway Oasis"), kind: "map" }],
                },
                {
                    id: "d1-hotel",
                    time: "晚上",
                    title: "名寄住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    links: [{ label: "開啟地圖", url: map("HOTEL MYSTAYS Nayoro"), kind: "map" }],
                    lodging: {
                        name: "HOTEL MYSTAYS 名寄",
                        secondaryName: "HOTEL MYSTAYS Nayoro",
                        meals: "含早餐",
                        platform: "Agoda",
                        payment: "已付款",
                    },
                },
            ],
        },
        {
            id: "day-2",
            date: "2026-08-06",
            dayLabel: "D2",
            weekday: "週四",
            region: "道北",
            destination: "名寄 → 宗谷岬 → 稚內",
            theme: "沿著最北公路，抵達日本極北點",
            driving: {
                mode: "driving",
                origin: "名寄",
                destination: "稚內",
                waypoints: ["宗谷岬"],
                distanceKm: 180,
                duration: "約 3 小時 15 分",
                note: "下午先去宗谷岬，再回稚內住宿。沿途加油站間距開始拉長。",
                mapUrl: directions("HOTEL MYSTAYS Nayoro", "Surfeel Hotel Wakkanai", [
                    "宗谷岬",
                ]),
                alerts: [
                    { label: "柏屋 17:00 關門，證明書需在此之前領取", severity: "deadline" },
                    { label: "油量接近 1/2 就找連鎖加油站補滿", severity: "safety" },
                ],
            },
            events: [
                {
                    id: "d2-drive",
                    time: "上午",
                    title: "名寄出發，沿道北前往宗谷",
                    type: "drive",
                    priority: "required",
                    status: "informational",
                },
                {
                    id: "d2-cape",
                    time: "17:00 前",
                    title: "宗谷岬與極北點證明書",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "宗谷岬・柏屋",
                    warning: "柏屋 17:00 關門，延誤時優先保留證明書與極北點。",
                    warningSeverity: "deadline",
                    links: [{ label: "開啟地圖", url: map("宗谷岬 柏屋"), kind: "map" }],
                },
                {
                    id: "d2-hotel",
                    time: "晚上",
                    title: "稚內住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    links: [{ label: "開啟地圖", url: map("Surfeel Hotel Wakkanai"), kind: "map" }],
                    lodging: {
                        name: "稚內斯菲爾飯店",
                        secondaryName: "Surfeel Hotel Wakkanai",
                        meals: "含早餐",
                        platform: "Agoda",
                    },
                },
            ],
        },
        {
            id: "day-3",
            date: "2026-08-07",
            dayLabel: "D3",
            weekday: "週五",
            region: "利尻島",
            destination: "稚內 → 利尻島",
            theme: "把車留在港口，換成海風與島上機車",
            driving: {
                mode: "parked",
                origin: "稚內港",
                destination: "利尻島",
                waypoints: ["鴛泊港"],
                distanceKm: 0,
                note: "租車停在稚內港；搭 Heartland Ferry 上島，島上以租機車移動。",
                alerts: [
                    { label: "旺季船班與機車租借都要事前確認", severity: "deadline" },
                ],
            },
            events: [
                {
                    id: "d3-parking",
                    time: "早上",
                    title: "稚內港停車",
                    type: "task",
                    priority: "required",
                    status: "to-confirm",
                    description: "確認過夜停車區與繳費方式，只帶島上過夜行李。",
                    links: [{ label: "港口地圖", url: map("稚內港 Heartland Ferry"), kind: "map" }],
                },
                {
                    id: "d3-ferry",
                    time: "船班待確認",
                    title: "Heartland Ferry → 利尻島",
                    type: "ferry",
                    priority: "required",
                    status: "to-confirm",
                    warning: "8 月旺季請在出發前重新確認時刻與報到時間。",
                    warningSeverity: "deadline",
                    links: [
                        {
                            label: "官方船班",
                            url: "https://heartlandferry.jp/english/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d3-island",
                    time: "抵達後",
                    title: "租機車環島，看利尻富士",
                    type: "activity",
                    priority: "recommended",
                    status: "to-confirm",
                    description: "以鴛泊周邊、姬沼與利尻山景觀為主，依天候調整。",
                    links: [{ label: "開啟地圖", url: map("利尻島 鴛泊港"), kind: "map" }],
                },
                {
                    id: "d3-hotel",
                    time: "晚上",
                    title: "利尻島住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "旅館 雪國",
                        secondaryName: "Ryokan Yukiguni",
                        meals: "含早晚餐",
                        platform: "Jalan",
                    },
                    links: [{ label: "開啟地圖", url: map("Ryokan Yukiguni Rishiri"), kind: "map" }],
                },
            ],
        },
        {
            id: "day-4",
            date: "2026-08-08",
            dayLabel: "D4",
            weekday: "週六",
            region: "道北 → 鄂霍次克",
            destination: "利尻 → 稚內 → 紋別",
            theme: "清晨離島，沿著鄂霍次克海一路向東",
            driving: {
                mode: "driving",
                origin: "稚內港",
                destination: "紋別",
                waypoints: ["宗谷丘陵", "猿拂", "枝幸"],
                distanceKm: 180,
                duration: "約 3 小時 30 分",
                note: "08:30 首班船回稚內後取車。海岸線路程長，避免在拍照停靠中耗盡日照。",
                mapUrl: directions("稚內港", "紋別 巨大螃蟹爪", ["猿拂村", "枝幸町"]),
                alerts: [
                    { label: "先確認首班船與車輛取回時間", severity: "deadline" },
                    { label: "沿海風強，長時間駕駛要安排休息", severity: "safety" },
                ],
            },
            events: [
                {
                    id: "d4-hime",
                    time: "清晨",
                    title: "姬沼湖畔導覽健行",
                    type: "activity",
                    priority: "optional",
                    status: "to-confirm",
                    description: "僅在不影響首班船報到時安排。",
                },
                {
                    id: "d4-ferry",
                    time: "08:30 目標",
                    title: "首班船返回稚內",
                    type: "ferry",
                    priority: "required",
                    status: "to-confirm",
                    warning: "船班仍需以 Heartland Ferry 最新時刻為準。",
                    warningSeverity: "deadline",
                },
                {
                    id: "d4-crab",
                    time: "傍晚前",
                    title: "紋別巨大螃蟹爪",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    links: [{ label: "開啟地圖", url: map("紋別 巨大螃蟹爪"), kind: "map" }],
                },
                {
                    id: "d4-hotel",
                    time: "晚上",
                    title: "紋別住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "NEW HUMBER",
                        secondaryName: "ニューハンバー",
                        meals: "不含早餐",
                        platform: "Agoda",
                        payment: "已付款",
                    },
                    links: [{ label: "開啟地圖", url: map("NEW HUMBER 紋別"), kind: "map" }],
                },
            ],
        },
        {
            id: "day-5",
            date: "2026-08-09",
            dayLabel: "D5",
            weekday: "週日",
            region: "鄂霍次克 → 知床",
            destination: "紋別 → 網走 → 宇登呂",
            theme: "監獄歷史與知床夕陽，開始進入野生動物路段",
            driving: {
                mode: "driving",
                origin: "紋別",
                destination: "宇登呂",
                waypoints: ["網走監獄"],
                distanceKm: 160,
                duration: "約 3 小時",
                note: "網走停留後前往知床。越接近傍晚，越要主動降低車速。",
                mapUrl: directions("紋別", "Shiretoko Daiichi Hotel", ["博物館 網走監獄"]),
                alerts: [
                    { label: "網走監獄最後入館 17:00", severity: "deadline" },
                    { label: "傍晚留意蝦夷鹿與北狐，建議維持 50–60 km/h", severity: "safety" },
                ],
            },
            events: [
                {
                    id: "d5-prison",
                    time: "17:00 前入館",
                    title: "博物館 網走監獄",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    warning: "最後入館時間以官方公告為準，延誤時縮短停留。",
                    warningSeverity: "deadline",
                    links: [
                        { label: "開啟地圖", url: map("博物館 網走監獄"), kind: "map" },
                        {
                            label: "官方網站",
                            url: "https://www.kangoku.jp/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d5-sunset",
                    time: "傍晚",
                    title: "宇登呂夕陽",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    description: "只在能於天黑前安全抵達時保留。",
                },
                {
                    id: "d5-safety",
                    time: "傍晚駕駛",
                    title: "鹿群可能突然穿越道路",
                    type: "safety",
                    priority: "required",
                    status: "informational",
                    warning: "維持 50–60 km/h，注意路肩反光，不為夕陽趕路。",
                    warningSeverity: "safety",
                },
                {
                    id: "d5-hotel",
                    time: "晚上",
                    title: "知床連住第一晚",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "知床第一ホテル",
                        secondaryName: "Shiretoko Daiichi Hotel",
                        nights: 2,
                        meals: "含早餐",
                        platform: "Agoda",
                    },
                    links: [{ label: "開啟地圖", url: map("Shiretoko Daiichi Hotel"), kind: "map" }],
                },
            ],
        },
        {
            id: "day-6",
            date: "2026-08-10",
            dayLabel: "D6",
            weekday: "週一",
            region: "知床",
            destination: "知床五湖 → 宇登呂",
            theme: "把車程縮短，完整留給世界自然遺產",
            driving: {
                mode: "driving",
                origin: "宇登呂",
                destination: "宇登呂",
                waypoints: ["知床五湖", "知床觀光船"],
                distanceKm: 50,
                duration: "依活動安排",
                note: "今天不追求里程；所有活動依預約、天候與接駁規則排序。",
                mapUrl: directions("Shiretoko Daiichi Hotel", "Shiretoko Daiichi Hotel", [
                    "知床五湖",
                    "ウトロ港",
                ]),
                alerts: [
                    { label: "五湖講習與觀光船需提前預約", severity: "deadline" },
                    { label: "往神威卡瀑布需搭接駁，末班約 16:00", severity: "deadline" },
                ],
            },
            events: [
                {
                    id: "d6-lakes",
                    time: "預約時段",
                    title: "知床五湖",
                    type: "activity",
                    priority: "required",
                    status: "to-confirm",
                    warning: "8 月需依規定參加講習或導覽，不能把現場入場視為保證。",
                    warningSeverity: "deadline",
                    links: [
                        { label: "開啟地圖", url: map("知床五湖"), kind: "map" },
                        {
                            label: "官方資訊",
                            url: "https://www.goko.go.jp/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d6-cruise",
                    time: "船班待確認",
                    title: "知床觀光船",
                    type: "ferry",
                    priority: "recommended",
                    status: "to-confirm",
                    description: "依海況與預約結果決定航線；賞鯨團列為替代選項。",
                },
                {
                    id: "d6-falls",
                    time: "16:00 前",
                    title: "神威卡瀑布接駁",
                    type: "transit",
                    priority: "optional",
                    status: "to-confirm",
                    warning: "8 月道路管制與接駁規則需重新確認，不可直接假設能開車進入。",
                    warningSeverity: "deadline",
                },
                {
                    id: "d6-hotel",
                    time: "晚上",
                    title: "知床連住第二晚",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "知床第一ホテル",
                        secondaryName: "Shiretoko Daiichi Hotel",
                        meals: "含早餐",
                        platform: "Agoda",
                    },
                },
            ],
        },
        {
            id: "day-7",
            date: "2026-08-11",
            dayLabel: "D7",
            weekday: "週二",
            region: "道東三湖",
            destination: "知床 → 摩周湖 → 阿寒湖",
            theme: "離開海岸，進入霧、湖泊與愛努文化",
            driving: {
                mode: "driving",
                origin: "知床",
                destination: "阿寒湖",
                waypoints: ["摩周湖第一展望台"],
                distanceKm: 150,
                duration: "約 3 小時",
                note: "摩周湖常起霧，盡量中午前抵達。傍晚進阿寒湖仍需留意動物。",
                mapUrl: directions("Shiretoko Daiichi Hotel", "Akan Yuku no Sato Tsuruga", [
                    "摩周湖第一展望台",
                ]),
                alerts: [
                    { label: "摩周湖越早到，看到湖面的機率通常越高", severity: "notice" },
                    { label: "道東傍晚持續留意鹿群與路肩", severity: "safety" },
                ],
            },
            events: [
                {
                    id: "d7-mashu",
                    time: "中午前目標",
                    title: "摩周湖第一展望台",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    description: "天氣好時湖水顏色清楚，也可留意展望台限定商品。",
                    links: [{ label: "開啟地圖", url: map("摩周湖第一展望台"), kind: "map" }],
                },
                {
                    id: "d7-ainu",
                    time: "晚上",
                    title: "阿寒湖愛努村",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    links: [{ label: "開啟地圖", url: map("阿寒湖愛努村"), kind: "map" }],
                },
                {
                    id: "d7-hotel",
                    time: "晚上",
                    title: "阿寒湖溫泉住宿",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "阿寒遊久之里鶴雅",
                        secondaryName: "Akan Yuku no Sato Tsuruga",
                        meals: "含早晚餐",
                        platform: "Booking",
                        payment: "已付款",
                    },
                    links: [{ label: "開啟地圖", url: map("Akan Yuku no Sato Tsuruga"), kind: "map" }],
                },
            ],
        },
        {
            id: "day-8",
            date: "2026-08-12",
            dayLabel: "D8",
            weekday: "週三",
            region: "道東 → 美瑛",
            destination: "阿寒湖 → 帶廣 → 青池 → 美瑛",
            theme: "全程最長移動日，追著下午四點前的藍色",
            driving: {
                mode: "driving",
                origin: "阿寒湖",
                destination: "美瑛",
                waypoints: ["帶廣", "白金青池", "白鬚瀑布"],
                distanceKm: 220,
                duration: "約 4 小時 30 分",
                note: "盆節交通開始增加。帶廣只做有效率的午餐與休息，目標 16:00 前抵達青池。",
                mapUrl: directions("Akan Yuku no Sato Tsuruga", "coro coro Biei", [
                    "六花亭 帶廣本店",
                    "白金青池",
                    "白鬚瀑布",
                ]),
                alerts: [
                    { label: "全程最長 220 km，固定安排帶廣休息", severity: "safety" },
                    { label: "青池 16:00 前抵達，之後光線與池色會變暗", severity: "deadline" },
                    { label: "盆節車潮開始，停車與道路都要增加緩衝", severity: "notice" },
                ],
            },
            events: [
                {
                    id: "d8-obihiro",
                    time: "中午",
                    title: "帶廣休息與午餐",
                    type: "food",
                    priority: "recommended",
                    status: "informational",
                    description: "豚丼、六花亭甜點或十勝牛奶擇一，避免停留過久。",
                    links: [{ label: "開啟地圖", url: map("六花亭 帶廣本店"), kind: "map" }],
                },
                {
                    id: "d8-blue",
                    time: "16:00 前",
                    title: "白金青池",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    warning: "雖然可晚到，但下午四點後池水顏色會明顯變暗。",
                    warningSeverity: "deadline",
                    links: [{ label: "開啟地圖", url: map("白金青池"), kind: "map" }],
                },
                {
                    id: "d8-falls",
                    time: "青池後",
                    title: "白鬚瀑布",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    links: [{ label: "開啟地圖", url: map("白鬚瀑布"), kind: "map" }],
                },
                {
                    id: "d8-hotel",
                    time: "晚上",
                    title: "美瑛連住第一晚",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "coro coro",
                        nights: 2,
                        meals: "含早餐",
                        platform: "Booking",
                        payment: "未付款",
                    },
                    links: [{ label: "開啟地圖", url: map("coro coro Biei"), kind: "map" }],
                },
            ],
        },
        {
            id: "day-9",
            date: "2026-08-13",
            dayLabel: "D9",
            weekday: "週四",
            region: "富良野・美瑛",
            destination: "富田農場 → 四季彩之丘 → 美瑛",
            theme: "早起換來花田，避開盆節最密集的人潮",
            driving: {
                mode: "driving",
                origin: "美瑛",
                destination: "美瑛",
                waypoints: ["富田農場", "四季彩之丘"],
                distanceKm: 60,
                duration: "約 1 小時 30 分",
                note: "今天里程短，但停車排隊可能比開車更久。07:00 前後抵達富田農場。",
                mapUrl: directions("coro coro Biei", "coro coro Biei", [
                    "富田農場",
                    "四季彩之丘",
                ]),
                alerts: [
                    { label: "06:30 起床，07:00 左右抵達富田農場", severity: "deadline" },
                    { label: "盆節高峰，晚到可能多花 2 小時排隊停車", severity: "notice" },
                ],
            },
            events: [
                {
                    id: "d9-tomita",
                    time: "07:00 目標",
                    title: "富田農場",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    description: "預留約 2 小時拍照與散步；早到比增加景點更重要。",
                    warning: "盆節期間晚到的主要成本是停車排隊。",
                    warningSeverity: "deadline",
                    links: [
                        { label: "開啟地圖", url: map("富田農場"), kind: "map" },
                        {
                            label: "參考文章",
                            url: "https://bobbytravel.tw/farm-tomita/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d9-shikisai",
                    time: "上午後段",
                    title: "四季彩之丘",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    description: "預留約 2 小時。若只散步拍照，可不搭遊園車。",
                    links: [
                        { label: "開啟地圖", url: map("四季彩之丘"), kind: "map" },
                        {
                            label: "參考文章",
                            url: "https://bobbytravel.tw/shikisainooka/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d9-biei",
                    time: "下午",
                    title: "美瑛丘陵與彈性休息",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    description: "花田步行量大，下午不再硬塞遠距景點。",
                },
                {
                    id: "d9-hotel",
                    time: "晚上",
                    title: "美瑛連住第二晚",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "coro coro",
                        meals: "含早餐",
                        platform: "Booking",
                        payment: "未付款",
                    },
                },
            ],
        },
        {
            id: "day-10",
            date: "2026-08-14",
            dayLabel: "D10",
            weekday: "週五",
            region: "美瑛 → 新千歲 → 札幌",
            destination: "美瑛 → 新千歲 → 札幌",
            theme: "準時還車，把公路旅行交回給鐵路",
            driving: {
                mode: "driving",
                origin: "美瑛",
                destination: "新千歲機場",
                waypoints: ["還車前加油"],
                distanceKm: 158,
                duration: "純車程約 2 小時 30 分",
                note: "09:00 前後出發。車程之外必須保留盆節塞車、加油、驗車與接駁時間。",
                mapUrl: directions("美瑛", "新千歲機場 租車還車"),
                alerts: [
                    { label: "13:30 前完成還車", severity: "deadline" },
                    { label: "不要把 2.5 小時純車程當作完整所需時間", severity: "safety" },
                ],
            },
            events: [
                {
                    id: "d10-depart",
                    time: "09:00",
                    title: "美瑛出發",
                    type: "drive",
                    priority: "required",
                    status: "informational",
                    warning: "盆節期間可能塞車，不安排出發前景點。",
                    warningSeverity: "deadline",
                },
                {
                    id: "d10-fuel",
                    time: "還車前",
                    title: "加滿油並保留收據",
                    type: "task",
                    priority: "required",
                    status: "informational",
                },
                {
                    id: "d10-return",
                    time: "13:30 前",
                    title: "新千歲機場還車",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    warning: "截止時間包含驗車與交接，不是抵達附近的時間。",
                    warningSeverity: "deadline",
                },
                {
                    id: "d10-otaru",
                    time: "下午",
                    title: "小樽半日遊",
                    type: "transit",
                    priority: "recommended",
                    status: "informational",
                    description: "還車後改搭公共交通；若還車延誤，縮短或取消小樽。",
                    links: [{ label: "開啟地圖", url: map("小樽運河"), kind: "map" }],
                },
                {
                    id: "d10-hotel",
                    time: "晚上",
                    title: "札幌連住第一晚",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "hotel androoms Sapporo Susukino",
                        nights: 2,
                        meals: "含早餐",
                        platform: "Booking",
                        payment: "已付款",
                    },
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("hotel androoms Sapporo Susukino"),
                            kind: "map",
                        },
                    ],
                },
            ],
        },
        {
            id: "day-11",
            date: "2026-08-15",
            dayLabel: "D11",
            weekday: "週六",
            region: "札幌",
            destination: "札幌市區",
            theme: "不再開車，用一整天慢慢收尾",
            driving: {
                mode: "returned",
                origin: "札幌",
                destination: "札幌",
                waypoints: ["藻岩山"],
                distanceKm: 0,
                note: "租車已歸還。市區以步行、地下鐵與路面電車移動。",
                alerts: [
                    { label: "盆節週末人潮多，夜景交通預留排隊時間", severity: "notice" },
                ],
            },
            events: [
                {
                    id: "d11-city",
                    time: "白天",
                    title: "札幌市區自由活動",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    description: "依體力安排市場、商店街或咖啡店，不再追長距離景點。",
                },
                {
                    id: "d11-moiwa",
                    time: "傍晚至晚上",
                    title: "藻岩山夜景",
                    type: "activity",
                    priority: "required",
                    status: "to-confirm",
                    links: [
                        { label: "開啟地圖", url: map("藻岩山纜車"), kind: "map" },
                        {
                            label: "官方網站",
                            url: "https://mt-moiwa.jp/en/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d11-hotel",
                    time: "晚上",
                    title: "札幌連住第二晚",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    lodging: {
                        name: "hotel androoms Sapporo Susukino",
                        meals: "含早餐",
                        platform: "Booking",
                        payment: "已付款",
                    },
                },
            ],
        },
        {
            id: "day-12",
            date: "2026-08-16",
            dayLabel: "D12",
            weekday: "週日",
            region: "札幌 → 新千歲",
            destination: "新千歲 → 台北",
            theme: "提早到機場，讓旅程平穩降落",
            driving: {
                mode: "returned",
                origin: "札幌",
                destination: "新千歲機場",
                waypoints: ["JR 快速列車"],
                distanceKm: 0,
                note: "租車已歸還；搭 JR 或其他公共交通前往機場。",
                alerts: [
                    { label: "09:30 前抵達機場", severity: "deadline" },
                ],
            },
            events: [
                {
                    id: "d12-train",
                    time: "08:00 前後",
                    title: "札幌 → 新千歲機場",
                    type: "transit",
                    priority: "required",
                    status: "to-confirm",
                    description: "目標 09:30 前抵達，班次與月台於前一晚再次確認。",
                },
                {
                    id: "d12-airport",
                    time: "09:30 前",
                    title: "抵達新千歲機場",
                    type: "task",
                    priority: "required",
                    status: "informational",
                    warning: "預留退稅、托運與安檢排隊時間。",
                    warningSeverity: "deadline",
                },
                {
                    id: "d12-flight",
                    time: "11:30–15:00",
                    title: "IT235 新千歲 → 台北",
                    type: "flight",
                    priority: "required",
                    status: "confirmed",
                },
            ],
        },
    ],
};
