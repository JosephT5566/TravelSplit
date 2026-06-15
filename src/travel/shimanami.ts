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
            theme: "16:30 抵達，先安頓住宿再安排一段市區行程",
            note: "時間為含轉乘與步行的保守估算。第一晚以 Check-in、Montbell 與晚餐為主；咖啡不排入正式行程。",
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
                    status: "to-confirm",
                    location: "岡山市中心",
                    description: "從住宿前往約 20–25 分鐘，保留約 30–35 分鐘購物。出發前先確認當日營業時間；若 18:40 尚未完成 Check-in，改到其他日期。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: "https://maps.app.goo.gl/uwA7Tu6g8KNVJ4VQA",
                            kind: "map",
                        },
                    ],
                },
                // {
                //     id: "d1-coffee",
                //     time: "本日不安排",
                //     title: "咖啡備選清單",
                //     type: "food",
                //     priority: "optional",
                //     status: "informational",
                //     description: "16:30 才抵達，第一天不特別趕咖啡店。保留以下兩間，改在其他岡山市區空檔擇一前往。",
                //     options: [
                //         {
                //             id: "d1-coffee-en",
                //             title: "en. 珈琲焙煎所",
                //             description: "以自家烘焙咖啡為主，適合短暫休息再繼續逛街。",
                //             links: [
                //                 {
                //                     label: "查看 en.",
                //                     url: "https://maps.app.goo.gl/m259JvtWsUzyMjgb7",
                //                     kind: "map",
                //                 },
                //             ],
                //         },
                //         {
                //             id: "d1-coffee-empire",
                //             title: "EMPIRE COFFEE ROASTERS",
                //             description: "另一個咖啡選項，出發前確認當日營業時間。",
                //             links: [
                //                 {
                //                     label: "查看 EMPIRE",
                //                     url: "https://maps.app.goo.gl/VKhpL8y5ULdMk2Uz5",
                //                     kind: "map",
                //                 },
                //             ],
                //         },
                //     ],
                // },
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
            theme: "神社晨遊、會合與騎行前最後補給",
            note: "18:00 前往尾道的列車是今日硬性截止時間。下午在岡山完成行李整理，16:30 與家人會合後集中採買。",
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
                    title: "家人抵達岡山機場／前往岡山站",
                    type: "transport",
                    priority: "required",
                    status: "confirmed",
                    location: "岡山桃太郎機場 → 岡山站",
                    description: "15:05 班機抵達。預留領行李、候車與約 30 分鐘機場巴士車程，目標 16:20 前抵達岡山站。",
                    warning: "班機或巴士延誤時即時聯絡；Montbell 停留時間必須縮短，不能影響 18:00 列車。",
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
                    description: "帶齊所有行李後在岡山站會合，確認前往尾道的車票、月台與 18:00 出發時間。",
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
                    title: "Montbell 與騎行用品最後補給",
                    type: "reminder",
                    priority: "required",
                    status: "to-confirm",
                    description: "集中補齊雨具、防曬、水壺、簡易維修或其他缺少用品。17:30 開始結帳，17:45 必須離店前往月台。",
                    warning: "18:00 列車優先。若家人延誤，改在岡山站或尾道購買必要補給，不等待完整逛店。",
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
                    description: "搭乘 JR 前往尾道，預留約 1 小時 20 分鐘含可能轉乘與從車站前往住宿的時間。",
                    links: [
                        {
                            label: "尾道站地圖",
                            url: map("尾道站"),
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
                "家人 16:30 後才抵達岡山站時，取消或縮短 Montbell，直接準備搭乘 18:00 列車。",
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
            cycling: {
                label: "SHIMANAMI RIDE",
                route: "尾道 → 向島 → 因島 → 生口島・瀨戶田",
                distance: "約 35–40 km",
                rideWindow: "09:00 渡船 · 18:00 Check-in",
                progress: 34,
                startLabel: "尾道",
                endLabel: "今治",
            },
            note: "第一天以熟悉車況與穩定配速為主。16:00 後景點須依實際開館與最後入場時間調整，18:00 前抵達住宿。",
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
                    location: "尾道港周邊租車點",
                    description: "確認車架尺寸、座墊高度、煞車、變速、胎壓、車燈與鎖具。試騎後再出發，並確認還車地點與緊急聯絡方式。",
                    warning: "任何煞車、輪胎或變速異常都要在離開租車點前處理。",
                    links: [
                        {
                            label: "租車點地圖",
                            url: map("尾道港 單車租借"),
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
                    description: "牽車搭乘渡船前往向島，抵達後沿島波海道藍線開始騎行。",
                    links: [{ label: "開啟地圖", url: map("尾道渡船 向島"), kind: "map" }],
                },
                {
                    id: "d4-mukaishima",
                    time: "09:15–10:15",
                    title: "向島海岸慢騎",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "向島",
                    description: "沿海岸與藍線以輕鬆速度前進，利用第一小時熟悉車況、隊伍間距與補水節奏。",
                    highlight: {
                        src: "https://www.japan-guide.com/g19/3478_12.jpg",
                        alt: "島波海道自行車道沿著瀨戶內海跨越島嶼",
                        sourceUrl: "https://www.japan-guide.com/e/e3478.html",
                        sourceLabel: "Japan Guide",
                        placeholderName: "島波海道跨海自行車道",
                    },
                },
                {
                    id: "d4-innoshima-bridge",
                    time: "10:15–10:45",
                    title: "因島大橋入口展望與補水",
                    type: "activity",
                    priority: "recommended",
                    status: "informational",
                    location: "因島大橋入口",
                    description: "在上橋前短暫休息、拍照並補水。確認風勢與體力後再進入橋面爬升。",
                    links: [
                        {
                            label: "因島大橋地圖",
                            url: map("因島大橋 自転車道"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d4-innoshima",
                    time: "10:45–12:00",
                    title: "因島騎行",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "因島",
                    description: "通過因島大橋後沿主線前進。保持能交談的配速，午餐前不要為追速度耗盡體力。",
                },
                {
                    id: "d4-lunch",
                    time: "12:00–13:00",
                    title: "因島午餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "選擇容易消化、能補充碳水與鹽分的餐點，同時補滿飲水。避免排隊過久壓縮下午行程。",
                    links: [
                        {
                            label: "附近午餐",
                            url: map("因島 ランチ"),
                            kind: "map",
                        },
                    ],
                },
                {
                    id: "d4-manda",
                    time: "13:00–14:00",
                    title: "萬田發酵",
                    type: "activity",
                    priority: "recommended",
                    status: "to-confirm",
                    location: "萬田發酵 HAKKO PARK",
                    description: "安排約一小時參觀與休息。出發前確認當日開放資訊；進度落後時縮短停留，優先確保安全抵達瀨戶田。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("万田発酵 HAKKO PARK"),
                            kind: "map",
                        },
                        {
                            label: "官方網站",
                            url: "https://www.hakkopark.com/",
                            kind: "official",
                        },
                    ],
                },
                {
                    id: "d4-ikuchi-bridge",
                    time: "14:00–15:00",
                    title: "因島 → 生口橋 → 生口島",
                    type: "cycling",
                    priority: "required",
                    status: "informational",
                    location: "生口橋",
                    description: "離開因島後爬升至生口橋，過橋進入生口島。橋前主動補水，橋面遇強風時降低速度並拉開距離。",
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
                    time: "15:00–16:00",
                    title: "瀨戶田咖啡與甜點",
                    type: "food",
                    priority: "recommended",
                    status: "informational",
                    location: "瀨戶田商店街",
                    description: "用咖啡、檸檬甜點或冰品恢復體力，並確認耕三寺最後入場時間。若已接近關館，休息後直接前往景點。",
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
                    time: "16:00–18:00",
                    title: "耕三寺與未來心之丘",
                    type: "activity",
                    priority: "recommended",
                    status: "to-confirm",
                    location: "耕三寺博物館",
                    description: "先參觀耕三寺，再依剩餘時間前往未來心之丘。此時段可能接近最後入場或閉館，務必事前確認；時間不足時只保留一處。",
                    warning: "17:30 前離開景點並前往住宿，不因拍照延誤 Check-in 或進入夜騎。",
                    links: [
                        {
                            label: "開啟地圖",
                            url: map("耕三寺 未来心の丘"),
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
                    time: "18:00",
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
                    id: "d4-dinner",
                    time: "18:30–19:30",
                    title: "瀨戶田晚餐",
                    type: "food",
                    priority: "required",
                    status: "to-confirm",
                    description: "以住宿或瀨戶田港周邊為主。島上餐廳可能較早結束營業，抵達前先確認晚餐地點或預約。",
                    links: [
                        {
                            label: "附近晚餐",
                            url: map("瀬戸田 晩ごはん"),
                            kind: "map",
                        },
                    ],
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
                "13:00 後進度落後時先取消萬田發酵；15:30 尚未抵達瀨戶田時取消咖啡與耕三寺，直接前往住宿。",
                "耕三寺已停止入場時不等待，改在瀨戶田休息並提早 Check-in。",
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
                    highlight: {
                        src: "https://oomishimagu.jp/wp/wp-content/uploads/2020/10/ogp-3.jpg",
                        alt: "大三島大山祇神社的本殿與森林境內",
                        sourceUrl: "https://oomishimagu.jp/",
                        sourceLabel: "大山祇神社",
                        placeholderName: "大山祇神社本殿",
                    },
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
                    highlight: {
                        src: "https://dogo.jp/wp-content/uploads/2017/01/slide_01.jpg",
                        alt: "道後溫泉本館的木造建築外觀",
                        sourceUrl: "https://dogo.jp/en/honkan.php",
                        sourceLabel: "道後溫泉官方網站",
                        placeholderName: "道後溫泉本館",
                    },
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
