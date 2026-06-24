import { SHIMANAMI_TRAVEL_BOOK } from "./registry";
import {
    createGoogleMapsSearchUrl as map,
    createGoogleMapsDirectionsUrl as directions
} from "./maps";

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
    compact?: boolean; // smaller size
    links?: ShimanamiLink[];
    warning?: string;
    options?: {
        id: string;
        title: string;
        description?: string;
        links?: ShimanamiLink[];
    }[];
    highlight?: {
        src?: string;
        alt: string;
        sourceUrl?: string;
        sourceLabel?: string;
        placeholderName: string;
    };
}

export interface ShimanamiDay {
    id: string;
    date: string;
    dayLabel: string;
    weekday: string;
    city: string;
    theme: string;
    weather?: {
        location: string;
        condition: string;
        precipitationProbability: number;
        morningCelsius: string;
        nightCelsius: string;
        link?: string;
    };
    cycling?: {
        label: string;
        route: string;
        routeImage?: {
            src: string;
            alt: string;
        };
        distance: string;
        rideWindow: string;
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
            theme: "16:30 抵達，先安頓住宿再安排一段市區行程",
            weather: {
                location: "岡山/岡山市",
                condition: "多雲有雨",
                precipitationProbability: 50,
                morningCelsius: "26°",
                nightCelsius: "21°",
                link: "https://www.jma.go.jp/bosai/#pattern=forecast&area_type=class20s&area_code=3310000"
            },
            note: "時間為含轉乘與步行的保守估算。第一晚以 Check-in、Montbell 與晚餐為主。",
            events: [
                {
                    id: "d1-flight",
                    time: "16:30–17:15",
                    title: "抵達岡山機場／入境與領行李",
                    type: "transport",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山桃太郎機場",
                    description: "16:30 班機抵達。預留約 45 分鐘完成入境、領取行李並前往巴士站。",
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
                    time: "17:15–18:00",
                    title: "機場巴士 → 岡山站",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "候車約 10–15 分鐘，車程約 30 分鐘。實際抵達時間依當日班次與路況調整。",
                },
                {
                    id: "d1-hotel-transfer",
                    time: "18:00–18:20",
                    title: "岡山站 → とりいくぐる",
                    type: "transport",
                    priority: "required",
                    status: "informational",
                    description: "預留約 20 分鐘前往住宿，包含找路與拖行李的緩衝。",
                    links: [
                        {
                            label: "住宿路線",
                            url: "https://maps.app.goo.gl/gq6GrQPNbAhK5Dc27",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d1-hotel",
                    time: "18:20–18:40",
                    title: "とりいくぐる Check-in",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "とりいくぐる",
                    description: "辦理入住、放下行李並簡單整理。若交通延誤，先聯絡住宿確認最晚 Check-in 時間。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/gq6GrQPNbAhK5Dc27",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d1-montbell",
                    time: "18:40–19:40",
                    title: "Montbell",
                    type: "activity",
                    priority: "recommended",
                    location: "岡山市中心",
                    description: "從住宿前往約 20–25 分鐘，保留約 30–35 分鐘購物。20:00 打烊。買雨傘、T-shirt、鴨舌帽、背包，其他...",
                    links: [
                        {
                            label: "開啟地圖",
                            url: "https://maps.app.goo.gl/uwA7Tu6g8KNVJ4VQA",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d1-omotecho",
                    time: "19:40–21:00",
                    title: "表町商店街／晚餐",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "表町商店街",
                    description: "從 Montbell 步行前往並在商店街周邊吃晚餐。此時多數商店可能已陸續打烊，以用餐與短程散步為主。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("表町商店街 岡山"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d1-nishigawa",
                    time: "21:00–22:00",
                    title: "西川綠道公園夜間散步",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    location: "西川綠道公園",
                    description: "表町一帶前往公園約 10–15 分鐘，散步約 20–30 分鐘，再預留約 15–20 分鐘返回住宿。疲累或下雨就直接回 とりいくぐる。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("西川緑道公園 岡山"),
                            kind: "map",
                        },
                    ],
                },
            ],
            contingencies: [
                "18:40 前未完成 Check-in：取消 Montbell，直接在住宿或岡山站周邊晚餐。",
                "Montbell 結束較晚：縮短表町散步，只保留晚餐。",
                "咖啡店不列入第一天；西川綠道公園則依天氣與體力現場決定。",
            ],
        },
        {
            id: "day-2",
            date: "2026-06-26",
            dayLabel: "D2",
            weekday: "週五",
            city: "倉敷",
            theme: "從晨間咖啡走到黃昏運河，完整感受倉敷",
            weather: {
                location: "岡山/岡山市",
                condition: "多雲有雨",
                precipitationProbability: 50,
                morningCelsius: "26°",
                nightCelsius: "21°",
                link: "https://www.jma.go.jp/bosai/#pattern=forecast&area_type=class20s&area_code=3310000"
            },
            note: "08:30 從岡山出發，主要行程集中在步行可達的美觀地區。17:30 搭 JR 返回岡山。",
            events: [
                {
                    id: "d2-train",
                    time: "08:30–09:00",
                    title: "岡山 → 倉敷",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "08:30 從岡山出發。JR 車程約 17 分鐘，其餘時間預留候車、出站與步行緩衝。",
                    links: [
                        { label: "岡山站", url: map("岡山站"), kind: "map" },
                        { label: "倉敷站", url: map("倉敷站"), kind: "map" },
                    ],
                },
                {
                    id: "d2-morning-coffee",
                    time: "09:00–09:45",
                    title: "倉敷晨間咖啡",
                    type: "food",
                    priority: "recommended",
                    status: "to-confirm",
                    description: "從倉敷站往美觀地區方向找咖啡店，停留約 30–35 分鐘，並保留步行進入景區的時間。",
                    links: [
                        {
                            label: "附近咖啡",
                            url: map("倉敷美觀地區 咖啡"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d2-bikan",
                    time: "09:45–11:30",
                    title: "倉敷美觀地區散步",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "倉敷川沿岸",
                    description: "沿運河、白壁街與巷弄慢走拍照。上午光線較柔和，先完成主要街景與水岸畫面。",
                    links: [
                        { label: "開啟地圖", url: map("倉敷美觀地區"), kind: "map" },
                    ],
                    highlight: {
                        src: "https://www.kurashiki-tabi.jp/wp-content/uploads/2023/12/standard_01_top.jpg",
                        alt: "倉敷美觀地區的白壁町家、運河與柳樹",
                        sourceUrl:
                            "https://www.kurashiki-tabi.jp/standard/kurashiki-bikan-historical-quarter/",
                        sourceLabel: "倉敷觀光 WEB",
                        placeholderName: "倉敷美觀地區運河",
                    },
                },
                {
                    id: "d2-lunch",
                    time: "11:30–12:30",
                    title: "倉敷午餐二選一",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "避開正午後更長的候位時間，依現場人潮選擇岡山名物或較清爽的麵食。",
                    options: [
                        {
                            id: "d2-lunch-demikatsu",
                            title: "Demikatsu Don",
                            description: "岡山名物多蜜醬豬排丼，想吃在地特色時優先。",
                            links: [
                                {
                                    label: "搜尋餐廳",
                                    url: map("倉敷美觀地區 デミカツ丼"),
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d2-lunch-udon",
                            title: "烏龍麵",
                            description: "較快速、份量容易控制，適合午後安排美術館。",
                            links: [
                                {
                                    label: "搜尋餐廳",
                                    url: map("倉敷美觀地區 うどん"),
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d2-honmachi",
                    time: "12:30–13:30",
                    title: "本町通、東町通與小店雜貨",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "倉敷本町・東町",
                    description: "從主運河轉入老街，逛町家小店、工藝品與生活雜貨。控制購物時間，13:30 前往大原美術館。",
                    links: [
                        {
                            label: "本町通地圖",
                            url: map("倉敷 本町通"),
                            kind: "map",
                        },
                        {
                            label: "東町通地圖",
                            url: map("倉敷 東町"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d2-museum",
                    time: "13:30–15:30",
                    title: "大原美術館",
                    type: "activity",
                    priority: "required",
                    status: "to-confirm",
                    location: "大原美術館",
                    description: "預留兩小時參觀。入館前確認當日開館資訊與最後入館時間，優先看主館藏品。",
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
                    id: "d2-afternoon-coffee",
                    time: "15:30–16:30",
                    title: "午後咖啡休息",
                    type: "food",
                    priority: "recommended",
                    status: "informational",
                    description: "美術館後在美觀地區休息，整理照片與恢復體力。若熱門店候位過久，改外帶飲品。",
                    links: [
                        {
                            label: "附近咖啡",
                            url: map("倉敷美觀地區 咖啡"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d2-sunset-walk",
                    time: "16:30–17:15",
                    title: "黃昏運河散步拍照",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "倉敷川沿岸",
                    description: "利用傍晚光線再走一次運河，補拍柳樹、水面倒影與白壁街景。17:15 左右開始往倉敷站移動。",
                    links: [
                        {
                            label: "運河地圖",
                            url: map("倉敷川 美觀地區"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d2-return",
                    time: "17:15–18:15",
                    title: "步行至倉敷站／JR 返回岡山",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "預留約 15 分鐘步行至車站，目標搭乘 17:30 左右的 JR。車程約 17 分鐘，18:00 前後抵達岡山。",
                },
                {
                    id: "d2-dinner",
                    time: "18:30–19:45",
                    title: "岡山晚餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "抵達岡山後先用餐，地點以岡山站至住宿方向為主，避免晚餐後再繞路。",
                    links: [
                        {
                            label: "岡山站附近餐廳",
                            url: map("岡山站 晚餐"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d2-hotel",
                    time: "20:00",
                    title: "返回 とりいくぐる",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "とりいくぐる",
                    description: "回住宿休息並整理隔日前往尾道與騎行準備所需物品。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/gq6GrQPNbAhK5Dc27",
                            kind: "map",
                        },
                    ],
                },
            ],
            contingencies: [
                "雨勢大時縮短上午與黃昏運河散步，把時間留給大原美術館、午餐與室內小店。",
                "午餐排隊超過 20 分鐘時改選烏龍麵或其他附近餐廳，避免壓縮美術館時間。",
                "下午進度落後時取消第二次咖啡，保留黃昏拍照與 17:30 返回岡山的 JR。",
            ],
        },
        {
            id: "day-3",
            date: "2026-06-27",
            dayLabel: "D3",
            weekday: "週六",
            city: "岡山 → 吉備津 → 尾道",
            theme: "神社晨遊、與弟弟會合與騎行前最後補給",
            weather: {
                location: "廣島/尾道",
                condition: "多雲有雨",
                precipitationProbability: 50,
                morningCelsius: "26°",
                nightCelsius: "22°",
                link: "https://www.jma.go.jp/bosai/#pattern=forecast&area_type=class20s&area_code=3420500",
            },
            note: "阿強抵達日。上午去吉備津神社，下午在岡山完成行李整理，16:30 左右與阿強會合，18:00 前要搭前往尾道的列車。",
            events: [
                {
                    id: "d3-breakfast",
                    time: "08:00–08:45",
                    title: "早餐與出門準備",
                    type: "food",
                    priority: "required",
                    status: "informational",
                    location: "とりいくぐる／岡山市區",
                    description: "吃完早餐後帶上當日上午所需物品，確認行李可留在住宿或已安排寄放。",
                },
                {
                    id: "d3-kibitsu-train",
                    time: "09:00–09:30",
                    title: "岡山 → 吉備津",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "從岡山站搭乘 JR 桃太郎線前往吉備津站，車程約 15–20 分鐘；抵達後步行前往神社。",
                    links: [
                        {
                            label: "吉備津站",
                            url: map("吉備津駅"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-kibitsu",
                    time: "09:30–11:30",
                    title: "吉備津神社與迴廊散步",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "吉備津神社",
                    description: "參拜本殿並沿長迴廊散步拍照。預留往返車站的步行時間，不安排距離較遠的支線。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("吉備津神社"),
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://www.kibitujinja.com/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d3-lunch",
                    time: "11:30–12:30",
                    title: "午餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "在吉備津站周邊簡單用餐，或返回岡山後再吃。若附近餐廳候位較久，優先搭車回岡山。",
                    links: [
                        {
                            label: "附近餐廳",
                            url: map("吉備津神社 ランチ"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-return-okayama",
                    time: "12:30–13:00",
                    title: "吉備津 → 岡山",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "步行回吉備津站並搭 JR 返回岡山，預留候車與回到市區的時間。",
                },
                {
                    id: "d3-coffee-luggage",
                    time: "13:00–16:00",
                    title: "岡山咖啡與行李整理",
                    type: "task",
                    priority: "required",
                    status: "informational",
                    description: "先喝咖啡休息，再回 とりいくぐる 取行李並重新整理。三日騎行只帶隨身裝備，確認雨具、防曬、充電設備與基本補給。",
                    links: [
                        {
                            label: "住宿地圖",
                            url: "https://maps.app.goo.gl/gq6GrQPNbAhK5Dc27",
                            kind: "map",
                        },
                        {
                            label: "岡山咖啡",
                            url: map("岡山駅 コーヒー"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-brother-airport",
                    time: "15:05–16:20",
                    title: "阿強抵達岡山機場／前往岡山站",
                    type: "transport",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山桃太郎機場 → 岡山站",
                    description: "15:05 班機抵達。預留領行李、候車與約 30 分鐘機場巴士車程，目標 16:20 前抵達岡山站。",
                    links: [
                        {
                            label: "機場交通",
                            url: "https://www.okayama-airport.org/tw/access/bus",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d3-meet",
                    time: "16:30",
                    title: "岡山站會合",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山站",
                    description: "岡山站會合，確認前往尾道的車票、月台與 18:00 出發時間。",
                    links: [
                        {
                            label: "岡山站地圖",
                            url: map("岡山站"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-montbell",
                    time: "16:30–17:45",
                    title: "逛 Montbell",
                    type: "reminder",
                    priority: "optional",
                    links: [
                        {
                            label: "開啟 Montbell 地圖",
                            url: "https://maps.app.goo.gl/uwA7Tu6g8KNVJ4VQA",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-onomichi-train",
                    time: "18:00–19:20",
                    title: "岡山 → 尾道",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "搭乘 JR 前往尾道，車程約 1:20，班次滿多的。",
                    links: [
                        {
                            label: "開啟路線",
                            url: directions("岡山車站 日本〒700-0024 Okayama, Kita Ward, Ekimotomachi, 1−1", "尾道 日本〒722-0036 Hiroshima, Onomichi, Higashigoshocho, 1−1"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-hotel-dinner",
                    time: "19:20–20:30",
                    title: "Lemonsea Onomichi Check-in／晚餐",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "Lemonsea Onomichi",
                    description: "抵達後先辦理入住、放下行李，再於住宿附近吃晚餐。若餐廳較早打烊，可在岡山站或列車上先準備簡單食物。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/2JbUA43VywnPQush8",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d3-waterfront",
                    time: "20:30–21:15",
                    title: "尾道水岸夜間散步",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    location: "尾道水道沿岸",
                    description: "沿尾道站與海岸通一帶短程散步，熟悉隔日往渡船與租車點的方向。以早睡和保存騎行體力為優先。",
                    links: [
                        {
                            label: "水岸地圖",
                            url: map("尾道 海岸通り"),
                            kind: "map",
                        },
                    ],
                },
            ],
            contingencies: [
                "吉備津行程延誤時縮短午餐與咖啡時間，最晚 16:00 帶行李抵達岡山站周邊。",
                "阿強 16:30 後才抵達岡山站時，取消或縮短 Montbell，直接準備搭乘 18:00 列車。",
                "抵達尾道較晚時先 Check-in；晚餐可改為途中購買，取消水岸散步。",
            ],
        },
        {
            id: "day-4",
            date: "2026-06-28",
            dayLabel: "D4",
            weekday: "週日",
            city: "尾道 → 瀨戶田",
            theme: "第一段藍線：跨過向島與因島",
            weather: {
                location: "廣島/尾道",
                condition: "陰天",
                precipitationProbability: 40,
                morningCelsius: "28°",
                nightCelsius: "22°",
                link: "https://www.jma.go.jp/bosai/#pattern=forecast&area_type=class20s&area_code=3420500",
            },
            cycling: {
                label: "SHIMANAMI RIDE 1/3",
                route: "尾道 → 向島/岩子島 → 因島 → 生口島・瀨戶田",
                distance: "約 45 km（含岩子島與因島南部）",
                rideWindow: `9:00 渡船到向島
                11:30 進入因島
                15:00 進入生口島
                17:30 抵達住宿`,
                routeImage: {
                    src: "https://cdn.josephtseng-tw.com/travel-split/2026-shimanami/day1-route.jpg",
                    alt: "Day1 route",
                },
            },
            note: "進入向島後會再轉到岩子島走走。通過因島大橋後可以挑戰看看高見山展望台，再依序前往因島水軍城、再到土生港午餐，與大山神社。最後進到生口島就能放鬆點，吃冰、check in、沙灘散步。",
            events: [
                {
                    id: "d4-breakfast",
                    time: "07:30–08:00",
                    title: "早餐與騎行前補給",
                    type: "food",
                    priority: "required",
                    status: "informational",
                    location: "Lemonsea Onomichi／尾道市區",
                    description: "吃足早餐並補水，確認隨身攜帶防曬、雨具、行動電源與簡單能量補給。",
                },
                {
                    id: "d4-bike-pickup",
                    time: "08:00–09:00",
                    title: "取車、調整與車況確認",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    location: "尾道駅前レンタサイクル",
                    description: "予約番号【SNJ-93689418】確認車架尺寸、座墊高度、煞車、變速、胎壓、車燈與鎖具。試騎後再出發，並確認還車地點與緊急聯絡方式。",
                    warning: "任何煞車、輪胎或變速異常都要在離開租車點前處理。",
                    links: [
                        {
                            label: "租車點地圖",
                            url: "https://maps.app.goo.gl/UhXvKNn4SdpkYDeD6",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d4-ferry",
                    time: "09:00–09:15",
                    title: "尾道渡船 → 向島",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "牽車搭乘渡船前往向島，抵達後沿島波海道藍線開始騎行。船班蠻密集的，約10分鐘一班，單次 100 yen，時間 3 - 5 min",
                    links: [{ label: "相關文章", url: "https://vocus.cc/article/69f08eaefd89780001e4eef1", kind: "official" }],
                },
                {
                    id: "d4-mukaishima",
                    time: "09:15–9:50 (抓 25 min)",
                    title: "向島 → 岩子島支線 (7 km，平緩)",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "向島・向島大橋・岩子島",
                    description: "先沿向島西側前進，再經向島大橋進入岩子島。這段離開島波海道主線，保持輕鬆配速並留意一般道路車流。",
                    highlight: {
                        src: "https://www.japan-guide.com/g19/3478_12.jpg",
                        alt: "島波海道自行車道沿著瀨戶內海跨越島嶼",
                        sourceUrl: "https://www.japan-guide.com/e/e3478.html",
                        sourceLabel: "Japan Guide",
                        placeholderName: "島波海道跨海自行車道",
                    },
                },
                {
                    id: "d4-iwashijima-torii",
                    time: "9:50–10:20",
                    title: "岩子島 厳島神社 鳥居",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "岩子島厳島神社",
                    description: "停車後步行到海邊鳥居參拜、拍照，預留約 25 分鐘。鳥居景觀會隨潮位改變；離開後原路返回向島並接回主線。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: "https://maps.app.goo.gl/TBDEBkeQJafkNMtD6",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d4-innoshima-bridge",
                    time: "10:20–10:40 (抓 20 min)",
                    title: "岩子島 → 因島大橋入口／補水 (6 km，小爬升)",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "因島大橋入口",
                    description: "從岩子島返回向島並接回島波海道藍線；在上橋前短暫休息、補水，確認風勢與體力後再進入橋面爬升。",
                    links: [
                        {
                            label: "因島大橋地圖",
                            url: map("因島大橋 自転車道"),
                            kind: "map",
                        },
                    ],
                    options: [
                        {
                            id: "d4-takami-view",
                            title: "岩子島嚴島神社 → 高見山展望台",
                            description: "評估要不要去展望，8km，爬升 280 m，約 25 分鐘。若體力與時間允許，建議上去看海景與因島大橋全景。",
                            links: [
                                {
                                    label: "附近休息點",
                                    url: map("因島大橋 休息"),
                                    kind: "map",
                                },
                                {
                                    label: "路線",
                                    url: directions("Iwashijima Itsukushima Shrine Torii, 1944 Mukaishimacho Iwashijima, Onomichi, Hiroshima 722-0072日本", "高見山展望台 日本〒722-0071 Hiroshima, Onomichi, Mukaishimacho Tachibana"),
                                    kind: "map",
                                }
                            ],
                        },
                    ],
                    warning: "11:30 之前需離開因島大橋",
                },
                {
                    id: "d4-innoshima-castle-transfer",
                    time: "11:30–12:00 （路程約 20 min）",
                    title: "因島大橋 → 因島水軍城  (6km，平緩)",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "因島",
                    description: "通過因島大橋後離開前往生口橋的最短主線，騎往島內的因島水軍城。保持能交談的配速，為午後前往土生港及折返生口橋保留體力。",
                },
                {
                    id: "d4-innoshima-suigun-castle",
                    time: "12:00–12:40",
                    title: "因島水軍城",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "因島水軍城",
                    description: "停車後參觀村上海賊相關展示與城內展望空間，預留約 40 分鐘。館內通常 09:00–17:00 開放、週四休館；當天仍以現場公告為準。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("因島水軍城"),
                            kind: "map",
                        },
                        {
                            label: "官方資訊",
                            url: "https://www.city.onomichi.hiroshima.jp/soshiki/38/1042.html",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d4-manda",
                    time: "Pass",
                    title: "萬田發酵（週日休園）",
                    type: "activity",
                    priority: "optional",
                    status: "cancelled",
                    compact: true,
                    location: "萬田發酵 HAKKO PARK",
                    links: [
                        {
                            label: "開啟地圖",
                            url: "https://maps.app.goo.gl/aZgwtVX8NsA3KPqP9",
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://mandahakkopark.com/index.html",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d4-lunch",
                    time: "12:40–13:10 （路程約 30 min）",
                    title: "因島水軍城 → 土生港周邊午餐 (6km，小坡上下)",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    location: "土生港／土生商店街",
                    description: "在附近吃因島燒，並稍作休息",
                    links: [
                        {
                            label: "上田お好み焼",
                            url: "https://maps.app.goo.gl/rFSNABgomo6LfyZQ8",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d4-oyama-shrine",
                    time: "14:30–14:40",
                    title: "土生港 → 大山神社",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "因島中部 → 土生町",
                    description: "大山神社・自転車神社，到因島最古老的神社參拜。預留約 30 分鐘；可以購買御守或御朱印，御朱印帳很可愛。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("大山神社 因島 自転車神社"),
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://ooyamajinja.net/",
                            kind: "official",
                        },
                    ],
                    warning: "15:00 要離開神社前往生口橋",
                },
                {
                    id: "d4-ikuchi-bridge",
                    time: "15:00–15:40 （路程約 30 min）",
                    title: "大山神社 → 生口橋 → 生口島・瀨戶田冰淇淋 (約 10 km，過橋坡)",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "生口橋",
                    description: "從因島南部沿西岸北上返回生口橋，過橋後繼續騎往瀨戶田。這是午後最長的必要移動段；橋前主動補水，遇強風時降低速度並拉開距離。",
                    links: [
                        {
                            label: "生口橋地圖",
                            url: map("生口橋 自転車道"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d4-setoda-cafe",
                    time: "15:40",
                    title: "Dolce Ice Cream",
                    type: "food",
                    priority: "required",
                    status: "informational",
                    location: "瀨戶田商店街",
                    description: "抵達瀨戶田後以咖啡、檸檬甜點或冰品快速恢復體力。最多停留 30 分鐘；進度落後或店家排隊時直接前往住宿。",
                    links: [
                        {
                            label: "附近咖啡甜點",
                            url: map("瀬戸田 カフェ レモン"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d4-kosanji",
                    time: "16:00 - 17:00",
                    title: "耕三寺與未來心之丘",
                    type: "activity",
                    priority: "required",
                    status: "confirmed",
                    location: "耕三寺博物館",
                    description: "先參觀耕三寺，再依剩餘時間前往未來心之丘。（營業時間：9:00 - 17:00，最後入場：閉館前 30 分）；若時間不足，只保留最想看的區域。或是可以延到隔天上午 9 點",
                    links: [
                        {
                            label: "開啟地圖",
                            url: "https://maps.app.goo.gl/BLmUrATZ2resS9Xb6",
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://www.kousanji.or.jp/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d4-hotel",
                    time: "17:30",
                    title: "ボナプール楽生苑 Check-in",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "ボナプール楽生苑",
                    description: "抵達後先停放單車、辦理入住並整理裝備。確認單車夜間停放位置與隔日早餐安排。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/pe2Sxi8jF7EtsrJY9",
                            kind: "map",
                        },
                    ],
                    highlight: {
                        src: "https://san-tatsu.jp/assets/uploads/2023/06/20171423/22ba2e1cd7c0f61b12eacd0aba8c3281.jpg",
                        alt: "生口島瀨戶田的檸檬自行車與跨海大橋景色",
                        sourceUrl: "https://san-tatsu.jp/articles/246169/",
                        sourceLabel: "散步的達人",
                        placeholderName: "瀨戶田檸檬島",
                    },
                },
                {
                    id: "d4-setoda-beach",
                    time: "17:30–17:45 （路程約 15 min）",
                    title: "ボナプール楽生苑 → 瀨戶田 Sunset beach（約 4 km，平緩）",
                    type: "cycling",
                    priority: "optional",
                    description: "體力還行的話，瀨戶田日落海灘被評為「日本88個最佳海灘」之一",
                    links: [
                        {
                            label: "瀨戶田日落海灘",
                            url: map("瀬戸田サンセットビーチ"),
                            kind: "map",
                        },
                    ],
                    highlight: {
                        src: "https://s3.ap-northeast-1.amazonaws.com/production.guidoor.jp/images/IIyzn0S1kxLupwy5jt16SqW9a6vYnW935GSXJjsI.jpeg",
                        alt: "瀨戶田日落海灘",
                        sourceUrl: "https://www.gltjp.com/zh-hant/article/item/20108/#zh-14-191",
                        sourceLabel: "尾道該怎麼玩",
                        placeholderName: "瀨戶田日落海灘",
                    },
                },
                {
                    id: "d4-dinner",
                    time: "18:30–19:30",
                    title: "瀨戶田晚餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "再查 tabelog，以住宿或瀨戶田港周邊為主。島上餐廳可能較早結束營業。",
                },
                {
                    id: "d4-sunset-walk",
                    time: "晚餐後",
                    title: "瀨戶田黃昏散步",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    location: "瀨戶田港周邊",
                    description: "沿港口或商店街短程散步放鬆雙腿。天色已暗或身體疲勞時直接回住宿休息。",
                    links: [
                        {
                            label: "瀨戶田港地圖",
                            url: map("瀬戸田港"),
                            kind: "map",
                        },
                    ],
                },
            ],
            contingencies: [
                "雨勢或強風不適合騎乘時，先向租車與住宿方確認取消、延後或替代交通。",
                "10:15 尚未抵達岩子島鳥居時縮短拍照停留；體力或天候不佳時原路返回向島，不繞行岩子島一周。",
                "12:00 尚未抵達因島水軍城時縮短參觀；13:20 尚未抵達大山神社時只快速參拜，不購物或等待御朱印。",
                "土生港午餐排隊超過 15 分鐘時改吃可快速供餐的店家或便利商店補給，15:00 必須開始往生口橋移動。",
                "16:30 尚未抵達瀨戶田時取消咖啡甜點，直接前往住宿。",
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
            weather: {
                location: "廣島/尾道",
                condition: "陰天時晴",
                precipitationProbability: 30,
                morningCelsius: "30°",
                nightCelsius: "22°",
                link: "https://www.jma.go.jp/bosai/#pattern=forecast&area_type=class20s&area_code=3420500",
            },
            cycling: {
                label: "SHIMANAMI RIDE 2/3",
                route: "生口島 → 大三島 → 伯方島",
                distance: "約 33 km",
                rideWindow: `08:30 出發
                9:40 進入大三島
                15:30 進入伯方島，並抵達住宿`,
                routeImage: {
                    src: "https://cdn.josephtseng-tw.com/travel-split/2026-shimanami/day2-route.jpg",
                    alt: "Day2 route",
                }
            },
            note: "今天以橋景、神社與海岸風景為主。空出的時間改為放慢大三島至伯方島的騎行節奏，時間放多一點在神社還有大三島南岸，提早 check in 後，再繼續往南玩，吃吃喝喝並尋找晚餐",
            events: [
                {
                    id: "d5-breakfast",
                    time: "07:30–08:15",
                    title: "早餐與騎行準備",
                    type: "food",
                    priority: "required",
                    status: "informational",
                    location: "ボナプール楽生苑／瀨戶田",
                    description: "吃足早餐並補滿飲水，檢查胎壓、煞車、變速與隨身補給。今天會繞行大三島南岸，出發前先準備防曬與能量食品。",
                },
                {
                    id: "d5-depart",
                    time: "08:30",
                    title: "瀨戶田出發",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "生口島",
                },
                {
                    id: "d5-park",
                    time: "08:30 - 09:00",
                    title: "潮音山公園",
                    type: "cycling",
                    priority: "optional",
                    status: "informational",
                    location: "生口島",
                    description: "俯瞰瀨戶田港，可遠眺建於15世紀初的紅漆三重塔－興上寺。",
                    links: [
                        {
                            label: "潮音山公園",
                            url: "https://maps.app.goo.gl/ZeUzKh9iXjmLxshM7",
                            kind: "map",
                        },
                    ],
                    options: [
                        {
                            id: "d4-kosanji",
                            title: "耕三寺與未來心之丘",
                            description: "營業時間: 9:00 - 17:00，若前一天來不及參觀，也可以安排今天",
                            links: [
                                {
                                    label: "開啟地圖",
                                    url: "https://maps.app.goo.gl/BLmUrATZ2resS9Xb6",
                                    kind: "map",
                                },
                                {
                                    label: "官方網站",
                                    url: "https://www.kousanji.or.jp/",
                                    kind: "official",
                                },
                            ],
                        }
                    ]
                },
                {
                    id: "d5-tatara-bridge",
                    time: "09:00–09:40 （路程約 20 min）",
                    title: "瀨戶田 → 多多羅大橋 （7 km，平緩）",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "多多羅大橋",
                    description: "停留約 20–30 分鐘看橋下海面、往來船隻與島嶼層次。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("多々羅大橋 自転車道"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d5-tatara-park",
                    time: "09:40–10:20",
                    title: "多多羅しまなみ公園",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "道の駅 多々羅しまなみ公園",
                    description: "這裡是島波海道上設施最完善的「自行車綠洲」休息站之一，可以欣賞到多多良橋的壯麗景色，還有綠茵的草坪，是在溫暖晴朗的日子裡放鬆身心的絕佳去處。趣味十足的自行車停車架",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("道の駅 多々羅しまなみ公園"),
                            kind: "map",
                        },
                    ],
                    options: [
                        {
                            id: "d5-wakka-cafe",
                            title: "Wakka Cafe",
                            description: "想喝咖啡可以考慮",
                            links: [
                                {
                                    label: "查看地圖",
                                    url: "https://maps.app.goo.gl/xbpLeDU57PkWZfRm7",
                                    kind: "map",
                                },
                            ],
                        }
                    ],
                },
                {
                    id: "d5-omishima-south",
                    time: "10:20–11:00 （路程約 20 min）",
                    title: "多多羅しまなみ公園 → 大山祇神社 (6 km，小爬坡)",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "大三島南岸",
                    description: "離開多多羅後沿南岸穩定前進，欣賞海岸、聚落與果園風景。這段以節奏順暢為主，為大山祇神社與午後前往伯方島保留體力。",
                },
                {
                    id: "d5-shrine",
                    time: "11:00–12:15",
                    title: "大山祇神社",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "大山祇神社",
                    description: "停放單車後慢慢走進神社境內，參拜本殿並感受古木與森林包圍的空間。預留約 75 分鐘，不需要用趕景點的方式參觀。",
                    links: [{ label: "開啟地圖", url: map("大山祇神社"), kind: "map" }],
                    highlight: {
                        src: "https://oomishimagu.jp/wp/wp-content/uploads/2020/10/ogp-3.jpg",
                        alt: "大三島大山祇神社的本殿與森林境內",
                        sourceUrl: "https://oomishimagu.jp/",
                        sourceLabel: "大山祇神社",
                        placeholderName: "大山祇神社本殿",
                    },
                },
                {
                    id: "d5-lunch",
                    time: "12:30–13:30",
                    title: "大三島午餐",
                    type: "food",
                    priority: "required",
                    description: "依當日營業、餐點供應與移動方向選擇。不要為指定店家長時間等待，13:30 左右需準備往伯方島方向前進。",
                    options: [
                        {
                            id: "d5-lunch-yoshikawa",
                            title: "Yoshikawa",
                            description: "定食、丼飯與咖啡甜點，位於大三島港附近。",
                            links: [
                                {
                                    label: "查看地圖",
                                    url: map("大三島 Yoshikawa ランチ"),
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d5-lunch-2",
                            title: "うみまちバル アメリ",
                            description: "義大利麵、燉飯與咖啡甜點，位於大三島港附近，店內氛圍舒適。",
                            links: [
                                {
                                    label: "查看地圖",
                                    url: "https://maps.app.goo.gl/BGNPc9nfN2gk6x1S6",
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d5-tokoro-museum",
                    time: "Pass",
                    title: "Tokoro Museum Omishima（週一休館）",
                    type: "activity",
                    status: "cancelled",
                    compact: true,
                    location: "ところミュージアム大三島",
                    description: "6/29（週一）休館",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("ところミュージアム大三島"),
                            kind: "map",
                        },
                        {
                            label: "官網",
                            url: "https://www.city.imabari.ehime.jp/museum/tokoro/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d5-hakata-arrival",
                    time: "13:30–15:00 (路程約 45-60 min)",
                    title: "大三島南岸 → 伯方島 → HANAGURI Check-in (15 km，高低起伏)",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "大三島橋／伯方島",
                    description: "午餐後沿大三島南岸往大三島橋前進，再跨橋進入伯方島，經過旅館先 check in。",
                    links: [
                        {
                            label: "路徑圖",
                            url: directions(
                                "Seafood Restaurant Yoshikawa, 5714-15 Omishimacho Miyaura, Imabari, Ehime 794-1304日本",
                                "HANAGURI, 日本〒794-2303 Ehime, Imabari, Hakatacho Ikata, 甲1817-4",
                                ["大三島サイクリングコース 南回り, 日本〒794-1306 Ehime, Imabari, Omishimacho Nonoe, 7979",
                                "ohmishima Limone, 瀬戸-2342 上浦町 Imabari, Ehime 794-1404日本"],
                            ),
                            kind: "map"
                        }
                    ],
                    options: [
                        {
                            id: "d5-limone",
                            title: "Omishima Limone",
                            description: "選物小店，以大三島柑橘與檸檬產品為特色，適合安排較輕盈的午間停留。",
                            links: [
                                {
                                    label: "查看地圖",
                                    url: map("大三島リモーネ"),
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d5-hotel",
                    time: "15:40",
                    title: "HANAGURI Check-in",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "HANAGURI",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/uLRRpWanX2Vm1Tdd7",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d5-salt-ice-cream",
                    time: "15:00–15:40 (路程約 6 min)",
                    title: "HANAGURI → 伯方鹽冰淇淋 (2km，平緩)",
                    type: "food",
                    priority: "required",
                    status: "confirmed",
                    location: "伯方島",
                    description: "鹹味香草冰淇淋作。營業時間: 10:00 - 17:00",
                    links: [
                        {
                            label: "道の駅 伯方S・Cパーク",
                            url: "https://maps.app.goo.gl/ipFehZDMQ8r66szp9",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d5-hakata-coast",
                    time: "15:40–16:30  (路程約 10 min)",
                    title: "道の駅 伯方 → Patisserie T’s Cafe Tamaya (3km，平緩)",
                    type: "cycling",
                    priority: "optional",
                    status: "informational",
                    location: "伯方島",
                    description: "吃完冰淇淋還有時間的話後往西前行，到 Cafe Tamaya 喝杯咖啡吃甜點，看海景",
                    links: [
                        {
                            label: "Patisserie T’s Cafe Tamaya",
                            url: "https://maps.app.goo.gl/RcnwC4mTedL57jtT8",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d5-dinner",
                    time: "18:00–19:00",
                    title: "伯方島晚餐",
                    type: "food",
                    priority: "required",
                    status: "confirmed",
                    description: "以 HANAGURI 或步行可達的店家為主，避免入住後再次騎遠路。島上晚餐選擇與營業時間有限，建議事前向住宿確認或預約。",
                    options: [
                        {
                            id: "d5-dinner-1",
                            title: "たんぽぽ",
                            description: "大阪燒",
                            links: [
                                {
                                    label: "查看地圖",
                                    url: "https://maps.app.goo.gl/GUaKC3t1tmYVp67S8",
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d5-dinner-2",
                            title: "さんわ 伯方島本店",
                            description: "拉麵",
                            links: [
                                {
                                    label: "查看地圖",
                                    url: "https://maps.app.goo.gl/uDihwDZMPdR6QUJn6",
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d5-dinner-3",
                            title: "魚常梅が花",
                            description: "壽司",
                            links: [
                                {
                                    label: "查看地圖",
                                    url: "https://maps.app.goo.gl/17sJo7LR28sPrFx5A",
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d5-evening-walk",
                    time: "19:00–19:40",
                    title: "海邊散步",
                    type: "activity",
                    priority: "optional",
                    status: "informational",
                    location: "HANAGURI 周邊海岸",
                    description: "晚餐後沿海邊短程散步，看看暮色與港灣，讓雙腿放鬆。天色太暗、下雨或疲勞時直接回住宿休息。",
                },
            ],
            contingencies: [
                "13:30 前未吃完午餐時，減少大三島海岸停留；15:00 尚未進入伯方島則取消伯方鹽冰淇淋，直接前往 HANAGURI。",
                "疲勞、炎熱或逆風明顯時，縮短大山祇神社停留，不再增加大三島或伯方島支線。",
                "雨勢增強時在多多羅しまなみ公園或有商店的聚落先停留，確認後續交通與住宿聯絡方式再移動。",
            ],
        },
        {
            id: "day-6",
            date: "2026-06-30",
            dayLabel: "D6",
            weekday: "週二",
            city: "伯方島 → 今治 → 道後",
            theme: "跨過來島海峽，完成藍線",
            weather: {
                location: "愛媛/今治",
                condition: "陰天",
                precipitationProbability: 40,
                morningCelsius: "27°",
                nightCelsius: "21°",
                link: "https://www.jma.go.jp/bosai/#pattern=forecast&area_type=class20s&area_code=3820200",
            },
            cycling: {
                label: "SHIMANAMI RIDE 3/3",
                route: "伯方島 → 大島 → 來島海峽大橋 → 今治",
                distance: "約 38 km",
                rideWindow: `8:30 伯方島出發
                9:00 進入大島
                13:00 來島海峽大橋
                13:30 抵達今治還車`,
                routeImage: {
                    src: "https://cdn.josephtseng-tw.com/travel-split/2026-shimanami/day3-route.jpg",
                    alt: "Day3 route",
                }
            },
            note: "今天完成島波海道並轉往道後。進入大島走西海岸 Island Explorer；體力充足、天氣與能見度良好時走中央主線加龜老山，時間抓比較寬鬆，13:00 抵達來島大橋即可。抓在 13:30 左右還車然後吃午餐，中途可以準備一些食物。",
            events: [
                {
                    id: "d6-start",
                    time: "08:30",
                    title: "伯方島出發",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "HANAGURI／伯方島",
                    description: "早餐後檢查胎壓、煞車與行李固定，沿主線跨過伯方・大島大橋進入大島。過橋前依腿部疲勞、天氣、能見度與風勢決定大島二選一路線。",
                    warning: "預計 13:30 在今治完成還車；08:30 出發時間才充裕。",
                    links: [
                        {
                            label: "伯方・大島大橋",
                            url: map("伯方・大島大橋 自転車道"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d6-oshima-route-choice",
                    time: "09:00–12:00 (路程約 50 min，抓寬鬆騎)",
                    title: "大島探險者路線到 (17km，小緩坡起伏)",
                    type: "cycling",
                    priority: "required",
                    location: "大島",
                    description: "沿西海岸經過沙灘、漁港、造船廠與來島海峽大橋遠景。",
                    options: [
                        {
                            id: "d6-route-kirosan",
                            title: "龜老山展望公園 (3km，上山爬升 290m)",
                            description: "體力還行、晴天、能見度高且風勢可控時選擇。需要約 3 km 爬升約 300 m，可能要抓 25-40 min；10:15 尚未開始下山時立即折返。",
                            links: [
                                {
                                    label: "龜老山地圖",
                                    url: "https://maps.app.goo.gl/BjbByxCahmeLpNVRA",
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d6-yoshiumi",
                    time: "12:00–12:15",
                    title: "道之駅 よしうみいきいき館",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "道の駅 よしうみいきいき館",
                    description: "完成所選大島路線後，在進入來島海峽大橋前快速補水、上廁所並確認橋面風勢。可從港邊看大橋全景，但不要因購物或用餐拖延上橋時間。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("道の駅 よしうみいきいき館"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d6-bridge",
                    time: "12:15–13:00",
                    title: "來島海峽大橋完騎",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "來島海峽大橋",
                    description: "預留 30–45 分鐘通過全線規模最大的跨海大橋。這一段最有完成感，可看到壯觀海流、船隻與島嶼交錯；在安全停靠處拍照，留時間感受最後一座橋。",
                    warning: "注意橋面強風。",
                    links: [{ label: "開啟地圖", url: map("來島海峽大橋"), kind: "map" }],
                    highlight: {
                        src: "https://www.honda.co.jp/content/dam/site/www/outdoor/cq_img/trip/shimanami/day3/img_day03_01.jpg",
                        alt: "騎乘自行車通過來島海峽大橋",
                        sourceUrl:
                            "https://www.honda.co.jp/outdoor/trip/shimanami/day3/day3-03.html",
                        sourceLabel: "Honda Outdoor",
                        placeholderName: "來島海峽大橋騎行",
                    },
                },
                {
                    id: "d6-imabari-arrival",
                    time: "13:00–13:30 (路程約 30 min)",
                    title: "來島海峽大橋 → 今治市區 (10km，平緩)",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    description: "下橋後沿藍線完成最後一段市區騎行。進入市區後注意路口、車流與行人。",
                },
                {
                    id: "d6-return",
                    time: "13:30",
                    title: "今治還車",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    location: "今治駅前サイクリングターミナル",
                    description: "依租車規定歸還單車與配件，確認個人物品、行李與還車手續都完成。簡單整理後直接準備前往松山。",
                    links: [
                        {
                            label: "開啟還車地圖",
                            url: "https://maps.app.goo.gl/eyJsaU54HZDFDpWLA",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d6-lunch",
                    time: "12:30–13:10",
                    title: "白樂天 今治本店：燒豬玉子飯",
                    type: "food",
                    priority: "recommended",
                    status: "to-confirm",
                    location: "白樂天 今治本店",
                    description: "到白樂天品嚐今治名物燒豬玉子飯，為完成島波海道慶祝。餐廳距離還車點仍需預留移動時間，12:30 尚未入座時改找能快速用餐的店家。",
                    warning: "13:10 前離店前往還車；熱門店排隊過長時不要等待。",
                    links: [
                        {
                            label: "開啟餐廳地圖",
                            url: "https://maps.app.goo.gl/q5gMyJ5WC6ZDxgQE8",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d6-transfer",
                    time: "14:30 起",
                    title: "今治 → 道後溫泉交通二選一",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "還車後依實際班次選擇 JR 或瀨戶內巴士。JR 需在松山轉乘；巴士可減少轉乘，但會影響道後やや Check-in 時間。",
                    options: [
                        {
                            id: "d6-transfer-jr",
                            title: "JR：今治 → 松山 → 道後溫泉",
                            description: "搭 JR 前往松山，再轉乘市內電車或其他交通到道後溫泉。適合希望較早抵達、保留 16:00 左右 Check-in 的安排。",
                            links: [
                                {
                                    label: "路線地圖",
                                    url: directions("今治車站", "道後やや"),
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d6-transfer-bus",
                            title: "巴士：(特急)今治－松山線",
                            description: "可搭瀨戶內巴士前往道後。已知末班為 16:09 出發、17:07 抵達，約 1 小時 4 分鐘；搭末班時入住會順延至 17:15 後。",
                            links: [
                                {
                                    label: "官方時刻表",
                                    url: "https://www.setouchibus.co.jp/timetable/timetable/",
                                    kind: "official",
                                },
                                {
                                    label: "路線地圖",
                                    url: directions("今治車站", "道後やや"),
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                    warning: "巴士班次與末班時間可能調整，出發前須重新確認官方時刻表；不要只依行程頁上的 16:09 班次。",
                },
                {
                    id: "d6-dogo",
                    time: "16:00–17:30",
                    title: "道後やや Check-in",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "道後やや",
                    description: "辦理入住、放下行李並整理三天騎行裝備。先確認館內浴場或道後溫泉本館的入浴方式、營業時間與是否需要預約。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/ihR9zW52f8GP7ZKY7",
                            kind: "map",
                        },
                    ],
                    highlight: {
                        src: "https://dogo.jp/wp-content/uploads/2017/01/slide_01.jpg",
                        alt: "道後溫泉本館的木造建築外觀",
                        sourceUrl: "https://dogo.jp/en/honkan.php",
                        sourceLabel: "道後溫泉官方網站",
                        placeholderName: "道後溫泉本館",
                    },
                },
                {
                    id: "d6-dogo-shopping-street",
                    time: "18:00–19:00",
                    title: "道後商店街散步",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "道後ハイカラ通り",
                    description: "沿道後商店街慢走，看看伴手禮、甜點與溫泉街建築。三天騎行結束後以放鬆為主，不安排需要再爬坡的景點。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("道後ハイカラ通り"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d6-dinner",
                    time: "19:00–20:30",
                    title: "道後晚餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "在道後商店街或道後やや附近吃晚餐，補充蛋白質、碳水與水分。避免選擇距離太遠的餐廳，把時間留給晚間泡湯。",
                },
                {
                    id: "d6-onsen",
                    time: "21:00",
                    title: "溫泉放鬆",
                    type: "activity",
                    priority: "required",
                    status: "confirmed",
                    location: "道後溫泉",
                    description: "整修五年半，在 2024/7/11 全面重新開放。溫泉本館營業時間，神の湯：06:00 – 23:00",
                    links: [
                        {
                            label: "道後溫泉本館",
                            url: "https://maps.app.goo.gl/s5cc6v87Z129ZLzb9",
                            kind: "map",
                        },
                        {
                            label: "道後溫泉本館",
                            url: "https://dogo.jp/en/honkan.php",
                            kind: "official",
                        },
                    ],
                },
            ],
            contingencies: [
                "Island Explorer 與龜老山只能二選一；出發晚、腿部疲勞、炎熱、逆風或能見度差時選 Island Explorer。",
                "選龜老山時，10:15 尚未開始下山就立即折返；不要為登頂延誤後續行程。",
                "10:45 尚未抵達吉海一帶時，取消道之駅停留並直接前往來島海峽大橋，確保 13:30 還車。",
                "午餐候位超過 15 分鐘時改吃快速餐點，燒豬玉子飯可留作備選，不延誤還車與 14:30 前往松山。",
                "強風或豪雨時不要勉強通過長橋，先在安全地點聯絡租車方，詢問替代交通或延後還車安排。",
                "抵達道後較晚時先 Check-in，縮短商店街散步；晚餐與 21:00 溫泉優先。",
            ],
        },
        {
            id: "day-7",
            date: "2026-07-01",
            dayLabel: "D7",
            weekday: "週三",
            city: "道後・松山 → 岡山",
            theme: "溫泉城收尾，傍晚回到岡山",
            weather: {
                location: "愛媛/今治",
                condition: "陰天時雨",
                precipitationProbability: 50,
                morningCelsius: "26°",
                nightCelsius: "21°",
                link: "https://www.jma.go.jp/bosai/#pattern=forecast&area_type=class20s&area_code=3820200",
            },
            note: "今天從道後一路逛到松山市中心，17:00 左右要搭到しおかぜ往岡山。",
            events: [
                {
                    id: "d7-breakfast",
                    time: "07:30–08:15",
                    title: "道後やや早餐",
                    type: "food",
                    priority: "required",
                    status: "informational",
                    location: "道後やや",
                    description: "悠閒吃早餐並整理行李，確認退房後是否可寄放。今天步行與移動較多，出門前補滿飲水並再次確認 17:00 左右的列車班次。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/ihR9zW52f8GP7ZKY7",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d7-dogo-morning-walk",
                    time: "08:30–09:00",
                    title: "道後溫泉晨間散步",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "道後溫泉街",
                    description: "趁商店尚未完全熱鬧前看看溫泉街、道後溫泉站與周邊老建築。以輕鬆散步為主，替昨晚沒有看清楚的街景補拍照片。",
                    links: [{ label: "開啟地圖", url: map("道後溫泉本館"), kind: "map" }],
                },
                {
                    id: "d7-shopping-street",
                    time: "09:00–09:30",
                    title: "道後商店街",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "道後ハイカラ通り",
                    description: "逛伴手禮、柑橘甜點與溫泉小物。先以瀏覽為主，體積較大的採買留到確認行李安排後再決定。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("道後ハイカラ通り"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d7-isaniwa",
                    time: "09:30–10:15",
                    title: "伊佐爾波神社",
                    type: "activity",
                    priority: "required",
                    status: "informational",
                    location: "伊佐爾波神社",
                    description: "從鮮紅色樓門與長石階進入神社，慢慢參拜並欣賞鮮明的社殿建築。連續騎行後若雙腿疲勞，石階不要勉強趕速度。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("伊佐爾波神社"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d7-dogo-honkan",
                    time: "10:30–11:30",
                    title: "道後溫泉本館",
                    type: "activity",
                    priority: "optional",
                    location: "道後溫泉本館",
                    description: "近距離欣賞本館外觀與歷史空間，依預約、候位與當日營運狀況決定是否再次入浴。若只參觀外觀，可把多出的時間留給咖啡。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("道後温泉本館"),
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://dogo.jp/en/honkan.php",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d7-coffee",
                    time: "11:30–12:15",
                    title: "白鷺珈琲",
                    type: "food",
                    priority: "optional",
                    status: "confirmed",
                    location: "道後溫泉",
                    description: "本館參觀順利且時間充足時加入，喝杯咖啡、稍作休息並整理上午採買。若候位較久或午餐已餓，直接取消。營業時間：每日 09:00 – 18:00",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("白鷺珈琲 道後"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d7-lunch",
                    time: "12:30–13:20",
                    title: "愛媛鯛魚飯午餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    location: "道後／松山市區",
                    description: "選擇愛媛代表料理鯛魚飯，可依喜好選松山式炊飯或宇和島式生魚片拌蛋汁。熱門店若排隊過久，改選附近能準時用餐的店家。",
                    warning: "13:20 左右結束午餐並移動，避免壓縮下午景點與前往松山站的時間。",
                    links: [
                        {
                            label: "搜尋鯛魚飯",
                            url: map("松山 鯛めし"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d7-afternoon-main",
                    time: "13:30–15:30",
                    title: "松山城／萬翠莊二選一",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    description: "依天氣、腿部疲勞與剩餘時間選擇一處，不建議兩個都趕。",
                    options: [
                        {
                            id: "d7-matsuyama-castle",
                            title: "晴天：松山城",
                            description: "天氣穩定、體力足夠時前往。可搭纜車或吊椅減少爬升，再從本丸眺望松山市區；15:30 前開始下山。",
                            links: [
                                {
                                    label: "開啟地圖",
                                    url: map("松山城"),
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d7-bansuiso",
                            title: "雨天或疲勞：萬翠莊",
                            description: "不想爬山時改看法式洋館、室內裝飾與歷史空間，步行負擔較低，也較容易控制參觀時間。",
                            links: [
                                {
                                    label: "開啟地圖",
                                    url: map("萬翠荘 松山"),
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d7-late-afternoon",
                    time: "15:30–16:15",
                    title: "大街道／坂上之雲博物館",
                    type: "activity",
                    priority: "optional",
                    status: "to-confirm",
                    description: "回松山站方向移動時依剩餘時間擇一。16:15 必須開始前往車站，不因參觀延誤列車。",
                    options: [
                        {
                            id: "d7-okaido",
                            title: "大街道散步",
                            description: "沿商店街輕鬆散步、補充車上飲水與零食，時間最好控制，也方便隨時轉往松山站。",
                            links: [
                                {
                                    label: "開啟地圖",
                                    url: map("大街道 松山"),
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d7-sakanoue",
                            title: "坂上之雲博物館",
                            description: "喜歡建築與安藤忠雄空間時選擇。需先確認週三開館、最後入館時間，並將參觀控制在不影響列車的範圍內。",
                            links: [
                                {
                                    label: "開啟地圖",
                                    url: map("坂の上の雲ミュージアム"),
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d7-station",
                    time: "16:15–17:00",
                    title: "前往松山站／取票候車",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    location: "JR 松山站",
                    description: "預留市內移動、取指定席車票、確認月台與購買車上飲水的時間。建議事先劃位，不要把抵達車站時間壓在發車前。",
                    links: [
                        {
                            label: "松山站地圖",
                            url: map("JR 松山駅"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d7-transfer",
                    time: "17:00–20:00",
                    title: "搭乘しおかぜ返回岡山",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    location: "松山 → 岡山",
                    description: "搭乘特急しおかぜ跨過瀨戶大橋返回岡山，全程約 2.5–3 小時。車上可休息並整理照片，抵達前確認晚餐與住宿方向。",
                    warning: "出發前重新確認 2026 年 7 月 1 日實際班次、指定席、末班車與抵達岡山時間；17:00 為行程目標，不代表已確認的固定班次。",
                    links: [
                        {
                            label: "JR 四國列車資訊",
                            url: "https://www.jr-shikoku.co.jp/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d7-dinner",
                    time: "20:00–20:50",
                    title: "岡山晚餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    location: "岡山站周邊",
                    description: "抵達後在岡山站或住宿方向快速用餐。若列車延誤或餐廳即將打烊，先購買外帶餐點再辦理入住。",
                    links: [
                        {
                            label: "岡山站附近晚餐",
                            url: map("岡山駅 晩ごはん"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d7-hotel",
                    time: "21:00",
                    title: "Hotel Abest Grande Okayama Check-in",
                    type: "lodging",
                    priority: "required",
                    status: "confirmed",
                    location: "Hotel Abest Grande Okayama",
                    description: "辦理入住並整理隔日搭機行李，確認早餐、退房時間與前往岡山機場的巴士安排。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/XV1ghKiSbX7jRYfn9",
                            kind: "map",
                        },
                    ],
                },
            ],
            contingencies: [
                "下雨、炎熱或腿部疲勞時取消松山城，改去萬翠莊；兩者都不勉強加入。",
                "午餐後進度落後時，下午只保留大街道短程散步，取消松山城、萬翠莊與坂上之雲博物館。",
                "15:30 尚未離開主要景點時，取消 16:00 行程並直接前往松山站。",
                "しおかぜ指定席售罄時確認自由席或其他可行班次，但 7 月 1 日必須完成前往岡山的跨海移動。",
                "列車延誤導致 20:00 後抵達岡山時，先買外帶晚餐並聯絡 Hotel Abest Grande Okayama 確認最晚 Check-in。",
            ],
        },
        {
            id: "day-8",
            date: "2026-07-02",
            dayLabel: "D8",
            weekday: "週四",
            city: "岡山 → 回家",
            theme: "庭園與咖啡收尾，從容前往機場",
            note: "後樂園為上午主行程，岡山城與奉還町依狀況取捨。14:00 要回飯店取行李、14:30 前往岡山站西口。",
            events: [
                {
                    id: "d8-breakfast",
                    time: "08:00–08:45",
                    title: "Hotel Abest Grande Okayama 早餐",
                    type: "food",
                    priority: "required",
                    status: "informational",
                    location: "Hotel Abest Grande Okayama",
                    description: "最後確認護照、機票、充電設備與行李重量。早餐後把不再使用的物品收妥，隨身保留防曬、飲水與貴重物品。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/XV1ghKiSbX7jRYfn9",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d8-checkout",
                    time: "09:00",
                    title: "Check-out／寄放行李",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    location: "Hotel Abest Grande Okayama",
                    description: "完成退房後將大件行李寄放櫃台，只帶上午散步需要的隨身物品。再次確認 14:00 前可以取回行李。",
                },
                {
                    id: "d8-korakuen",
                    time: "09:30–10:50",
                    title: "岡山後樂園",
                    type: "activity",
                    priority: "required",
                    location: "岡山後樂園",
                    description: "開放：7:00 - 17:45。沿池泉、草地與借景慢慢散步，從園內欣賞岡山城與旭川景色。上午相對涼爽，優先完成主要庭園路線，不必每條支線都走。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("岡山後楽園"),
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://okayama-korakuen.jp/",
                            kind: "official",
                        },
                    ],
                    highlight: {
                        src: "https://static.gltjp.com/glt/data/article/21000/20351/20230731_152229_2c82a461_w1920.webp",
                        alt: "岡山後樂園的池泉、草地與岡山城借景",
                        sourceUrl: "https://okayama-korakuen.jp/",
                        sourceLabel: "岡山後樂園",
                        placeholderName: "岡山後樂園",
                    },
                },
                {
                    id: "d8-castle",
                    time: "11:00–11:50",
                    title: "岡山城",
                    type: "activity",
                    priority: "optional",
                    location: "岡山城",
                    description: "天守閣開放：9:00 - 17:30。從後樂園跨過月見橋前往岡山城。時間與體力充足時入館參觀；若天氣炎熱、下雨或後樂園停留較久，只看外觀並直接前往午餐。",
                    warning: "11:50 前離開，避免壓縮午餐與回飯店取行李時間。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("岡山城"),
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://okayama-castle.jp/",
                            kind: "official",
                        },
                    ],
                    highlight: {
                        src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSip5KHq4lMNiXeC2abqZ5s9R8jqmw8b-n1uw&s",
                        alt: "岡山後樂園的池泉、草地與岡山城借景",
                        sourceUrl: "https://okayama-castle.jp/home-tw/",
                        sourceLabel: "岡山城",
                        placeholderName: "岡山城",
                    },
                },
                {
                    id: "d8-lunch",
                    time: "12:00–12:50",
                    title: "岡山特色午餐二選一",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "依店家候位與返回岡山站的動線選擇。12:50 前結束午餐，保留咖啡、採買與取行李時間。",
                    options: [
                        {
                            id: "d8-lunch-demikatsu",
                            title: "デミかつ丼",
                            description: "岡山代表性的多蜜醬豬排丼，想吃濃郁、份量完整的午餐時選擇。",
                            links: [
                                {
                                    label: "搜尋餐廳",
                                    url: map("岡山 デミカツ丼"),
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d8-lunch-barazushi",
                            title: "岡山ばら寿司／散壽司",
                            description: "以海鮮、蔬菜與醋飯組成的岡山鄉土料理，想吃較清爽又有地方特色時選擇。",
                            links: [
                                {
                                    label: "搜尋餐廳",
                                    url: map("岡山 ばら寿司"),
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d8-coffee-shopping",
                    time: "13:00–13:50",
                    title: "ONSAYA COFFEE／奉還町商店街",
                    type: "food",
                    priority: "recommended",
                    status: "to-confirm",
                    description: "回飯店方向安排最後一段咖啡與散步，依時間選擇其中一項或短暫組合，13:50 必須開始返回飯店。",
                    options: [
                        {
                            id: "d8-onsaya",
                            title: "ONSAYA COFFEE",
                            description: "喝杯咖啡休息，也可選購咖啡豆作為伴手禮。購買前確認包裝與行李空間，不要因現場等待延誤取行李。",
                            links: [
                                {
                                    label: "開啟地圖",
                                    url: map("ONSAYA COFFEE 岡山"),
                                    kind: "map",
                                },
                            ],
                        },
                        {
                            id: "d8-hokancho",
                            title: "奉還町商店街",
                            description: "沿岡山站西側的老商店街短程散步，看看在地小店與街區氛圍；以靠近飯店和車站的路段為主。",
                            links: [
                                {
                                    label: "開啟地圖",
                                    url: map("奉還町商店街"),
                                    kind: "map",
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "d8-luggage",
                    time: "14:00–14:20",
                    title: "回飯店取行李",
                    type: "task",
                    priority: "required",
                    status: "confirmed",
                    location: "Hotel Abest Grande Okayama",
                    description: "取回寄放行李，確認護照、錢包、手機與伴手禮都已收妥。離開前快速檢查行李件數。",
                    links: [
                        {
                            label: "開啟住宿地圖",
                            url: "https://maps.app.goo.gl/XV1ghKiSbX7jRYfn9",
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d8-bus-stop",
                    time: "14:30",
                    title: "前往岡山站西口巴士站",
                    type: "transport",
                    priority: "required",
                    status: "informational",
                    location: "岡山站西口",
                    description: "提早抵達機場巴士乘車處，確認月台、購票方式與行李放置規則。不要等到巴士進站才找站牌。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("岡山駅西口 空港バス"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d8-bus",
                    time: "15:00–15:20",
                    title: "岡山站 → 岡山機場",
                    type: "transport",
                    priority: "required",
                    status: "to-confirm",
                    description: "搭乘機場巴士前往岡山桃太郎機場，車程約 30–40 分鐘，依班次與路況可能變動。",
                    warning: "15:00–15:20 是目標搭乘區間，不代表已確認班次。前一晚重新核對 2026 年 7 月 2 日官方時刻，若班次不合則提早出發。",
                    links: [
                        {
                            label: "機場交通",
                            url: "https://www.okayama-airport.org/tw/access/bus",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d8-airport",
                    time: "15:40–17:20",
                    title: "抵達岡山機場／國際線報到",
                    type: "task",
                    priority: "required",
                    status: "informational",
                    location: "岡山桃太郎機場",
                    description: "抵達後辦理報到、托運行李、安檢與出境。完成手續後再安排最後採買與休息，17:20 前抵達登機門附近。",
                    warning: "航空公司報到截止時間優先於本行程估算；出發前依機票與航空公司通知確認。",
                    links: [
                        {
                            label: "機場地圖",
                            url: map("岡山桃太郎空港"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d8-flight",
                    time: "17:55–20:00",
                    title: "岡山起飛／抵達台灣",
                    type: "transport",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山 → 台灣",
                    description: "17:55 從岡山起飛，預計 20:00 抵達台灣。抵達後依序完成入境、領取行李與返家交通。",
                },
            ],
            contingencies: [
                "下雨或上午進度落後時取消岡山城，只保留後樂園與午餐。",
                "12:30 尚未開始午餐時取消咖啡與奉還町，吃完直接回飯店取行李。",
                "13:50 前無法回到飯店方向時立即叫車或搭乘大眾交通，不再步行逛街。",
                "官方機場巴士時刻不符合 15:00–15:20 區間時，以能滿足航空公司國際線報到要求的更早班次為準。",
                "巴士延誤或道路壅塞風險較高時，向飯店或車站服務人員確認計程車等替代交通。",
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
