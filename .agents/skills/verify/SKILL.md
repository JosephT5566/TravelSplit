---
name: verify
description: Verify TripSplit UI changes on mobile and desktop with local builds and synthetic data. Run the public travel-book browser smoke check or follow the affected feature's verification path.
---

# Verify TripSplit in a browser

Use a clean browser profile and a root-path export built with synthetic endpoints. Do not sign in to production or capture real expense, profile, or booking data in evidence.

## Build and run the public-route check

Run from the repository root. The build writes the ignored `out/` directory.

```sh
NEXT_PUBLIC_AUTH_PROXY=https://auth.verify.invalid NEXT_PUBLIC_TRAVEL_SPLIT_GCF=https://api.verify.invalid NEXT_PUBLIC_SHEET_ID=verify-sheet BASE_PATH='' npm run build
```

With Playwright and Chromium available, run the browser smoke check. For an isolated Playwright installation, install into a temporary directory and use its `node_modules` path.

```sh
verify_deps=$(mktemp -d)
npm install --prefix "$verify_deps" playwright
"$verify_deps/node_modules/.bin/playwright" install chromium
NODE_PATH="$verify_deps/node_modules" node .agents/skills/verify/scripts/public-travel-books.mjs
```

The script serves `out/` on an ephemeral loopback port. It checks that both public books open in fresh mobile browser contexts with external requests blocked. Screenshots, accessibility snapshots, and blocked requests go to the evidence directory printed by the script.

## Verify the changed behavior

For manual checks, serve the same export using `npm exec -- vite preview --outDir out --host 127.0.0.1 --port 4173 --strictPort` and open `http://127.0.0.1:4173` with the available browser tool. Stop the preview after collecting evidence.

- **Travel books.** Check the changed feature at narrow mobile and desktop widths. For day navigation, select a date, scroll a long day, and check boundaries and sticky controls. For packing or PWA work, also verify the affected persistence or offline path.
- **Auth and sheet selection.** Start signed out. For signed-in checks, use a compatible local auth fixture and mock GCF routes. Try one and multiple synthetic sheets. Verify the selected sheet persists after reload and that switching sheets shows the corresponding data.
- **Expense entry, editing, and summary.** With synthetic sheets, exercise controls through the UI. For a write, check the mocked request and reopen or refresh the affected view to confirm the result. Check a failed request when error handling changed.

Capture what the user sees after key actions. Include viewport, commands, results, and any remaining gaps. A synthetic or public-route check cannot establish deployed OAuth, Worker, GCF, or Sheets behavior. See [Manual QA](../../../docs/development-workflow.md#manual-qa) for related checks.
