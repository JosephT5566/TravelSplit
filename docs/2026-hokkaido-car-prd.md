# 2026 北海道自駕旅遊書 PRD

## Problem Statement

2026 年 8 月 5 日至 8 月 16 日的北海道旅程橫跨道北、道東、道央與札幌，共 12 天，其中 8 月 5 日至 8 月 14 日包含長距離自駕。現有行程集中在一份長篇 Google Doc，混合航班、租車、住宿、每日路線、景點、預約、付款狀態、參考文章與安全提醒。旅行途中若只想確認今天要去哪裡、要開多少公里、何時必須出發、沿途在哪裡休息或加油，必須反覆捲動並自行辨認當日段落。

這趟旅程的執行風險主要來自每日移動距離、渡輪與景點截止時間、盆節車潮、道北與道東加油站稀疏，以及傍晚野生動物穿越道路。一般景點式時間線不足以表達自駕旅程的核心資訊；每日駕車路線、距離、預估時間、停靠點、還車期限與安全提醒必須比一般活動更醒目。

使用者需要一個位於 `/2026-hokkaido-car`、適合手機與 PWA 使用的旅遊書 App。進入頁面時應自動顯示日本當地日期對應的行程，日期導覽必須支援水平滑動，並讓駕駛或同行者在戶外、單手操作與網路不穩的情境下快速取得下一段必要資訊。

## Solution

新增一個獨立的「2026 北海道自駕」公開旅遊書頁面，沿用 TravelSplit 現有旅遊書 registry、PWA shell、日期判斷與 Embla 滑動架構，將來源文件整理為 app-owned structured data。

- 以 2026 年 8 月 5 日至 8 月 16 日的 12 天行程為主要內容。
- 使用 `Asia/Tokyo` 判定當日，首次進入、跨日與 App 回到前景時自動定位。
- 提供可水平滑動、可點選且固定於頁面上方的日期導覽。
- 每日頁首先呈現「今日駕車」路線帶，包含起訖、途經點、距離、預估駕駛時間、道路性質與關鍵期限。
- 在日程時間線中區分駕車、渡輪、航班、景點、餐飲、住宿、任務、提醒與安全警告。
- 將加油、野生動物、末班接駁、最後入場、還車與塞車緩衝標成高優先資訊。
- 提供地圖搜尋、官方網站與來源文件連結，但靜態行程在離線時仍可閱讀。
- 以「北海道夏季公路圖鑑」建立專屬視覺，不直接複製島波海道旅遊書。
- 使用 `Noto Sans TC` 作為主要閱讀字體、`IBM Plex Sans Condensed` 顯示時間與里程等道路資料、`LXGW WenKai TC` 少量用於旅程標題與章節引句。
- 以貫穿每日內容的「公路路線帶」作為識別元素，讓駕車段落在快速掃視時優先被辨識。

## User Stories

