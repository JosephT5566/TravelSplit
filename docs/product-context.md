# Product Context Memory

## Product Intent

TripSplit exists to make trip accounting faster and less error-prone than entering expenses through Google Forms. It keeps Google Sheets as the practical source of truth while providing a better mobile frontend.

The second product lane is trip execution: mobile travel books that turn long planning documents into structured, date-aware, offline-readable guides.

## Primary Audiences

- Travelers adding expenses during a trip.
- Trip companions checking shared costs and summaries.
- Travelers checking today's itinerary, transport, lodging, reminders, and backup plans on a phone.
- The repo owner maintaining structured trip data before departure.

## Expense Product Behavior

The expense app should make it easy to:

- Sign in with Google through the auth proxy.
- Select the active trip sheet when multiple sheets are configured.
- Load sheet config: users, categories, currencies, trip dates, and resources.
- Add expenses with date, category, item, payer, currency, exchange rate, and split amounts.
- Review day-based expenses and summaries.
- Keep previously loaded data available through persisted query cache.

Google Sheets remain the backend data store. The frontend should avoid inventing a parallel accounting source of truth.

## Travel-Book Product Behavior

Travel books are mobile-first field guides.

Expected behavior:

- Open directly by public URL.
- Use the trip's local timezone, usually `Asia/Tokyo`, for active-day selection.
- Select the first day before the trip, the matching day during the trip, and the final day after the trip.
- Re-evaluate the active day on mount, foreground return, and date changes.
- Preserve manual day browsing until the user returns to today or starts a fresh navigation context.
- Keep static itinerary content readable offline after load.
- Offer map and official-source links without depending on live embeds.
- Distinguish required stops, optional stops, confirmations, cancelled plans, reminders, and safety warnings.

Travel books are not live navigation, live weather, live traffic, or schedule-status systems.

## Existing Travel Books

### 2026 Shimanami

Route: `/2026-shimanami`

Trip dates: 2026-06-25 through 2026-07-02.

Destinations include Okayama, Kurashiki, Onomichi, Shimanami Kaido, Imabari, Dogo Onsen, and Matsuyama. The key execution challenge is a three-day cycling segment with weather, fatigue, lodging, baggage, supply, and safety considerations.

Source PRD: `docs/mobile-travel-guide-prd.md`.

### 2026 Hokkaido Car

Route: `/2026-hokkaido-car`

Trip dates: 2026-08-05 through 2026-08-16.

Destinations include northern, eastern, central Hokkaido and Sapporo. The key execution challenge is a long-distance self-drive itinerary with ferries, remote refueling, wildlife risk, road buffers, car return deadline, Obon congestion, and attraction cutoff times.

Source PRD: `docs/2026-hokkaido-car-prd.md`.

## Content Principles

- Use Traditional Chinese for primary traveler-facing itinerary content.
- Keep Japanese and English names where they help with navigation, signage, or booking lookup.
- Preserve uncertainty. A suggested stop, AI-assisted recommendation, or timetable that needs reconfirmation should not read like a confirmed reservation.
- Do not expose private booking details by default.
- Prioritize practical field use over decorative presentation.

## Roadmap Signals

The PRDs point toward:

- Shared travel-book schemas and components.
- Controlled timezone/date-selection tests.
- Structured validation for itinerary data.
- Checklist progress persisted locally and namespaced by trip.
- Better offline and accessibility verification.

These are roadmap signals, not permission to broaden scope during unrelated work.
