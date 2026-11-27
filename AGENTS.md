# AGENTS.md

## Purpose

This repo is TripSplit, a Next.js App Router frontend for trip expense splitting and mobile travel books. Future agents should treat this file as the first stop for repo-specific operating guidance, then use the memory docs in `docs/`.

## Memory Docs

- `docs/repo-memory.md`: durable repo overview, current product shape, and high-signal implementation facts.
- `docs/architecture.md`: app architecture, data flow, auth, persistence, and public travel-book behavior.
- `docs/development-workflow.md`: setup, commands, environment, verification, and deployment notes.
- `docs/agent-workflow.md`: issue, design, implementation, and review stages.
- `docs/product-context.md`: product intent, user flows, and travel-book roadmap context.
- Existing PRDs:
  - `docs/mobile-travel-guide-prd.md`
  - `docs/2026-hokkaido-car-prd.md`

Update these docs when behavior, routes, auth assumptions, data shape, or development workflow changes.

## Context routing

| Task | Start here |
| --- | --- |
| Setup, build, CI, deployment | [Development workflow](docs/development-workflow.md), `package.json`, `next.config.mjs`, `.github/workflows/` |
| Auth, sheet selection, expenses, caching | [Architecture](docs/architecture.md), then the affected route, store, fetcher, and query key |
| Public travel books and offline behavior | [Product context](docs/product-context.md), `src/travel/registry.ts`, the affected trip data, and the PWA files under `public/` |
| Agent workflow and documentation | [Agent workflow](docs/agent-workflow.md) and [tripsplit-guide](.agents/skills/tripsplit-guide/SKILL.md) |

## Issue-first workflow

- Use this workflow for implementation tracked in GitHub Issues. Follow the user's direct instructions for standalone work.
- Use [issue-enhance](.agents/skills/issue-enhance/SKILL.md) to draft a spec with observable acceptance criteria. For UI changes, record the owner's selection using [ui-design-gate](.agents/skills/ui-design-gate/SKILL.md) before approval.
- Start issue implementation once the owner has approved the spec and the issue carries `ai-ready`. Use [implement-from-issue](.agents/skills/implement-from-issue/SKILL.md) and a separate `codex/issue-<number>-<slug>` branch. Record decisions and handoff status in the issue or PR.
- Enable the repo-local `pre-push` hook with `git config core.hooksPath .githooks` (or `npm run hooks:install`) to block pushing `codex/issue-<n>-*` unless issue `#n` carries `ai-ready`; bypass consciously with `git push --no-verify`.
- Use [review-pr](.agents/skills/review-pr/SKILL.md) in a separate session. The owner merges after required checks and reviews pass.
- Flag changes to auth, sheet isolation or expense writes, public travel-book access or reservation data, PWA caching, environment variables, Pages paths, or GitHub Actions for owner approval before merging.

## Tech Stack

- Next.js App Router with TypeScript.
- React 18 client components for the main app shell and feature UI.
- Tailwind CSS 4, DaisyUI, shadcn/Radix-style local UI primitives, and lucide-react icons.
- TanStack Query with IndexedDB persistence through `idb-keyval`.
- Static export deployment to GitHub Pages, fronted by Cloudflare.
- Backend API is a Google Cloud Function that reads/writes Google Sheets.
- Auth token exchange is handled by a Cloudflare Worker.

## Important Commands

- `npm run dev`: starts the HTTPS development server on `travel-split-dev.josephtseng-tw.com:3000`.
- `npm run build`: production/static export build.
- `npm start`: Next production server, useful only when the app is not being consumed as static export.

There is currently no dedicated lint or test script in `package.json`. When adding meaningful behavior, prefer adding the smallest compatible test setup rather than relying only on manual checks.

## Environment

Required public environment variables:

- `NEXT_PUBLIC_AUTH_PROXY`: Cloudflare Worker auth proxy base URL.
- `NEXT_PUBLIC_TRAVEL_SPLIT_GCF`: Google Cloud Function base URL.
- `NEXT_PUBLIC_SHEET_ID`: one sheet ID, comma-separated sheet IDs, or a JSON array of sheet IDs.
- `NEXT_PUBLIC_BASE_PATH`: optional base path used for static deployment assets.

Local auth requires HTTPS because the auth proxy uses secure cookies. See `README.md` and `docs/development-workflow.md`.

## Repo Structure

- `app/`: Next App Router pages, metadata, root layout, and client providers.
- `components/`: feature UI, app shell/layout, travel-book components, and local UI primitives.
- `src/stores/`: React Context providers for auth, config, expenses, and UI.
- `src/hooks/`: client hooks for media, sheet selection, and local user persistence.
- `src/travel/`: travel-book registry, structured itinerary data, shared travel types, map helpers, packing data, and date utilities.
- `services/`: API wrapper, TanStack Query fetchers, cache keys, query client, and IndexedDB persister.
- `docs/`: durable repo memories and feature PRDs.
- `public/`: PWA manifest, service worker, offline page, and icons.

## Architecture Rules

- Public travel-book routes must bypass the authenticated app shell. Use `isPublicTravelBookPath` in `src/travel/registry.ts` as the source of truth.
- Expense and config data come from the selected Google Sheet through the GCF API. Do not couple travel-book static content to expense fetch success.
- Keep itinerary content as structured TypeScript data under `src/travel/`, not embedded in presentation-only markup.
- Keep sensitive reservation or personal details out of normal client-visible summaries. If references are needed, hide them behind explicit reveal/copy controls.
- Namespace local storage or IndexedDB state by feature/trip when state is travel-book-specific.
- Preserve the distinction between confirmed, informational, optional, cancelled, and to-confirm travel facts.

## Code Style

- Follow the existing TypeScript and React Context patterns before introducing new state libraries or abstractions.
- Prefer path alias imports with `@/` where the repo already uses them.
- Keep components mobile-first. The app is primarily used on phones during travel.
- Use existing local UI primitives from `components/ui/` when practical.
- Use lucide-react icons for recognizable controls.
- Traditional Chinese is expected for primary user-facing travel content. English is fine for developer docs and code.
- Avoid unrelated refactors while making feature changes.

## Verification Guidance

- Run `npm run build` before handing off changes that affect runtime behavior, routing, or TypeScript.
- For UI work, manually verify narrow mobile and desktop widths. Travel-book pages need special attention to sticky date navigation, long scrolling days, contrast, touch targets, and offline readability.
- Use [verify](.agents/skills/verify/SKILL.md) for browser evidence with synthetic data. State the difference between local evidence and verification against deployed auth or data services.
- For workflow changes, check triggers, permissions, environment variables, build commands, and artifacts. For docs or skills alone, check links, frontmatter, and `git diff --check`.
- If tests are added later, prioritize user-visible behavior: auth gates, sheet selection, expense CRUD flows, trip date selection, manual travel-book navigation, and offline rendering.

## Current Product Notes

- Main authenticated routes cover expense entry, expense list/day navigation, summary, plan resources, and sheet selection.
- Public routes currently include `/2026-shimanami` and `/2026-hokkaido-car`.
- The app supports multiple Google Sheets through `NEXT_PUBLIC_SHEET_ID` and local selected-sheet persistence.
- Auth relies on an `is_logged_in` browser cookie plus locally persisted user profile data. Missing or invalid auth state clears local user and expense cache.

## Agent Handoff Checklist

Before finishing a change:

1. Confirm whether docs need updates.
2. Check `git status --short` and mention only files relevant to your work.
3. Run the most relevant available verification command.
4. Call out any verification that could not be run.
5. Do not revert user changes or generated files you did not create.