1. As a traveler, I want `/2026-hokkaido-car` to open as a dedicated travel book, so that this trip is independent from expense and other trip content.
2. As a traveler, I want the travel book to open on today's itinerary, so that I can immediately see the relevant plan.
3. As a traveler, I want the app to use Japan local time, so that the active day changes at the correct time.
4. As a traveler, I want dates before the trip to open on D1, so that I can use the guide for preparation.
5. As a traveler, I want dates after the trip to open on D12, so that the guide remains useful as a record.
6. As a traveler, I want the active day to refresh when the app returns from the background, so that an overnight-open app does not remain on yesterday.
7. As a traveler, I want the active day to refresh when Japan's calendar date changes, so that the itinerary advances automatically.
8. As a traveler, I want a visible today marker, so that I know where today sits in the full trip.
9. As a traveler, I want a Return to Today action, so that I can recover after reviewing another date.
10. As a traveler, I want manual date selection to remain stable, so that the app does not unexpectedly pull me away while planning.
11. As a traveler, I want to swipe horizontally between dates, so that changing days feels natural on a phone.
12. As a traveler, I want to tap a date in the sticky date strip, so that I can jump directly to any of the 12 days.
13. As a traveler, I want previous and next controls to respect trip boundaries, so that I cannot navigate to an invalid day.
14. As a keyboard user, I want the date strip and carousel to be operable without touch, so that the guide remains accessible.
15. As a traveler, I want the selected date button to stay visible in the date strip, so that I do not lose orientation.
16. As a traveler, I want each day to show D1–D12, date, weekday, destination and a short theme, so that I can identify the day quickly.
17. As a traveler, I want today's driving route placed before the general timeline, so that the most safety-critical information appears first.
18. As a driver, I want the route origin, destination and intermediate stops shown in sequence, so that I understand the day's shape.
19. As a driver, I want the planned driving distance shown prominently, so that I can prepare for the day's workload.
20. As a driver, I want an estimated driving duration shown when known, so that I can preserve realistic buffers.
21. As a driver, I want non-driving days to explicitly show 0 km or no rental car, so that transport mode is unambiguous.
22. As a driver, I want long-drive days visually distinguished, so that 200 km or greater days receive extra attention.
23. As a driver, I want rest stops such as Sunagawa Highway Oasis attached to the relevant route, so that breaks are planned rather than improvised.
24. As a driver, I want refueling reminders shown before remote areas, so that I do not pass a safe opportunity to refuel.
25. As a driver, I want the half-tank rule visible on northern and eastern Hokkaido days, so that fuel planning stays conservative.
26. As a driver, I want wildlife warnings emphasized for D5–D8, so that dusk driving risk is not treated as a general note.
27. As a driver, I want recommended dusk speed guidance preserved from the source plan, so that I have an actionable safety rule.
28. As a driver, I want the return-car deadline on D10 highlighted, so that the rental booking is not jeopardized.
29. As a driver, I want the D10 route to include traffic, refueling and return buffers, so that the 13:30 deadline is realistic.
30. As a traveler, I want ferry segments visually distinct from driving segments, so that parking the car at Wakkanai is clear.
31. As a traveler, I want the Rishiri ferry schedule marked for reconfirmation, so that I do not depend on stale times.
32. As a traveler, I want the first return ferry on D4 highlighted, so that the eastbound drive can start on time.
33. As a traveler, I want flight numbers, departure times and airport deadlines available on D1 and D12, so that travel-day logistics are complete.
34. As a traveler, I want car rental pickup details available on D1, so that I know when the road trip begins.
35. As a traveler, I want car rental coverage dates visible in the trip overview, so that I know when the car is and is not available.
36. As a traveler, I want each event ordered chronologically, so that I can follow the day from top to bottom.
37. As a traveler, I want flexible events to use morning, afternoon or evening labels, so that the app does not invent false precision.
38. As a traveler, I want fixed deadlines to stand out, so that I do not miss closing, entry, shuttle or departure times.
39. As a traveler, I want required, recommended and optional stops distinguished, so that I know what to skip when delayed.
40. As a traveler, I want confirmed, to-confirm and informational statuses distinguished, so that planning work remains visible.
41. As a traveler, I want the Cape Soya certificate shop's 17:00 closing time highlighted on D2, so that I can arrive before closing.
42. As a traveler, I want Abashiri Prison's final admission highlighted on D5, so that the stop is scheduled realistically.
43. As a traveler, I want Shiretoko Five Lakes reservation requirements shown on D6, so that access is not assumed.
44. As a traveler, I want the Kamuiwakka shuttle cutoff shown on D6, so that I do not miss the last service.
45. As a traveler, I want the whale-watching decision marked as optional, so that it does not crowd out required Shiretoko activities.
46. As a traveler, I want Lake Mashu's morning visibility advice shown on D7, so that the route reflects weather probability.
47. As a traveler, I want the Blue Pond 16:00 light deadline shown on D8, so that the long drive has a clear arrival target.
48. As a traveler, I want Farm Tomita's early arrival requirement highlighted on D9, so that Obon parking queues do not consume the day.
49. As a traveler, I want Obon congestion warnings shown on D8–D10, so that I expect heavier traffic and parking demand.
50. As a traveler, I want each lodging attached to the correct night, so that I navigate to the right destination after a long drive.
51. As a traveler, I want multi-night stays clearly indicated, so that I know when luggage can remain at the hotel.
52. As a traveler, I want breakfast and dinner inclusions visible, so that I can plan meals in remote areas.
53. As a traveler, I want payment status and booking platform available without dominating the main card, so that check-in details remain accessible.
54. As a traveler, I want booking IDs and other sensitive references hidden by default, so that normal browsing does not expose them.
55. As a traveler, I want to reveal and copy a booking reference when needed, so that pickup and check-in are efficient.
56. As a traveler, I want cancelled or superseded lodging suggestions visually suppressed, so that I do not navigate to an obsolete option.
57. As a traveler, I want place cards to offer Open in Maps, so that I can start navigation without retyping Japanese names.
58. As a traveler, I want routes to offer a multi-stop Google Maps action where practical, so that daily navigation setup is faster.
59. As a traveler, I want official ferry, attraction and transport links attached to the relevant event, so that I can reconfirm live information.
60. As a traveler, I want external links to open without interrupting the static guide, so that a failed website does not block the itinerary.
61. As a traveler, I want the original Google Doc linked as a reference, so that I can inspect details not represented in the app.
62. As a traveler, I want outstanding purchases and reservations available in a preparation checklist, so that unfinished work is visible before departure.
63. As a traveler, I want ferry tickets, Rishiri scooter contact, hiking clothing, tripod and power equipment represented in preparation, so that the source document's tasks are preserved.
64. As a traveler, I want checklist progress stored locally, so that completed preparation remains available offline.
65. As a traveler, I want checklist state isolated by travel-book ID, so that it cannot collide with another trip.
66. As a traveler, I want important static itinerary content available offline after the app is loaded, so that weak reception in remote Hokkaido does not block access.
67. As a traveler, I want a visible offline indicator, so that I know maps and live websites may not work.
68. As a traveler, I want the page to render without a successful expense API response, so that accounting availability does not affect the guide.
69. As a traveler, I want large touch targets and strong contrast, so that the guide remains usable outdoors and in a moving vehicle by a passenger.
70. As a traveler, I want key distance and time values to be scannable, so that I can understand the day's constraints at a glance.
71. As a traveler, I want Traditional Chinese text optimized for mobile reading, so that long notes do not become tiring.
72. As a traveler, I want Japanese and Latin place names to remain legible beside Chinese labels, so that I can match signs and booking records.
73. As a traveler, I want a visual identity specific to Hokkaido roads, so that this book is not mistaken for the Shimanami cycling guide.
74. As a traveler, I want reduced-motion preferences respected, so that carousel and auto-positioning motion does not cause discomfort.
75. As a screen-reader user, I want meaningful headings, landmarks, active-day semantics and route descriptions, so that the guide is navigable non-visually.
76. As a traveler, I want the current event and next deadline emphasized where time data permits, so that upcoming actions receive attention.
77. As a traveler, I want past events visually de-emphasized without disappearing, so that the day's history remains available.
78. As a traveler, I want the page to preserve reading position when briefly switching apps, so that checking maps does not reset the guide.
79. As a trip editor, I want itinerary content stored as structured trip data, so that route facts can be maintained without editing presentation markup.
80. As a trip editor, I want driving segments to support route stops, distance, duration, warnings and map links, so that self-drive information has a consistent schema.
81. As a trip editor, I want events to support transport mode, time, title, place, status, priority, notes and links, so that all 12 days use one model.
82. As a trip editor, I want lodging to support meal inclusion, booking platform, payment status and private references, so that check-in data is represented safely.
83. As a trip editor, I want malformed dates, duplicate IDs, invalid links and out-of-range days rejected during development, so that content errors are found before travel.
84. As a trip editor, I want the Hokkaido travel book registered by source document ID, so that it appears with the correct external resource.
85. As a traveler, I want the travel book to be shareable by URL, so that companions can open the same itinerary.

