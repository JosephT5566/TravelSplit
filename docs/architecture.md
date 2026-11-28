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
The authenticated layout gives the header and 4-tab bottom navigation (`Expenses`, `Summary`, `待辦`, `Plan`) their own rows and scrolls the content between them. The notification viewport sits above the navigation on mobile and in the top-right corner on desktop.
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
- If auth search params indicate failure, or if the login cookie disappears, local user and expense cache are cleared.
- If a user cookie exists but local user data is missing, the app calls `/me` through the API wrapper.

The actual ID token is expected to be protected by an HTTP-only cookie and is not read directly by frontend code.

## API and Token Refresh

`services/api.ts` is the API boundary.

- `getGcfUrl(path, sheetId)` appends the selected `sheetId` query parameter.
- `apiFetch` retries once after 401/403 or known unauthorized error codes for expense/config routes.
- `POST /add` only replays after a 401/403 and successful token refresh, while the original form's account and sheet are still active.
- `/todos` requests always use a caller-pinned `sheetId` (never re-reading `getSelectedSheetId()` at send time) and opt out of treating HTTP 403 as unauthorized: `403 FORBIDDEN` does not trigger token refresh, redirect to `/`, or clear auth, and structured errors expose `error.code` (and HTTP status) via `TodoApiError`. `401 UNAUTHORIZED` still shares the single-refresh queue, with `canReplayWrite` guarding Todo writes. If token refresh fails, Todo `GET` redirects to `/` like other GETs, whereas a Todo write rejects with `TodoApiError` (`code: "UNAUTHORIZED"`) without redirecting (matching `POST /add`).
- Token refresh is queued so concurrent failed requests share one refresh attempt.
- GCF responses usually use `{ success, data, error }`; `/me` may return a user object directly.
- `credentials: "include"` is important because auth cookies are part of the request model.

Current GCF routes referenced by the app:

- `GET /setting`
- `GET /data`
- `POST /add`
- `DELETE /delete`
- `GET /todos` (`sheetId`, optional `ownerEmail`)
- `POST /todos` (`sheetId`, batch `items`)
- `PATCH /todos` (`sheetId`, `{ id, text?, checked? }`)
- `DELETE /todos` (`sheetId`, `{ id }`)
- `GET /me` or equivalent current-user endpoint through the API wrapper

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
- `services/dataFetcher.ts` contains query and mutation hooks for config, expenses, and todos (`services/todoCache.ts` holds pure TanStack Query options and cache helpers). The expense query waits for the selected sheet's config so it can map the sheet's member columns to email addresses.
- Todo queries use `[TODOS_KEY, sheetId, ownerEmail]`, share the same IndexedDB persister, and do not retry 4xx `TodoApiError` responses (retrying up to 3 times only for non-4xx failures). Todo writes (create, check toggle, text edit, and delete) cancel in-flight queries for the exact pinned key in `onMutate` so stale GET responses cannot overwrite write results. Create appends server items de-duplicated by `id` when the list is already cached, or invalidates the exact key without seeding a partial list when the cache is `undefined`. Check/uncheck (`PATCH /todos` with `checked` only) applies an optimistic `checked` toggle; on error it reverts only the `checked` field if it still matches that mutation's optimistic value and invalidates the exact key so the cache converges to server truth. Todo writes use `networkMode: "always"` and `retry: false`, and fail immediately with `TodoApiError` (`code: "OFFLINE"`) when offline rather than queuing mutations.
- Confirmed `POST /add` responses close the form and invalidate the expense query for the submitting sheet and account. The list and summary use `GET /data` to determine which rows the account can see. The write response's `newRecord` is optional for this flow.
- Confirmed adds and deletes show a success toast in the signed-in layout. A rejected add shows an error above the dialog actions, keeps the draft, and allows another submission. An unreadable response, a 20-second write deadline, or another unconfirmed add shows a warning in the dialog and blocks Save until the form closes. The warning asks the user to check the trip records before adding the expense again.
- A failed delete shows an error toast and keeps the row. A row without a timestamp shows a warning and sends no delete request.
- `src/stores/ExpensesStore.tsx` exposes normalized expense state plus refresh status.
- `src/stores/ConfigStore.tsx` merges default TWD currency config with sheet config and persists app-level display config.

