# Architecture Memory

## Runtime Shape

The app is a Next.js App Router project. `app/layout.tsx` installs the global PWA register component and wraps all pages with:

1. `ClientProviders`
2. `AuthProvider`
3. `ConfigProvider`
4. `ExpensesProvider`
5. `UIProvider`
6. `AppShell`

`AppShell` decides whether a route is public, signed out, waiting for sheet selection, or ready to render inside the authenticated `Layout`.
The authenticated layout gives the header and 4-tab bottom navigation (`支出`, `統計`, `待辦`, `行程`, `aria-label="主要導覽"`) their own rows and scrolls the content between them. The notification viewport sits above the navigation on mobile and in the top-right corner on desktop.
Toasts slide up from the bottom navigation on mobile and in from the right on desktop. They fade without sliding when reduced motion is enabled. The next queued toast appears after the current toast finishes closing.

## Public Travel Books

Public travel books are registered in `src/travel/registry.ts`.

- Each travel book has an `id`, `path`, source Google Doc IDs, title, date range, destinations, and metadata.
- `isPublicTravelBookPath(pathname)` normalizes trailing slash and `.html` output paths.
- Public travel books bypass auth and the main app layout in `components/AppShell.tsx`.
- `getTravelBooksForResources` maps Google Doc resource links from a sheet config to known travel books.

When adding a public travel book:

1. Add structured itinerary data under `src/travel/`.
2. Add or reuse components under `components/travel-books/`.
3. Register it in `src/travel/registry.ts`.
4. Add an App Router page under `app/<route>/page.tsx`.
5. Keep source PRD or implementation notes in `docs/` when the trip has special constraints.

## Auth

Auth uses a Cloudflare Worker as token issuer.

- Login and logout are initiated through `NEXT_PUBLIC_AUTH_PROXY`.
- The worker sets secure cookies, including a readable `is_logged_in` marker used by the frontend.
- `AuthStore` persists user profile data locally and checks cookie state on startup.
- If auth search params indicate failure, if `/me` fails, or if the login cookie disappears (passive sign-out), local user and TanStack Query caches (expenses and todos) are cleared and the active todo sync engine is disposed, while the persisted IndexedDB todo outbox is preserved so signing back into the same account and sheet resumes syncing.
- Explicit sign-out (`SideDrawer` -> `prepareSignOut()` -> `todoSyncManager.attemptSignOutFlush`) attempts a final `flushNow({ includeFailed: true })` when the todo outbox is non-empty. If unsynced changes remain (offline or failed), it closes the drawer (pausing `FocusTrap`) and opens a confirmation `AlertDialog` (`確定要登出嗎？` / `還有 N 項變更尚未同步，登出會遺失這些變更`, with `取消` / `仍要登出`). Only when the outbox is empty or the user confirms does `signOut({ clearTodoOutbox: true })` clear that owner's outbox scopes before redirecting to logout.
- If a user cookie exists but local user data is missing, the app calls `/me` through the API wrapper.

The actual ID token is expected to be protected by an HTTP-only cookie and is not read directly by frontend code.

## API and Token Refresh

`services/api.ts` is the API boundary.

- `getGcfUrl(path, sheetId)` appends the selected `sheetId` query parameter.
- `apiFetch` retries once after 401/403 or known unauthorized error codes for expense/config routes.
- `POST /add` only replays after a 401/403 and successful token refresh, while the original form's account and sheet are still active.
- `/todos` and `/todos/sync` requests always use a caller-pinned `sheetId` (never re-reading `getSelectedSheetId()` at send time) and opt out of treating HTTP 403 as unauthorized: `403 FORBIDDEN` does not trigger token refresh, redirect to `/`, or clear auth, and structured errors expose `error.code` (and HTTP status) via `TodoApiError`. `401 UNAUTHORIZED` shares the single-refresh queue, with `canReplayWrite` guarding `POST /todos/sync` writes (disabled for `keepalive` requests, which also skip the 15 s request timeout). If token refresh fails, Todo `GET` redirects to `/` like other GETs, whereas `POST /todos/sync` rejects with `TodoApiError` (`code: "UNAUTHORIZED"`) without redirecting so the outbox enters `auth-expired` while preserving local edits.
- Token refresh is queued so concurrent failed requests share one refresh attempt.
- GCF responses usually use `{ success, data, error }`; `/me` may return a user object directly.
- `credentials: "include"` is important because auth cookies are part of the request model.

