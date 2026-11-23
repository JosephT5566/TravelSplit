---
name: tripsplit-guide
description: Explain TripSplit's architecture or plan changes across expense tracking, authentication, sheet selection, and public travel books. Update affected project docs when behavior or setup changes.
---

# TripSplit guide

Start with [AGENTS.md](../../../AGENTS.md#context-routing) and follow the links for the affected area.

- For expense behavior, trace the route and component through the React stores, query keys, fetchers, and API wrapper. Check how the selected sheet partitions reads and cached state.
- For auth, read the cookie and persisted-user checks alongside the API refresh path. The Cloudflare Worker and Google Cloud Function are external to this repo.
- For a travel book, trace the route through the registry, trip component, and structured itinerary. Check the public shell bypass and trip-specific persistence.
- Keep setup and checks in [Development workflow](../../../docs/development-workflow.md), runtime contracts in [Architecture](../../../docs/architecture.md), and user intent in [Product context](../../../docs/product-context.md). Update only the sections affected by the change and verify claims against source.
