# Frontend correction — 2026-10-01

Scope: frontend display, calculations, navigation, filters, Excel, responsive layout and themes. API/DB readiness is not the frontend acceptance gate. No migrations or server behavior changed.

## Changes
- Construction: unfinished planned quantity is separate from confirmed-trip variance. Preserve confirmed records after cancellation, exclude cancelled future plans.
- Carry status and text search into results; use identical export filters; period label reflects range; restore create-plan/vehicles/receipts shortcuts.
- Prevent empty dates and inverted ranges; remove the stale fixed header date; native detail dialog supports Escape and focus containment.
- Receiving: include location/source/search/status in workbook metadata; retain range/source filters; fix phone date controls inheriting a 440px vertical flex basis.
- Shared: reserve return-navigation height above fixed sidebars; restore contrast of Today button in dark theme.
- Driver: retain existing UI; confirmed day selection, next-trip detail and report-draft transition. Backend dispatch sequencing is outside this frontend change.

## Verification
- Build and selected Node tests passed (final count recorded in release response).
- Browser: construction 未搬出1便 → results remains 未搬出/1便; empty date then next day stays operable; native dialog closes via Escape.
- Browser: 1440×1000 and 390×844, both themes, construction/receiving/driver. Screenshots in this directory; phone viewport is browser simulation.
- Receiving mobile date controls reduced from 502px to 114px and viewport horizontal overflow is zero.
- Driver report draft moved from 現場到着 to the next departure action; this is explicitly local demo state.
- Workbook round-trip tests verify real XLSX and filter metadata. Browser download event tool timed out; this is not treated as download proof.
- Formal multi-party DB acceptance and physical-device tests were not rerun and are not prerequisites for this frontend-only release.
