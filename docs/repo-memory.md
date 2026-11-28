# Repo Memory

## Project Identity

TripSplit is a mobile-first travel expense app that replaced a Google Forms plus Google Sheets workflow. The frontend lets travelers sign in, choose a trip sheet, add and review expenses, view summaries, and open trip resources. It has grown to include public mobile travel-book pages for itinerary execution.

The app is designed for real travel use: phones, intermittent network, outdoor readability, quick expense entry, and trip-specific structured guides.

## Durable Facts

- Framework: Next.js App Router with TypeScript.
- Styling: Tailwind CSS, DaisyUI, and local shadcn/Radix-style primitives.
- State: React Context for app state and TanStack Query for server state.
- Persistence: IndexedDB through `idb-keyval`, including the persisted TanStack Query cache (`reactQuery`) and a separate local-first todo outbox store (`tripsplit-todo-outbox`, falling back to memory when IndexedDB is unavailable).
- Auth: Cloudflare Worker handles OAuth token exchange and session cookies.
- API: Google Cloud Function exposes REST endpoints over Google Sheets (including batched `POST /todos/sync`; deploy backend `POST /todos/sync` before frontend builds that depend on it).
- Deployment: static export to GitHub Pages with Cloudflare in front.
- PWA: manifest, service worker, offline page, and app-shell behavior live under `public/` and root layout components.

## Core User Flows

- Signed-out users see `LoginView`.
- Signed-in users with multiple sheet IDs must choose a sheet at `/select-sheet`.
- Authenticated main app routes render inside `Layout`.
- Public travel-book routes bypass auth and layout chrome so they can be opened directly by URL.
- Expense data loads from the selected sheet and is cached by TanStack Query.
- Travel-book data is static structured app data and must remain readable without expense API success.

## Key Routes

- `/`: main expense list and expense add/edit dialog (`支出` tab).
- `/summary`: expense summary (`統計` tab).
- `/todos`: my trip todo list with local-first offline-capable editing backed by a separate IndexedDB outbox (`tripsplit-todo-outbox`) and batched `POST /todos/sync` transport, Option A quiet sync status line and per-item status dots (with retry/discard on failure), frontend-required per-user free-text category on add via category chips that appear only while the add row is focused, has a draft, or shows a category error (or a direct `建立第一個分類` field when no categories exist yet); backend still accepts empty so existing `未分類` items remain visible/editable), collapsible section grouping, read-only travel-mate todo views, grouped copy-to-my-list flow through the outbox with independent category carryover, and offline-capable GFM Markdown clipboard export from the compact header action button (`複製為 Markdown`, shortened to `Markdown` at `< 360px`) (`待辦` tab, left of `行程`; precached as `todos.html` in `public/sw.js`).
- `/plan`: trip plan travel books and resource list (`行程` tab).
- `/select-sheet`: selected Google Sheet picker when multiple sheets are configured.
- `/2026-shimanami`: public Shimanami travel book.
- `/2026-hokkaido-car`: public Hokkaido self-drive travel book.

## Important Data Boundaries

- Sheet config controls users, categories, currencies, dates, resources, and allowed users.
- User expense rows are normalized in `services/api.ts` with `mapRawExpenseToExpense`.
- Todo writes persist in the separate `tripsplit-todo-outbox` IndexedDB store keyed by `<sheetId>::<ownerEmail>::<todoId>` and overlay onto the TanStack Query base via `useTodoView` (refetch replaces only the base; sync write-back preserves `dataUpdatedAt`; `flushNow()` supports a future #76 refresh button). Passive sign-out and `reauthenticate()` preserve the outbox for re-login, explicit sign-out attempts a final flush and prompts before clearing unsynced changes, and activating a `(sheetId, ownerEmail)` scope clears other owners' scopes on init while preserving other-sheet outboxes of the same signed-in user.
- Travel-book registration is in `src/travel/registry.ts`.
- Shared travel-book types live in `src/travel/types.ts`; richer itinerary data is under trip-specific files such as `src/travel/shimanami.ts` and `src/travel/hokkaido.ts`.
- Do not put private booking sessions, sensitive personal identifiers, or full reservation documents into static client data.

## Current Documentation

- `README.md` explains sheet setup, auth architecture, env vars, and local stack setup.
- `docs/mobile-travel-guide-prd.md` captures the Shimanami/mobile travel guide requirements.
- `docs/2026-hokkaido-car-prd.md` captures the Hokkaido road-book requirements.
- `AGENTS.md` and this memory set exist to help future agents work without re-learning the repo from scratch.

## Known Gaps

- `package.json` currently has no lint or test script.
- PRDs mention future test setup, but the repo has not yet established automated React behavior tests.
- Local development depends on external auth and GCF services or compatible local replacements.
- Static public travel books intentionally do not provide live schedules, traffic, weather, or navigation.
