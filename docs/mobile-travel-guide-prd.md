# Mobile Travel Guide Timeline PRD

## Problem Statement

目前 TravelSplit 的 Plan 頁面只提供 Google Docs、Google Sheets 等外部資源連結。旅行途中若要確認今天的行程、下一個目的地、住宿、交通、預約資訊或雨天備案，使用者必須離開 App 並在長篇文件中自行尋找當天段落。

這趟旅程為 2026 年 6 月 25 日至 7 月 2 日，共八天，涵蓋岡山、倉敷、尾道、島波海道、今治、道後溫泉與松山。其中 6 月 28 日至 6 月 30 日包含三天自行車行程，途中可能因天氣、體力、住宿位置與交通狀況調整節奏。旅途中主要以手機操作，也可能遇到網路不穩、單手操作或不方便反覆查找文件的情境。

使用者需要一份適合手機閱讀的旅遊書，以日期與時間線呈現行程。App 應根據目前日期自動定位到當天，並讓內容隨日期自然往後推進，同時保留手動查看其他日期、開啟地圖與查閱備案的能力。

## Solution

將現有 Plan 頁面改造成手機優先的旅遊書時間線：

- 以 2026 年 6 月 25 日至 7 月 2 日的每日行程為主要結構。
- 進入頁面時，根據日本當地日期自動定位到今天。
- 日期改變或 App 再次回到前景時，自動將目前行程推進至新的一天。
- 以垂直時間線呈現交通、景點、餐飲、住宿、任務與提醒。
- 清楚區分必要行程、可選景點、預約資訊、待確認事項及雨天／體力備案。
- 提供「回到今天」與日期導覽，讓使用者可查看其他日期。
- 使用者手動瀏覽其他日期時，不立即強制跳回今天。
- 讓地點、交通、住宿與官方資訊可直接開啟外部地圖或網站。
- 延續現有 PWA 與離線快取能力，使已載入的行程在網路不穩時仍可閱讀。
- 保留原始 Google Doc 作為外部參考資料。

## User Stories