## Implementation Decisions

- Add a public travel-book route at `/2026-hokkaido-car`.
- Register the travel book under the existing trip registry using source document ID `1KTb3yvRp3MPHajXC5oqxgHQb6AjHNmERxbrX0KcEHmc`.
- Reuse the existing public-route recognition and travel-book discovery behavior instead of introducing a separate application shell.
- Keep itinerary data separate from expense records and encode the first release as app-owned structured TypeScript data.
- Generalize reusable travel-book concepts where the existing Shimanami types are trip-specific. Shared concepts should include trip metadata, day, event, link, status, priority and current-day selection. Hokkaido-specific driving and lodging details may extend those shared concepts.
- Define driving segments with origin, destination, ordered waypoints, distance in kilometers, optional estimated duration, route note, safety severity and map action.
- Treat 200 km or more as a long-drive presentation state. This is a visual and content cue, not a live route calculation.
- Use `Asia/Tokyo` as the authoritative timezone.
- Select D1 before 2026-08-05, the matching day from 2026-08-05 through 2026-08-16, and D12 after 2026-08-16.
- Re-evaluate the effective day on mount, on `visibilitychange` back to visible and at a lightweight interval sufficient to detect a Japan-date transition.
- Preserve manual browsing until Return to Today, a fresh page entry or another explicitly defined reset. Background refresh must not immediately override a manually selected day.
- Use the existing Embla carousel pattern for horizontal day swiping, synchronized with a sticky date strip and previous/next controls.
- Keep every date directly selectable. The selected date must scroll into view in the date strip.
- Respect `prefers-reduced-motion` for date-strip scrolling, carousel transitions and automatic positioning.
- Place a dedicated driving summary before the general event timeline on D1–D10. D3 explicitly presents 0 km and parked-car/ferry mode. D11–D12 indicate that the rental car has been returned.
- Initial daily driving data:
  - D1: New Chitose Airport to Nayoro, 210 km, with Sunagawa Highway Oasis as a rest stop.
  - D2: Nayoro to Wakkanai and Cape Soya, 180 km.
  - D3: Wakkanai Port to Rishiri by ferry, 0 km by rental car.
  - D4: Rishiri to Wakkanai by ferry, then Wakkanai to Mombetsu, 180 km.
  - D5: Mombetsu to Abashiri Prison to Utoro, 160 km.
  - D6: Shiretoko Five Lakes, sightseeing boat and Kamuiwakka area, 50 km.
  - D7: Shiretoko to Lake Mashu to Lake Akan, 150 km.
  - D8: Lake Akan via Obihiro and Blue Pond/Shirahige Falls to Biei, 220 km.
  - D9: Farm Tomita, Shikisai-no-Oka and the Biei area, 60 km.
  - D10: Biei to New Chitose Airport for the 13:30 return, 158 km and approximately 2.5 hours before buffers.
  - D11: Sapporo city, no rental car.
  - D12: Sapporo to New Chitose Airport by rail or other public transport, no rental car.