Clearing auth state (`clearExpensesCache` -> `clearUserQueryCaches` in `services/queryClient.ts`) removes both expense and todos queries across all sheets and `ownerEmail`s and immediately persists the cleaned client to IndexedDB via `persistQueryClientSave`. In addition, `components/Providers.tsx` passes an `onSuccess` callback to `PersistQueryClientProvider` that calls `clearUserCachesIfSignedOut` after restore, preventing an early startup auth clear from being undone by a later IndexedDB hydration.

## Todo Page

The authenticated `/todos` route (4th bottom tab `待辦`, placed left of `Plan`) renders my todo list and read-only views of travel-mates' todo lists (`app/todos/page.tsx` -> `components/todos/TodosPageContent.tsx` -> `components/todos/TodoList.tsx`). `/plan` remains unchanged (travel books and external resources).

- `TodosPageContent` keys its sheet view by `[sheetId, user.email]` (matching `MainPage` in `app/page.tsx`) and tracks local `viewedEmail` state that always starts on the signed-in user (never persisted to storage or URL) and resets whenever the active sheet or signed-in account changes. `TodoMemberPills` (`role="radiogroup"`) lists all members from `sheetConfig.users` with the signed-in user first (`我`), keeping keyboard focus and scroll position across member switches while `TodoList` remounts its inner list card and mutations by `[sheetId, ownerEmail, canEdit]` so state never leaks between members.
- Viewing another member passes `canEdit={false}`: `TodoList` renders a read-only context banner (`正在檢視 {名稱} 的清單（唯讀）` with a `回到我的清單` shortcut), static round completion indicators in `TodoRow`, companion-specific empty/offline/error states (including `400 INVALID_PARAMS`), and no write controls. Companion queries reuse `useTodosQuery(sheetId, ownerEmail)` and existing TanStack Query/IndexedDB caching unchanged (no refetch-on-switch or manual refresh controls).
- Copying items from a travel-mate's list (`TodoCopyButton` + `TodoCopyDrawer`) opens a bottom sheet listing source items in `createdAt` order, flags duplicates against `useTodosQuery(sheetId, myEmail)` only while the drawer is open (unchecked by default, manually re-checkable), and writes selected items as `checked: false` via `useCreateTodos(sheetId, myEmail)` in sequential batches of up to 100 without automatic retries. On success the drawer closes, shows a count-only toast, and stays on the viewed list; failures and partial batch failures stay in the drawer as inline `role="alert"` notices (retaining only uncopied items after partial failure and warning users to check my todo list before retrying unconfirmed errors). An unconfirmed copy error invalidates the exact `[TODOS_KEY, sheetId, myEmail]` query once so 「前往我的清單確認」 is not served from a stale cache.
- Pure sorting, completion stats, text normalization/validation, character counter thresholds, and error-code-to-message mapping live in `src/utils/todoList.ts`, while member options, copy candidates/payloads, batch chunking, error classification, and copy summaries live in `src/utils/todoCopy.ts` (both React-free). Items are always ordered by `createdAt` oldest first; toggling completion keeps items in place.
- `src/hooks/useOnlineStatus.ts` subscribes to `online`/`offline` events via `useSyncExternalStore`. When offline, `TodoList` shows an offline status banner and disables write/copy controls while keeping cached items readable; when offline with no cached data (`fetchStatus === "paused"` and `data === undefined`), it renders an offline-no-cache message instead of a permanent loading skeleton.
- Per-row pending state is tracked in a `Set` of todo IDs using `mutateAsync` so concurrent row actions do not overwrite each other's pending state.
- `403 FORBIDDEN` responses on Todo reads or writes show permission messages without triggering logout, token refresh, redirect, or cache clearing; `404 NOT_FOUND` on updates or deletes shows a stale-item toast and invalidates the pinned query key.

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