Current GCF routes referenced by the app:

- `GET /setting`
- `GET /data`
- `POST /add`
- `DELETE /delete`
- `GET /todos` (`sheetId`, optional `ownerEmail`)
- `POST /todos/sync` (`sheetId`, `{ ops }`, 1–100 mixed `create`/`update`/`delete` ops; single atomic Sheets `:batchUpdate` returning per-op `{ opId, id, status, item?, duplicate?, deleted?, alreadyGone?, message? }` and `syncedAt`; legacy single-item `POST`/`PATCH`/`DELETE /todos` endpoints remain on the backend for rollback compatibility)
- `GET /me` or equivalent current-user endpoint through the API wrapper

Deploy order: backend `google-api-gcf` `POST /todos/sync` must be deployed before deploying frontend builds that depend on it. Legacy single-item todo endpoints stay available on the backend so frontend rollback remains safe.

## Sheet Selection

Multiple sheets are configured through `NEXT_PUBLIC_SHEET_ID`.

- `src/utils/sheetSelection.ts` parses available IDs and persists the selected ID.
- `useSelectedSheetId` exposes the current selection to client code.
- If only one sheet exists, `AppShell` saves it automatically.
- If multiple sheets exist and none is selected, `AppShell` redirects to `/select-sheet`.

Expenses and config should always resolve through the selected sheet unless a specific sheet override is passed.

## Expense Entry

The total field supports direct entry and a collapsible inline calculator. Calculator input stays local to the expense draft. Applying a result updates the original-currency amount and split preview through the same form state as direct entry.

The add-expense form models the payer and the split separately. Single-person splits follow the payer until the user chooses a specific traveler. The equal and specified splits retain their inputs while the user switches modes within a draft. Only the active mode supplies the preview and the `splitsJson` payload for `POST /add`.

The summary displays the entry currency. Specified shares are compared to the total in that currency before exchange-rate conversion. The form shows differences below the share inputs. Attempting to save an invalid split focuses its message and preserves the draft. On mobile, the summary and actions stay at the bottom of the dialog when the on-screen keyboard is closed and scroll with the fields when it opens.

## Settlement Summary

The **Who Owes Who** card on `/summary` nets each balance between the signed-in user and a member of the selected sheet. When the signed-in user paid, other participants owe their own shares. When someone else paid, the signed-in user owes their share to that payer. Zero balances produce no payment row. The summary includes expenses marked as settled in the sheet.

Clients send the original decimal inputs and split mode in `payload.calculation`
alongside the numeric values used by older API deployments. The new GCF
requires `payload.calculation` and checks each affected tab before writing a
batch. If a tab has an invalid layout, `/add` returns `422 INVALID_SHEET_LAYOUT`.

Formula-backed `/data` rows use `金額（台幣）` for the rounded TWD total.
The frontend also accepts the legacy `台幣總額` field during rollout. It
uses the evaluated share columns, which can contain fractional cents. Older
rows without formula split metadata still use their stored shares.
The expense list rounds each personal share to two decimal places for display and omits trailing zeros.

