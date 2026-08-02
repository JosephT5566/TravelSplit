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
- `apiFetch` retries once after 401/403 or known unauthorized error codes.
- Token refresh is queued so concurrent failed requests share one refresh attempt.
- GCF responses usually use `{ success, data, error }`; `/me` may return a user object directly.
- `credentials: "include"` is important because auth cookies are part of the request model.

Current GCF routes referenced by the app:

- `GET /setting`
- `GET /data`
- `POST /add`
- `DELETE /delete`
- `GET /me` or equivalent current-user endpoint through the API wrapper

## Sheet Selection

Multiple sheets are configured through `NEXT_PUBLIC_SHEET_ID`.

- `src/utils/sheetSelection.ts` parses available IDs and persists the selected ID.
- `useSelectedSheetId` exposes the current selection to client code.
- If only one sheet exists, `AppShell` saves it automatically.
- If multiple sheets exist and none is selected, `AppShell` redirects to `/select-sheet`.

Expenses and config should always resolve through the selected sheet unless a specific sheet override is passed.

## Data Fetching and Persistence

- `services/queryClient.ts` owns the TanStack Query client.
- `services/persister.ts` wires query persistence into IndexedDB.
- `services/dataFetcher.ts` contains query hooks for config and expenses.
- `src/stores/ExpensesStore.tsx` exposes normalized expense state plus refresh status.
- `src/stores/ConfigStore.tsx` merges default TWD currency config with sheet config and persists app-level display config.

Clearing auth state should also clear expense cache to avoid showing another user's stale data.

## Styling and UI

- Global styles live in `app/globals.css`.
- Tailwind config lives in `tailwind.config.ts`.
- Component primitives live under `components/ui/`.
- Feature UI lives directly in `components/` or `components/travel-books/`.
- Mobile-first behavior is important. Travel-book pages must work as practical field guides, not desktop dashboards.

## PWA and Static Export

- `public/manifest.webmanifest` and `public/sw.js` support install/offline behavior.
- `components/PWARegister.tsx` registers the service worker.
- `public/offline.html` is the offline fallback.
- `NEXT_PUBLIC_BASE_PATH` is used when generating manifest and icon URLs for hosted static paths.

Be careful with route paths and static export behavior. Public route matching already handles `.html` normalization.
