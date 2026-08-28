# Quickstart: Validating the Dashboard & General Frontend

## Prerequisites

- `buildcore-api`'s Dashboard module (`specs/004-dashboard-backend`) running locally with seeded
  data (employees, punches, leave applications, a pending re-enrolment request, Redis for exports).
- `npm run dev` in `buildcore-web`.
- No automated test framework exists yet in this repo — every scenario below is a manual check.

## Scenario 1 — Generic widget rendering (User Story 1)

1. Load `/dashboard`. **Expected**: every widget renders via the shared component set; open
   browser dev tools and confirm the rendering code contains no per-widget-id branches (code
   review, not a runtime check).
2. Locate an `unavailable` widget (e.g. Total Machinery). **Expected**: a distinctly-styled
   "Coming soon" card, not hidden, not styled as real data.
3. Temporarily edit a local mock/fixture to add a new widget id with `displayType: 'stat'` the
   frontend has never seen. **Expected**: renders correctly via `StatCard` with zero code changes.
4. Click a widget with an `actionLink` (e.g. Total Employees, once Employees exists). **Expected**:
   navigates there. Click one without `actionLink` (e.g. Total Machinery). **Expected**:
   non-interactive.

## Scenario 2 — Company Dashboard (User Story 2)

1. Load `/dashboard`. **Expected**: KPI row, sidebar, alerts section, and both tables all populate
   from one network call (confirm via dev tools' Network tab — one `GET /dashboard/widgets`).
2. Wait 30 seconds. **Expected**: the widget list re-fetches automatically; a changed value (e.g.
   punch a test employee in via My Workspace in another tab) updates without a page reload.
3. Throttle the network (dev tools) and reload. **Expected**: a per-section or whole-list loading
   state, not a blank page.

## Scenario 3 — Activity Log (User Story 3)

1. Navigate to `/dashboard/activity-log`. **Expected**: entries newest-first, correct format.
2. Filter by module = Settings. **Expected**: list narrows to Settings entries only.
3. Filter by module = Machinery. **Expected**: empty state, not an error.
4. Combine a module filter with a time-range filter. **Expected**: both apply together.
5. Scroll/paginate to the end. **Expected**: more entries load, or a clear "no more" state.
6. With module = Settings still applied, click "Export CSV". **Expected**: a CSV downloads
   directly (no processing state) containing only the Settings entries visible in the list.

## Scenario 4 — Notifications (User Story 4)

1. Seed a pending leave application. Check the header bell. **Expected**: badge count reflects it.
2. Click the bell. **Expected**: dropdown panel opens inline (not a page navigation), listing the
   entry with icon/title/subtitle/action link.
3. Click outside the panel (or press Escape). **Expected**: it closes.
4. Approve the leave application (via backend admin call). Reopen the panel. **Expected**: the
   entry is gone — no dismiss action was used.

## Scenario 5 — Site Dashboard (User Story 5)

1. Navigate to `/dashboard/site`. **Expected**: site selector populated.
2. Select a site. **Expected**: Workers Today (real) and other widgets (placeholder) render for
   that site.
3. Select a different site. **Expected**: widgets re-fetch and update, no stale data lingers.

## Scenario 6 — Group Dashboard and search (User Story 6)

1. Navigate to `/dashboard/group` as a cross-company user. **Expected**: one card per company +
   Group Total.
2. Repeat as a single-company user. **Expected**: only one card.
3. Type 1 character into employee search. **Expected**: no request sent. Type a 2nd character.
   **Expected**: results appear (debounced, not one call per keystroke).
4. Check the Statutory Calendar section. **Expected**: "Coming soon" placeholder.

## Scenario 7 — Reports (User Story 7)

1. Navigate to `/dashboard/reports`. **Expected**: 9 report types listed with availability badges.
2. Select an unavailable type (e.g. Payroll). **Expected**: "Coming soon" state, no filter form.
3. Select Attendance. **Expected**: its declared filters render via the generic filter renderer;
   run it with a date range. **Expected**: tabular results.
4. Export as PDF (small range). **Expected**: direct download.
5. Export as Excel with a large date range (enough rows to exceed the async threshold).
   **Expected**: "Processing..." state, no UI block; poll completes to a ready/download state, and
   an "Export Ready" notification appears in the bell panel.
6. Simulate an export failure (stop the backend mid-job, if feasible). **Expected**: a clear
   failure message, not silence.

## Scenario 8 — Cross-cutting checks

1. Sign out; navigate to any of this feature's routes. **Expected**: existing access-denied
   pattern applies.
2. Tab through every screen's controls using only the keyboard. **Expected**: visible focus
   indicator, all non-widget-specific controls reachable.
3. Resize every screen to a mobile viewport. **Expected**: no horizontal page scroll; tables render
   as cards per the established `ResponsiveList` pattern.