Participant tabs reference the payer's row by transaction ID. Editing
`匯率` on the payer's tab updates shares across tabs. New single-person and
equal splits also recalculate when `金額` changes. Existing single-person and
equal splits with fixed shares need their formulas updated to follow amount
changes. See [backend rollout notes](https://github.com/JosephT5566/google-api-gcf/pull/2).

## Data Fetching and Persistence

- `services/queryClient.ts` owns the TanStack Query client and auth-clear cache helpers (`clearUserQueryCaches`, `clearUserCachesIfSignedOut`).
- `services/persister.ts` wires query persistence into IndexedDB (awaiting `idb-keyval` writes in `persistClient`).
- `services/dataFetcher.ts` contains query and mutation hooks for config and expenses plus `useTodosQuery` for todo reads (`services/todoCache.ts` holds `getTodosQueryKey` and `createTodosQueryOptions`). The expense query waits for the selected sheet's config so it can map the sheet's member columns to email addresses.
- Todo reads (`[TODOS_KEY, sheetId, ownerEmail]`) share the TanStack Query IndexedDB persister (`reactQuery`), use TanStack Query's default online `networkMode` (entering `fetchStatus === "paused"` when offline without cache while keeping cached reads readable offline), and do not retry 4xx `TodoApiError` responses (retrying up to 3 times only for non-4xx failures). Category grouping and per-group statistics are derived in memory from the rendered `TodoItem[]` with no extra query keys.
- Todo writes no longer use TanStack Query mutations (or `networkMode: "always"` offline rejection); all writes go through the local-first IndexedDB outbox (`tripsplit-todo-outbox`) and `POST /todos/sync` (see `## Todo Page` below). When a sync batch confirms applied ops, `todoSyncManager` writes the reconciled server items back to the TanStack Query base cache with `setQueryData(queryKey, items, previousUpdatedAt ? { updatedAt: previousUpdatedAt } : undefined)` so sync write-back preserves the previous `dataUpdatedAt` and keeps `已儲存` distinct from `已更新` (invalidating the exact key if the base cache was `undefined`).
- Confirmed `POST /add` responses close the form and invalidate the expense query for the submitting sheet and account. The list and summary use `GET /data` to determine which rows the account can see. The write response's `newRecord` is optional for this flow.
- Confirmed adds and deletes show a success toast in the signed-in layout. A rejected add shows an error above the dialog actions, keeps the draft, and allows another submission. An unreadable response, a 20-second write deadline, or another unconfirmed add shows a warning in the dialog and blocks Save until the form closes. The warning asks the user to check the trip records before adding the expense again.
- A failed delete shows an error toast and keeps the row. A row without a timestamp shows a warning and sends no delete request.
- `src/stores/ExpensesStore.tsx` exposes normalized expense state plus refresh status.
- `src/stores/ConfigStore.tsx` merges default TWD currency config with sheet config and persists app-level display config.

Clearing auth state (`clearExpensesCache` -> `clearUserQueryCaches` in `services/queryClient.ts`) removes both expense and todos queries across all sheets and `ownerEmail`s and immediately persists the cleaned client to IndexedDB via `persistQueryClientSave`, while leaving the separate `tripsplit-todo-outbox` store intact on passive sign-out. In addition, `components/Providers.tsx` passes an `onSuccess` callback to `PersistQueryClientProvider` that calls `clearUserCachesIfSignedOut` after restore, preventing an early startup auth clear from being undone by a later IndexedDB hydration.

## Todo Page

The authenticated `/todos` route (bottom tab `待辦`, placed left of `行程`) renders my todo list and read-only views of travel-mates' todo lists (`app/todos/page.tsx` -> `components/todos/TodosPageContent.tsx` -> `components/todos/TodoList.tsx`). `/plan` remains unchanged (travel books and external resources).

- `TodosPageContent` keys its sheet view by `[sheetId, user.email]` (matching `MainPage` in `app/page.tsx`) and tracks local `viewedEmail` state that always starts on the signed-in user (never persisted to storage or URL) and resets whenever the active sheet or signed-in account changes. `TodoMemberPills` (`role="radiogroup"`) lists all members from `sheetConfig.users` with the signed-in user first (`我`), keeping keyboard focus and scroll position across member switches while `TodoList` remounts its inner list card by `[sheetId, ownerEmail, canEdit]` so state never leaks between members.
- Viewing another member passes `canEdit={false}`: `TodoList` renders a read-only context banner (`正在檢視 {名稱} 的清單（唯讀）` with a `回到我的清單` shortcut), collapsible category section headers (same grouping/order as my list), static round completion indicators in `TodoRow`, companion-specific empty/offline/error states (including `400 INVALID_PARAMS`), and no write controls. Companion views pass `{ readOnly: true }` to `useTodoView`, bypassing the outbox, reusing `useTodosQuery(sheetId, ownerEmail)` and TanStack Query/IndexedDB caching unchanged, and showing only `已更新 · HH:mm` in the status line (plus `TodoOfflineBanner` when offline). Teammate categories are never offered as suggestions in my `TodoAddRow`.
- Per-user free-text categories (`TodoItem.category?: string`, max 30 Unicode code points, line breaks normalized to single spaces, `"未分類"` or blank normalized to `""`, case-insensitive snap to my existing category spellings on input) are rendered inside the single `TodoList` card using collapsible section headers (`<h3><button aria-expanded aria-controls>` with chevron, category label, and `N/M` completed/total count). Groups are ordered by their earliest `createdAt` item (oldest first) with `未分類` fixed last; when every item is uncategorized, section headers are omitted so the card renders as a flat list. Collapse state lives only in `TodoListCard` component state (all expanded by default, never persisted to storage, reset on member/sheet switch or reload); adding or moving an item into a collapsed group expands it automatically. Adding a new todo in `TodoAddRow` requires choosing or creating a non-empty category (frontend-only via `validateRequiredTodoCategory`; backend `POST /todos/sync` and legacy `POST`/`PATCH` still accept empty `category` so legacy uncategorized items and teammate copies keep working). The top row has only the todo input and `新增` submit button, followed by an always-visible required `分類` block with wrapping 44 px chips for existing categories (`aria-pressed`, never listing `未分類`) plus an expandable `新增分類` chip (`aria-expanded`/`aria-controls`) that opens the new-category input and `建立`/`選用` action. When no category is selected, the category block uses a dashed accent border/tint, shows the inline hint `新增前請先選擇或建立分類`, and visually disables `新增` (using `aria-disabled="true"` when text is valid so clicking or pressing Enter expands and focuses the new-category input); invalid typed drafts (blank, `"未分類"`, or >30 code points) show an inline `role="alert"` error without submitting, while valid open drafts submit directly. First-time users with no categories see only the required `建立第一個分類` input (no suggestion chips or system defaults). The chosen category sticks across consecutive adds and can be cleared by toggling the active chip or clicking `清除分類`; once cleared, a category must be selected again. Existing `未分類` items remain visible, checkable, deletable, and editable in `TodoRow` (including `清除為未分類`), sending only changed fields on save and returning focus to the row's text button. Overall progress (`已完成 N / 全部 M` and the top 4 px bar) remains list-wide regardless of group collapse state.
- Markdown export (`TodoExportButton`) renders a compact 44 px outline button (`ClipboardCopy` icon; visible label `複製為 Markdown` at `>= 360px` and shortened to `Markdown` below `360px` while always keeping `aria-label="複製為 Markdown"`) inside `TodoList`'s `data-slot="todo-header-actions"` slot next to the `待辦清單` title on both my list and read-only teammate lists (while `TodoCopyButton` stays inside the card on teammate lists) whenever `hasData && sortedTodos.length > 0` (hidden for empty, loading, error, or offline-without-cache states; works offline from cached data with no network calls). `src/utils/todoMarkdown.ts` (`escapeMarkdownText`, `formatTodosAsMarkdown`) formats the currently viewed list as a GFM task list (`## <displayName> 的待辦清單`, grouped in UI order with `未分類` last and `### 未分類` omitted when all items are uncategorized, preserving intra-group order and `- [x]`/`- [ ]` state, backslash-escaping Markdown syntax characters). `src/utils/clipboard.ts` (`copyTextToClipboard`) tries `navigator.clipboard.writeText` first, falls back to a hidden readonly textarea + `document.execCommand("copy")`, and if both fail `TodoExportButton` opens a manual-copy dialog containing an auto-selected readonly textarea (`請長按或使用系統複製`) and restores focus to the export button on close.
- Copying items from a travel-mate's list (`TodoCopyButton` + `TodoCopyDrawer`) opens a bottom sheet grouping source items by source category (matching read-only list order; omitting headers when all items are uncategorized, non-collapsible) with per-group `已選 x / N`, 44 px per-group `全選`/`取消全選` toggles (including duplicates), and muted merge/new hints (`併入我的「…」` on case-only difference, `新分類` when absent from my list), plus a footer note (`複製後與對方的清單互不影響`). Duplicate detection remains text-only against `useTodoView(sheetId, myEmail).items` (including unsynced local items) while the drawer is open (unchecked by default, manually re-checkable). Selected items are enqueued in source `createdAt` order as `checked: false` with independent carried-over categories (normalized, capped to 30 Unicode code points, snapped case-insensitively to my existing category spellings, first spelling winning within a batch; uncategorized teammate items remain uncategorized) via `myTodoView.createMany(payloadItems)` into the local outbox (works offline). On confirm, the drawer closes immediately with a count-only toast (`已複製 N 項到我的清單`) and no in-drawer progress or error UI; copied items appear immediately in my list, sync in batches of up to 100 ops via the outbox, and surface any failures in the status line and per-item dots.
- Pure sorting, completion stats, text and category normalization/validation (`validateTodoCategory` and `validateRequiredTodoCategory`)/snapping/grouping, character counter thresholds, and error-code-to-message mapping live in `src/utils/todoList.ts`; Markdown formatting and escaping live in `src/utils/todoMarkdown.ts`; clipboard copy with execCommand fallback lives in `src/utils/clipboard.ts`; member options, copy category resolution, copy candidates/payloads, drawer candidate grouping, per-group selection toggle, and copy summaries live in `src/utils/todoCopy.ts`; pure outbox reducers, batching, scheduling, reconciliation, and overlay live in `src/utils/todoOutbox.ts`; sync status derivation, local time formatting, and `aria-live` announcement transitions live in `src/utils/todoSyncStatus.ts` (all React-free). Items are always ordered by `createdAt` oldest first within their list/group; toggling completion keeps items in place.

### Local-First Todo Outbox and Sync

- **Storage and scope** (`services/todoOutboxStore.ts`, `services/todoSyncManager.ts`, `src/utils/todoOutbox.ts`): todo writes persist immediately to a dedicated `idb-keyval` store (`createStore("tripsplit-todo-outbox", "entries")`), separate from TanStack Query's throttled `reactQuery` persister. Entries are keyed by `<sheetId>::<ownerEmail>::<todoId>` (one entry per todo ID: `{ id, kind: "create" | "patch" | "delete", base, patch, rev, attempts, status, lastError, opId?, nextAttemptAt?, createdAt? }`, with `inflight` persisted as `pending` so reloads recover cleanly), alongside scope metadata `__meta__::<sheetId>::<ownerEmail>` for `lastSavedAt`. `AppShell` activates the single active `(sheetId, ownerEmail)` engine via `todoSyncManager.activateScope(...)`; initializing a scope clears any other scopes (`clearOtherScopesOnInit: true`) so entries are never sent to the wrong account or sheet. When IndexedDB is unavailable or throws (e.g. private browsing or quota errors), `createIndexedDbTodoOutboxStore` falls back to an in-memory mirror (`persistent: false`) and the status line shows `此裝置無法離線保存，請保持頁面開啟`.
- **Client IDs, merge rules, and `rev` handling** (`src/utils/todoOutbox.ts`): newly created todos receive client-generated IDs (`<13-digit-ms>-<uuid>`, `crypto.randomUUID` with `crypto.getRandomValues` fallback and monotonic ms timestamps in `TodoSyncEngine`). `applyLocalChange` merges repeated edits to the same todo before sending: a `patch` field returning to `base` drops that field and an empty `patch` removes the entry (no request sent, unless currently in-flight); `create` + `patch` folds into `create`; `create` + `delete` deletes the entry without sending (or turns into `delete` if `create` is already in-flight); `patch` + `delete` collapses to `delete`. Every effective change increments `rev` and clears `opId`. When a sync response returns, an applied entry is removed only if `current.rev === sent.rev`; if edited again while in-flight (`current.rev !== sent.rev`), it is retained and rebased onto the server-returned `item` (leaving only the remaining diff for the next batch).
- **Transport (`POST /todos/sync`)** (`services/api.ts`, `services/todoSyncEngine.ts`): `api.syncTodos` (`TodoSyncTransport` / `defaultTodoSyncTransport`) sends batched `{ ops }` payloads (1–100 ops per request, 15 s default timeout). The server response is the confirmation (Sheets `:batchUpdate` is atomic, so no read-back GET is performed): per-op `status: "applied"` updates `lastSavedAt` from `syncedAt` and reconciles the server-assigned `item` (or `deleted: true`). Lost/timed-out responses safely resend with the same persisted `opId` and client `id` (owned duplicate `create` returns `applied` + `duplicate: true`; already-gone `delete` returns `applied` + `deleted: true` + `alreadyGone: true`). Conflicts use last-write-wins (LWW) with field-level `update` patches (only changed fields are sent). Per-op `not_found` drops patched entries (`dropped`) and clears deletes; per-op `forbidden`/`invalid` and whole-request `400`/`403`/`422` mark entries `failed` immediately (`403 FORBIDDEN` never triggers logout, token refresh, redirect, or cache clearing); whole-request `401` (after refresh fails) sets `authExpired` while keeping entries `pending` without burning attempts.
- **Scheduling and concurrency** (`services/todoSyncEngine.ts`): local changes flush after **1.5 s** idle debounce or at most **10 s** `maxWait` from the first unsynced change (`nextFlushDelay`). Transient failures (network, timeout, `408`/`429`/`5xx`, missing/invalid op results) retry with exponential backoff **5 s -> 15 s -> 45 s -> 120 s** (cap 120 s) with **±20% jitter** (`backoffDelay`), transitioning to `failed` after 4 consecutive attempts. `online` and `visibilitychange` (`visible`) trigger an immediate flush when pending entries exist; `pagehide` and `visibilitychange` (`hidden`) dispatch one synchronous `fetch(..., { keepalive: true })` batch capped at <=100 ops and <=64 KB UTF-8 body (`buildKeepaliveSyncBatch`; overflow waits for the next foreground/reopen flush; no `beforeunload` prompt). No timers run when the outbox is empty, offline, `authExpired`, or disposed. Flushes are single-flight per engine (`inflightPromise`) and serialized across tabs with `navigator.locks.request("tripsplit-todo-outbox::<sheetId>::<ownerEmail>", ...)` when available.
- **Overlay on TanStack Query base and dropped notice** (`src/hooks/useTodoView.ts`, `components/todos/TodoList.tsx`): `useTodoView(sheetId, ownerEmail, { readOnly })` computes the visible list by applying `overlayTodos` onto the `useTodosQuery` base without ever writing optimistic edits into the base cache. Refetches replace only the base cache and re-apply the overlay so unsynced changes are never overwritten. If a refetch (or `POST /todos/sync` `not_found`) shows a locally patched item was deleted on another device, the entry becomes `dropped`; `TodoList` captures the one-time notice (`N 項已在其他裝置刪除，已移除你的變更`) into local UI state and immediately calls `dismissDropped()` to remove `dropped` entries from IndexedDB so it does not reappear on reload.
- **Offline behavior**: `src/hooks/useOnlineStatus.ts` subscribes to `online`/`offline` via `useSyncExternalStore`. Editable my-list views allow adding, toggling, editing, deleting, and copying while offline (changes persist to the outbox and sync automatically on reconnect); editable mode uses the status line instead of `TodoOfflineBanner`, while read-only teammate lists retain `TodoOfflineBanner` (`readOnly`). Offline with no cached data (`fetchStatus === "paused"` and `data === undefined`) still renders `TodoOfflineNoCacheState`. `api.syncTodos` keeps a transport-level `OFFLINE` guard while the engine skips flushing offline.
- **Status line (Option A), per-item dots, and `aria-live`** (`components/todos/TodoSyncStatusLine.tsx`, `components/todos/TodoRow.tsx`, `src/utils/todoSyncStatus.ts`):
  - A quiet 12 px status line renders directly under the header stats (`已完成 N / 全部 M`), derived by `deriveSyncStatus` in strict priority order: `failed` (`同步失敗 · N 項（點擊重試）`) > `auth-expired` (`登入已過期，登入後會繼續同步`) > `offline-pending` (`離線，N 項變更會在連線後同步`) > `offline-idle` (`離線 · 顯示 HH:mm 的資料` / `離線`) > `inflight` (`儲存中…`) > `pending` (`N 項尚未同步`, appending `（M 秒後重試）` via a 1 s ticker only during backoff) > `refreshing` (`更新中…`) > `saved` (`已儲存 · HH:mm`) > `refreshed` (`已更新 · HH:mm`). `N` counts distinct todo IDs; timestamps use local 24-hour format (`HH:mm`, `昨天 HH:mm`, or `M/D HH:mm`). Only actionable states (`pending` -> `flushNow()`, `failed` -> `retry()`, `auth-expired` -> auth proxy login redirect preserving the outbox) render as `<button>` controls with `>= 44 px` touch targets (`min-h-11 -my-3 py-3`); all other states render as `<p>`.
  - Per-item indicators (`TodoRowSyncDot` in `TodoRow.tsx`) show an orange 8 px dot (`未同步`, `pending`), a pulsing primary 8 px dot (`儲存中`, `inflight`), or a 44×44 px red 10 px dot button (`同步失敗`, `failed`) that opens a portaled Radix `Popover` (`此項目同步失敗`) with 44 px `重試` and `捨棄變更` (reverts to base or removes an unsynced create) buttons.
  - Permanently mounted `sr-only` live regions driven by `advanceSyncAnnouncementState`: `role="status" aria-live="polite"` announces only meaningful transitions (`已更新`, `已儲存`, `離線`, `已恢復連線`, and dropped notices) while staying silent on `pending`, `inflight`, `refreshing`, and offline edits; `role="alert" aria-live="assertive"` announces `failed` / `auth-expired` once on entry and clears on recovery.
- **Manual refresh (#76) integration point**: `useTodoView` exposes `flushNow()` so a future manual refresh button (#76) can `await flushNow()` before calling `refetch()` when the outbox is non-empty (and remain disabled offline). `refetch()` must never clear the outbox; it replaces only the base cache while the overlay keeps any remaining unsynced changes intact.

## Styling and UI

- Global styles live in `app/globals.css`.
- Tailwind config lives in `tailwind.config.ts`.
- Component primitives live under `components/ui/`.
- Feature UI lives directly in `components/`, `components/todos/`, or `components/travel-books/`.
- Mobile-first behavior is important. Travel-book pages must work as practical field guides, not desktop dashboards.

## PWA and Static Export

- `public/manifest.webmanifest` and `public/sw.js` support install/offline behavior (`sw.js` precaches core shell pages including `todos.html`).
- `components/PWARegister.tsx` registers the service worker.
- `public/offline.html` is the offline fallback.
- `NEXT_PUBLIC_BASE_PATH` is used when generating manifest and icon URLs for hosted static paths.

Be careful with route paths and static export behavior. Public route matching already handles `.html` normalization.