- Represent event types including drive, ferry, flight, public transport, activity, food, lodging, task, reminder and safety.
- Represent warning severity so that wildlife, fuel, hard deadlines and road safety are visually stronger than general advice.
- Preserve source-document uncertainty. Suggestions and AI-generated planning notes must not be presented as confirmed reservations.
- Show booking platform, payer/payment status and meal inclusion in lodging details, but hide booking references behind an explicit reveal action.
- Do not ship unnecessary private information. Review source content before implementation and exclude personal identifiers or links that expose private booking sessions.
- Generate map links from destination queries or explicit multi-stop directions. Do not embed a live map in the first version.
- Keep the original source document available as an external reference.
- Reuse local storage for non-sensitive preparation state and namespace keys by travel-book ID and schema version.
- The Hokkaido visual system will use:
  - Snowfield `#F6F8F7` for the page background.
  - Okhotsk `#176B87` for primary navigation and route elements.
  - Asphalt `#172A36` for primary text and road-data panels.
  - Lavender `#8067A8` for scenic and regional accents.
  - Road Yellow `#F4C542` for current-day markers and time-critical highlights.
  - Safety Coral `#D95D4F` for safety-critical warnings.
- Typography will use:
  - `Noto Sans TC` for body text, controls and dense itinerary content.
  - `IBM Plex Sans Condensed` for dates, times, distances, durations, day labels and utility data.
  - `LXGW WenKai TC` only for the hero title and selected editorial phrases; it must not be used for safety instructions or dense body copy.