1. As a traveler, I want the Plan page to open on today's itinerary, so that I can immediately see what I need during the trip.
2. As a traveler, I want the app to use Japan local time when determining the current day, so that the itinerary does not change at the wrong time.
3. As a traveler, I want the timeline to advance when the calendar date changes, so that the displayed itinerary stays current.
4. As a traveler, I want the app to refresh the current day after returning from the background, so that an overnight-open app does not remain on yesterday.
5. As a traveler, I want a visible Today marker, so that I can understand my position in the full trip.
6. As a traveler, I want a quick Return to Today action, so that I can recover after browsing another date.
7. As a traveler, I want to swipe or tap between trip dates, so that I can preview tomorrow or review previous days.
8. As a traveler, I want manual date browsing to remain stable, so that the app does not unexpectedly pull me back to today.
9. As a traveler, I want dates before the trip to default to the first day, so that I can use the app for pre-trip preparation.
10. As a traveler, I want dates after the trip to default to the final day or trip summary, so that completed travel information remains accessible.
11. As a traveler, I want each day to show its day number, date, weekday and city, so that I can orient myself quickly.
12. As a traveler, I want each day to have a short theme or goal, so that I understand the intended pace.
13. As a traveler, I want itinerary events ordered chronologically, so that I can follow the day from top to bottom.
14. As a traveler, I want events without exact times to support morning, afternoon and evening periods, so that flexible plans are not shown with false precision.
15. As a traveler, I want fixed-time events to stand out, so that I do not miss flights, bike pickup or return deadlines.
16. As a traveler, I want transport segments to show origin and destination, so that transfers are easy to follow.
17. As a traveler, I want transport entries to show the recommended departure window, so that I can preserve schedule buffers.
18. As a traveler, I want flight details available in the timeline, so that I can verify airport and departure information.
19. As a traveler, I want the Okayama Airport bus reminder available on the arrival and departure days, so that I can plan airport transfers.
20. As a traveler, I want time-sensitive information marked as requiring reconfirmation, so that I do not rely on an outdated timetable.
21. As a traveler, I want lodging details attached to each applicable day, so that I can find the correct hotel at night.
22. As a traveler, I want confirmed and cancelled lodging clearly distinguished, so that I do not navigate to an obsolete booking.
23. As a traveler, I want booking platform and payment status visible, so that I can handle check-in questions.
24. As a traveler, I want sensitive reservation references hidden by default, so that they are not exposed during normal browsing.
25. As a traveler, I want to reveal and copy a reservation reference when needed, so that I can present it during pickup or check-in.
26. As a traveler, I want each place to offer an Open in Maps action, so that I can start navigation without retyping its name.
27. As a traveler, I want official websites linked from relevant events, so that I can verify current operating information.
28. As a traveler, I want optional attractions visually separated from required stops, so that I can simplify the day when needed.
29. As a traveler, I want priority stops identified, so that I know what to preserve when time is limited.
30. As a traveler, I want daily notes to explain the intended pace, so that I avoid overloading the itinerary.
31. As a cyclist, I want cycling days visually distinct from city travel days, so that I can prepare for the day's demands.
32. As a cyclist, I want each riding day to show the planned route, so that I understand the sequence of islands and bridges.
33. As a cyclist, I want expected start and arrival windows shown, so that I can avoid riding after dark.
34. As a cyclist, I want bike pickup and return tasks highlighted, so that I do not miss rental requirements.
35. As a cyclist, I want equipment reminders available before the first riding day, so that I can prepare rain gear, sunscreen, water and power.
36. As a cyclist, I want baggage delivery tasks shown on the correct day, so that I do not carry unnecessary luggage.
37. As a cyclist, I want food and water supply warnings for remote lodging, so that I can buy supplies before arrival.
38. As a cyclist, I want physically demanding optional detours labeled, so that I can make decisions based on remaining energy.
39. As a cyclist, I want a daily safety reminder not to ride at night, so that schedule pressure does not override safety.
40. As a cyclist, I want the three riding days presented as one connected journey, so that I can see overall progress from Onomichi to Imabari.
41. As a traveler, I want rain alternatives attached to affected days, so that I can adjust without searching the source document.
42. As a traveler, I want fatigue alternatives attached to riding days, so that I can shorten the route safely.
43. As a traveler, I want alternative transport such as ferry, bus or early bike return visible, so that I understand the fallback options.
44. As a traveler, I want backup plans collapsed by default, so that the main itinerary remains easy to scan.
45. As a traveler, I want warnings to distinguish safety-critical issues from general suggestions, so that I can prioritize correctly.
46. As a traveler, I want incomplete decisions marked as To Confirm, so that outstanding preparation work is visible.
47. As a traveler, I want completed reservations marked as Confirmed, so that I can distinguish planning from execution.
48. As a traveler, I want a preparation checklist for bike rental, luggage and equipment, so that I can complete tasks before departure.
49. As a traveler, I want checklist progress stored on my device, so that completed items remain checked offline.
50. As a traveler, I want the checklist to avoid modifying expense data, so that itinerary actions cannot corrupt accounting records.
51. As a traveler, I want the timeline to remain readable with one hand on a phone, so that it works during transit and cycling stops.
52. As a traveler, I want large touch targets, so that actions remain usable outdoors.
53. As a traveler, I want important text to remain readable in bright light, so that the guide is practical outside.
54. As a traveler, I want the current event and next event emphasized, so that I do not need to scan the full day.
55. As a traveler, I want completed or past events visually de-emphasized, so that upcoming information receives attention.
56. As a traveler, I want the page to preserve my reading position when I briefly open another app, so that I can continue where I left off.
57. As a traveler, I want reduced-motion preferences respected, so that automatic scrolling does not cause discomfort.
58. As a traveler using assistive technology, I want the timeline to use meaningful headings and labels, so that the itinerary is navigable with a screen reader.
59. As a traveler, I want itinerary content available after it has been loaded once, so that weak mobile reception does not block access.
60. As a traveler, I want a clear offline state, so that I know external links and live information may be unavailable.
61. As a traveler, I want failed external links not to block the rest of the guide, so that static itinerary content remains usable.
62. As a traveler, I want the original Google Doc linked as a reference, so that I can inspect details not yet represented in the app.
63. As a traveler, I want the expense, summary and plan sections to share the same selected trip, so that I do not accidentally view mismatched data.
64. As a traveler with multiple trips, I want each trip to have its own itinerary data, so that switching Google Sheets also switches the travel guide.
65. As a trip editor, I want itinerary data to be structured rather than embedded in presentation markup, so that dates and events can be maintained safely.
66. As a trip editor, I want each event to support title, type, time, location, notes and links, so that common itinerary information is consistently represented.
67. As a trip editor, I want events to support optional and required priority, so that the UI can communicate what may be skipped.
68. As a trip editor, I want events to support confirmation status, so that bookings and unresolved details can be represented accurately.
69. As a trip editor, I want events to support alternate plans, so that weather and fatigue contingencies remain attached to the relevant schedule.
70. As a trip editor, I want missing optional fields to render gracefully, so that flexible activities do not require invented data.
71. As a trip editor, I want invalid dates and malformed links detected during development, so that itinerary errors are found before travel.
72. As a traveler, I want the guide to load quickly on a mobile connection, so that checking the next step does not interrupt the trip.
73. As a traveler, I want the app to avoid continuous background location tracking, so that battery life and privacy are preserved.
74. As a traveler, I want date-based progression to work without granting location permission, so that the core guide remains dependable.
75. As a traveler, I want the itinerary to remain useful after the trip, so that it can serve as a travel record.

