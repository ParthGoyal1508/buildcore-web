# Quickstart: Access Granularity and Multi-Company (web)

How to see this feature work, and the four things worth trying to break.

## Prerequisites

- `buildcore-api` running with feature 019 Phases 1–5 (committed 2026-09-30) and seeded data
- Two companies, and a user with access to both
- A role granting one area at `read` only — the client's Note 22 example (logbook entry and
  nothing else in machinery) is the case SC-003 names

## Running

```bash
npm run dev          # web
npm run lint && npx tsc --noEmit && npm run build
```

## Scenario 1 — levels reach the browser (Phase 1)

In the console on any signed-in page:

```js
(await (await fetch(`${location.origin}/api/noop`)).ok)  // not this — use the app's own query cache
```

Simpler: inspect the `['currentUser']` query in React Query Devtools. **Expected**: a `grants`
array with `{ permission, level }` entries. Before Phase 1 this field is absent from the parsed
object even though the network response contains it — which is the defect Phase 1 fixes. Compare
the Network tab's raw response with the parsed cache entry to see it.

## Scenario 2 — a read-only role sees no write controls (Phase 2, SC-004)

Sign in as the read-only role. **Expected**: the module is reachable and its lists render; no
Create, Edit or Delete control appears anywhere in it. Controls are **absent**, not disabled —
FR-007 is explicit, and a disabled button still tells somebody the action exists.

Then confirm the server agrees: issue the write directly (Devtools → copy as fetch on a write
from an authorised session, replayed in the read-only one). **Expected**: 403. The absent control
is courtesy; this is the boundary.

## Scenario 3 — switching company (Phase 4, SC-001, SC-006)

1. Note the selected company in the shell header (FR-002).
2. Open a list with records in both companies.
3. Switch. **Expected**: the list refetches and shows only the new company's records.
4. **The one that matters** — before switching, visit several screens so their queries are cached.
   After switching, revisit each. **Expected**: none shows a figure from the previous company.
   Inspect the query cache directly; SC-006 is written as an inspection because a stale answer is
   a *plausible* answer and looks correct on screen.
5. Create a record. **Expected**: it belongs to the selected company (SC-001).
6. Reload, then **quit the browser entirely and reopen** (SC-002). **Expected**: the same company
   is selected — because the server remembered, not the browser.
7. With a form dirty, switch. **Expected**: a warning before anything is discarded (FR-006).

## Scenario 4 — cash hiding (Phase 5, SC-005)

Turn hiding on in settings. **Expected**, module by module: no cash amount appears, and each
hidden figure reads as a stated absence rather than a blank cell or `0`. Any total spanning a
hidden row says it is incomplete (FR-014).

Then export a report containing cash rows. **Expected**: hidden there too — the export is built
from the same response, which is why FR-013 covers exports without separate work.

Finally, **record a cash payment while hiding is on**. **Expected**: it saves normally and comes
back hidden. Entry is untouched; see the Clarifications session of 2026-10-01.

## Scenario 5 — the switcher at 320px (NFR-001)

Narrow the viewport to 320px and pick the company with the longest name. **Expected**: the
switcher is reachable and operable, and does not obscure page content. This is a Principle VI
surface because the shell is.

## What is not verifiable here

- Enforcement. Every check above is about what is *shown*; the api's own e2e suite covers whether
  the boundary holds.
- NFR-002's 2-second switch budget needs a measurement, recorded in `tasks.md`, not an impression.