- The signature component will be a road-route ribbon with a centerline, route nodes and distance labels. It must encode the real daily route rather than act as decoration.
- Use a mobile-first single-column layout with a practical reading width. Desktop may add breathing room but should not turn the page into a dashboard.
- Continue supporting PWA standalone display and offline access to static app assets and itinerary data.
- Primary interface language will be Traditional Chinese. Japanese and English property names may be shown as secondary labels where useful for navigation and check-in.

## Testing Decisions

- Tests will verify observable user behavior rather than component internals or React state.
- The highest test boundary will be the rendered `/2026-hokkaido-car` travel-book page with a controlled clock, controlled timezone and Hokkaido itinerary fixture.
- Reuse the existing date-selection function as the unit-test boundary for trip-date behavior.
- Add the smallest compatible React testing setup because the repository currently has no automated test framework.
- Date tests will cover before-trip selection, every date from 2026-08-05 through 2026-08-16, after-trip selection, Japan midnight and a device configured to another timezone.
- Page behavior tests will verify initial automatic selection, refresh after returning from background, manual-selection preservation and Return to Today.
- Navigation tests will verify date-button selection, swipe selection, previous/next boundaries, date-strip synchronization and selected-date visibility.
- Driving-card tests will verify route order, distance, duration, long-drive state, 0 km ferry day and no-car states after vehicle return.
- Content tests will verify the hard constraints from the source: Cape Soya 17:00 close, Abashiri final admission, Shiretoko reservations, Kamuiwakka shuttle cutoff, Blue Pond 16:00 target, Farm Tomita early arrival and D10 13:30 car return.
- Safety tests will verify that wildlife and refueling warnings render at stronger severity than general notes on the correct days.
- Lodging tests will verify correct-night association, multi-night stays, meal inclusion, payment status and hidden reservation references.
- Link tests will verify valid HTTPS destinations, safe external-link attributes and usable map-search or directions URLs.
- Offline tests will verify that the static itinerary renders without expense API success and that offline status is visible.
- Accessibility tests will verify heading order, route descriptions, active-day semantics, keyboard operation, focus visibility, minimum touch targets and reduced-motion behavior.
- Typography and visual QA will be performed at narrow phone, standard phone and desktop widths, with additional checks for large text and bright-light contrast.
- Manual browser verification should use the project's preferred Chrome plugin runtime when the feature is implemented.
- The existing Shimanami travel book provides prior art for the registry, current-day logic, date strip, Embla carousel, timeline, external links, checklist persistence, sharing and offline indicator.

## Out of Scope

- Live GPS tracking, geofencing or automatic arrival detection.
- Turn-by-turn navigation or replacing Google Maps.
- Live traffic, road closure, weather, fuel-price, ferry, rail or flight-status integration.
- Automatic route duration recalculation.
- Background location permission or continuous battery-intensive tracking.
- Runtime parsing or synchronization of arbitrary Google Doc formatting.
- Editing itinerary content from within the app.
- Collaborative itinerary editing.
- Automatic rescheduling when a stop is delayed or skipped.
- Uploading passports, licenses, payment cards, QR codes or full booking documents.
- Public exposure of private booking references.
- Expense forecasting or changes to existing split-expense behavior.
- A generalized CMS for creating arbitrary travel books.
- A desktop-first map dashboard.

## Further Notes

- Source itinerary: [2026 北海道自駕](https://docs.google.com/document/d/1KTb3yvRp3MPHajXC5oqxgHQb6AjHNmERxbrX0KcEHmc/edit?usp=drivesdk)
- Trip dates: 2026-08-05 through 2026-08-16.
- Rental-car period: 2026-08-05 13:30 through 2026-08-14 13:30.
- Primary timezone: `Asia/Tokyo`.
- The source document was last modified on 2026-05-23 when read for this PRD.
- The repository uses Next.js App Router, TypeScript, Tailwind CSS, DaisyUI, React Context, TanStack Query, IndexedDB persistence and static export to GitHub Pages.
- Some source-document statements are recommendations rather than confirmed bookings. Implementation must preserve that distinction.
- External schedules and operating rules can change before August 2026. The app should identify what must be reconfirmed rather than implying live accuracy.
- The selected fonts require a deliberate loading strategy. Body readability and offline reliability take priority; production should use framework-managed subsets or self-hosted assets where licensing permits, with CJK-capable system fallbacks.