## Implementation Decisions

- Extend the existing Plan route rather than introducing a separate application or navigation hierarchy.
- Keep the existing bottom navigation and selected-trip flow.
- Treat the itinerary as structured trip data, separate from expense records.
- Introduce a trip itinerary model containing trip metadata, trip timezone, day entries and timeline events.
- Use `Asia/Tokyo` as the authoritative timezone for this itinerary. Device timezone must not determine the active travel date.
- Determine the effective day using the following rules:
  - Before 2026-06-25, select D1.
  - From 2026-06-25 through 2026-07-02, select the matching local date.
  - After 2026-07-02, select D8 and indicate that the trip has ended.
- Re-evaluate the effective date when the Plan page mounts, when the browser returns to the foreground and when the local date changes while the page remains open.
- Automatic date progression selects the correct day but must respect active manual browsing. A user-selected historical or future day remains selected until the user chooses Return to Today, reopens the Plan page, or the manual-selection session expires through a clearly defined navigation event.
- Initial automatic positioning should scroll the active day or active event into view. Automatic scrolling must use reduced motion when requested by the operating system.
- Use a vertically scrolling timeline as the primary mobile layout.
- Keep date navigation sticky within the Plan experience so that the current day remains visible during scrolling.
- Represent event types including transport, activity, food, lodging, cycling, task, reminder and contingency.
- Represent time as either an exact time, a time range or a flexible period such as morning, afternoon or evening.
- Represent event priority as required, recommended or optional.
- Represent planning status as confirmed, to-confirm, cancelled or informational.
- Visually suppress cancelled reservations while preserving them when they explain a replaced booking.
- Keep reservation references outside normal card summaries and reveal them only through an explicit action.
- Store non-sensitive itinerary completion state locally. Do not store authentication credentials or private booking documents in this state.
- Use normal external HTTPS links for official resources and map search links for destinations.
- Continue exposing the original planning document under external resources.
- Reuse the existing PWA shell and persisted query infrastructure where suitable, while ensuring the static itinerary can render without a successful expense fetch.
- The first version will encode the supplied eight-day itinerary as app-owned structured data. A later version may load itinerary data from a dedicated Google Sheet tab or API.
- The initial content will cover:
  - D1: Arrival at Okayama and station-area lodging.
  - D2: Kurashiki Bikan Historical Quarter day trip.
  - D3: Okayama to Onomichi, luggage forwarding and bicycle preparation.
  - D4: Onomichi to Setoda cycling.
  - D5: Setoda to Hakatajima cycling.
  - D6: Hakatajima/Oshima to Imabari, bicycle return and transfer to Dogo Onsen.
  - D7: Dogo Onsen and Matsuyama, followed by return to Okayama.
  - D8: Light Okayama morning and flight home.
