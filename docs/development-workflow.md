# Development Workflow Memory

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.local.example` and set:

```env
NEXT_PUBLIC_AUTH_PROXY=https://your-auth-worker-url.com
NEXT_PUBLIC_TRAVEL_SPLIT_GCF=https://your-gcf-url.cloudfunctions.net
NEXT_PUBLIC_SHEET_ID=your_google_sheet_id
```

`NEXT_PUBLIC_SHEET_ID` may also be a comma-separated list or JSON array when multiple trip sheets are available.

## Local Development

Run:

```bash
npm run dev
```

The dev script starts Next with HTTPS on:

```text
https://travel-split-dev.josephtseng-tw.com:3000
```

HTTPS matters because the auth flow uses secure cookies. A complete local stack also needs:

- Cloudflare Worker auth proxy, configured through `NEXT_PUBLIC_AUTH_PROXY`.
- Google Cloud Function or compatible local backend, configured through `NEXT_PUBLIC_TRAVEL_SPLIT_GCF`.
- A Google Sheet shared with the backend service account.

## Build

Run:

```bash
npm run build
```

Use this as the default verification command for TypeScript, routing, and production/static-export compatibility.

## Tests and Lint

There is no dedicated test or lint command in `package.json` yet.

When adding tests, start with the smallest setup compatible with Next App Router and React 18. Prioritize behavior at these boundaries:

- Trip date selection across timezones and trip boundaries.
- Public travel-book route rendering without auth.
- Auth shell behavior for signed-in, signed-out, and sheet-selection states.
- Expense mapping from raw sheet rows.
- Offline rendering of static itinerary content.

## Manual QA

For app shell or expense changes:

- Verify signed-out login state.
- Verify signed-in state with one configured sheet.
- Verify signed-in state with multiple configured sheets.
- Verify expense list refresh and add/edit dialog behavior.

For travel-book changes:

- Verify narrow mobile width first.
- Check sticky date navigation, previous/next boundaries, and return-to-today behavior.
- Check long-day scrolling and large touch targets.
- Check external links use safe attributes and usable destinations.
- Confirm static content renders without requiring an expense fetch.
- Confirm sensitive booking details are hidden unless intentionally revealed.

For PWA/static changes:

- Verify manifest and icon paths respect `NEXT_PUBLIC_BASE_PATH`.
- Verify service worker registration still succeeds.
- Verify offline fallback is not broken.

## Deployment Memory

The frontend is intended for static export to GitHub Pages, with Cloudflare managing the custom domain/CDN. Backend and auth are separate deployments:

- Cloudflare Worker: OAuth login, refresh, logout, cookie management.
- Google Cloud Function: authenticated resource server for Google Sheets.

Do not add server-only Next runtime assumptions unless deployment is intentionally changed.

## Git Hygiene

- Check `git status --short` before and after edits.
- Do not revert unrelated changes.
- Keep generated build artifacts out of commits unless they are intentionally tracked.
- If changing docs and code together, keep docs aligned with actual behavior rather than planned behavior.