- The itinerary must preserve source-document warnings about weather, avoiding night riding, airport bus reconfirmation, lodging supply limitations and the July 1 Matsuyama-to-Okayama transfer.
- Labels and primary itinerary content will use Traditional Chinese, matching the source plan and current user context.

## Testing Decisions

- Tests should verify observable user behavior rather than internal React state or component implementation.
- The highest test boundary is the rendered Plan page with a controlled clock, trip timezone and itinerary fixture.
- Add unit tests for the date-selection logic because timezone and trip-boundary errors could send the user to the wrong day.
- Date tests must cover:
  - Before-trip selection.
  - Every date from 2026-06-25 through 2026-07-02.
  - After-trip selection.
  - A device in `Asia/Taipei` while the trip date is evaluated in `Asia/Tokyo`.
  - The date transition at Japan midnight.
- Add interaction tests verifying that the page initially positions to today.
- Add interaction tests verifying that returning from the background refreshes a stale date.
- Add interaction tests verifying that manual date selection is not immediately overridden.
- Add interaction tests for Return to Today.
- Add interaction tests for previous-day and next-day navigation at the trip boundaries.
- Add rendering tests for exact-time events, flexible-period events, optional events, cancelled lodging, warnings and collapsed contingencies.
- Add accessibility tests for heading order, active-day semantics, button labels, keyboard navigation and reduced-motion behavior.
- Add tests verifying that external map and official-site links have valid destinations and safe external-link attributes.
- Add offline behavior coverage verifying that previously available itinerary content renders without a network response.
- Add schema validation tests to reject duplicate day dates, events outside the trip range, malformed URLs and unsupported statuses.
- The repository currently has no automated test framework. Implementation should add the smallest compatible React testing setup and establish Plan-page behavior as the first reference pattern.
- Manual mobile verification should cover a narrow phone viewport, sticky navigation, long-day scrolling, large text settings, offline mode and PWA standalone display.

## Out of Scope

- Live GPS tracking or turn-by-turn bicycle navigation.
- Automatic detection of arrival at a location.
- Continuous background location access.
- Live weather integration.
- Live train, ferry, bus or flight status.
- Automatic rescheduling based on delays, weather or cycling speed.
- Editing the itinerary from within the mobile app.
- Collaborative itinerary editing.
- Automatic synchronization from arbitrary Google Doc formatting.
- Parsing the source Google Doc at runtime.
- Storing passports, payment cards, QR codes or full booking documents.
- Replacing dedicated map and navigation applications.
- Budget forecasting beyond the existing expense features.
- Public sharing of the itinerary without authentication.
- Generalizing the first release into a full multi-user travel publishing platform.

## Further Notes

- Source itinerary: [Google Doc](https://docs.google.com/document/d/11DVuL-VuJ-lVM6jNDhGosmNbzv4EdSEdew1zfslHdLI/edit?usp=drivesdk)
- Trip dates: 2026-06-25 through 2026-07-02.
- Primary trip timezone: `Asia/Tokyo`.
- The app currently uses Next.js App Router, TypeScript, Tailwind CSS, DaisyUI, React Context, TanStack Query and IndexedDB-backed persistence.
- The existing Plan page is an external-resource list and is the intended entry point for this feature.
- The source document contains private reservation and payment details. Implementation must review which fields are appropriate to ship to the client and avoid exposing unnecessary sensitive information.
- Airport and transportation schedules may change. The travel guide should clearly identify information that must be rechecked close to departure rather than presenting it as guaranteed live data.
