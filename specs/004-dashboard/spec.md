# Feature Specification: Dashboard & General Frontend (Widgets, Notifications, Activity Log, Reports)

**Feature Branch**: `004-dashboard`

**Created**: 2026-08-27

**Status**: Draft

## Clarifications

### Session 2026-08-27

- Q: Should Notifications be a header bell dropdown panel or a dedicated full page? → A: Dropdown
  panel — clicking the bell opens a panel anchored to the header showing the list inline; no new
  route needed.

**Input**: User description: "Dashboard & General Module (Dashboard, Group Dashboard, Site
Dashboard, Notifications, Activity Log, Reports) for the BuildCore ERP frontend (buildcore-web),
per the PRD at /Users/parthgoyal/Projects/ERP-Demo/docs/prd/02-dashboard.prd.md. Nested under the
existing admin /dashboard/* shell. This is the frontend mirror of the backend's confirmed
architecture (buildcore-api specs/004-dashboard-backend): the backend returns a self-describing
list of widgets/notifications/report-types; the frontend's job is to render this list generically
— a small set of shared display-type renderers, switched on each entry's own displayType field —
with no widget-specific frontend components and no per-widget hardcoded knowledge. Every entry
(including unavailable ones) renders uniformly, showing a distinctly-styled 'Coming soon'
placeholder for the unavailable state, rather than the frontend filtering/hiding entries by name."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generic widget rendering (Priority: P1)

An admin opens the Dashboard and sees every widget the backend currently registers — real KPIs,
tables, and stats where computable, and a distinctly-styled "Coming soon" placeholder for anything
not yet available — all rendered by the same small set of shared components, without the frontend
needing to know in advance which widgets exist.

**Why this priority**: This is the architectural requirement the whole feature is built around: the
frontend stays dumb and renders whatever the backend returns, so a new widget appearing in the
backend's response later requires no frontend change at all. Every other user story's screen reuses
this same rendering mechanism.

**Independent Test**: Can be fully tested by pointing the Dashboard at a backend response
containing a real KPI widget, a real table widget, and an unavailable-state widget, and confirming
all three render correctly through the same generic component set with zero widget-specific code
paths.

**Acceptance Scenarios**:

1. **Given** the backend's widget list response, **When** the Dashboard loads, **Then** each entry
   renders using the shared renderer matching its `displayType` (KPI card, table, list, or stat) —
   there is no per-widget-id conditional in the rendering code.
2. **Given** a widget entry with an `unavailable` state, **When** rendered, **Then** it appears as a
   visually distinct, clearly-labeled "Coming soon" placeholder in its designated section — not
   hidden, not styled identically to a real value, and not erroring.
3. **Given** a widget entry with a real `value`, **When** rendered, **Then** its section placement
   (KPI row, sidebar, alerts, table area) matches the `section` field the backend provided — the
   frontend does not hardcode section assignment per widget id.
4. **Given** a backend response that includes a widget id the frontend has never seen before (a
   simulated "future" addition), **When** rendered, **Then** it renders correctly through the same
   generic mechanism, proving no frontend change would actually be required for a real future
   addition.
5. **Given** a widget entry that includes an `actionLink` field, **When** clicked, **Then** it
   navigates there; **given** a widget entry with no `actionLink` (e.g. an `unavailable` one, or one
   whose target screen doesn't exist yet), **When** rendered, **Then** it is simply non-interactive
   — the frontend decides clickability purely from the presence of `actionLink` on the entry itself,
   never from its own knowledge of which routes exist.

---

### User Story 2 - Company Dashboard (Priority: P1)

An admin lands on `/dashboard` (the app's existing home page) and sees the full widget layout: KPI
row, quick-stats sidebar, alerts section, and the two supporting tables — all sourced from a single
widget-list call.

**Why this priority**: The primary landing screen; delivers the bulk of this feature's day-one
value by rendering real data for what's computable today.

**Independent Test**: Can be fully tested by loading `/dashboard` against a seeded backend and
confirming every section renders its widgets in the right place, refreshing on the documented
interval.

**Acceptance Scenarios**:

1. **Given** `/dashboard` loads, **When** the widget list resolves, **Then** the KPI row, sidebar,
   alerts section, and both tables all populate from that single response — no separate per-section
   API calls.
2. **Given** the page has been open for the documented refresh interval, **When** that interval
   elapses, **Then** the widget list is re-fetched and any changed values update without a full
   page reload.
3. **Given** a widget's backend response takes longer than expected, **When** the page is still
   loading, **Then** a loading state is shown per-section (or for the whole list), not a blank page.

---

### User Story 3 - Activity Log (Priority: P1)

An admin views a chronological feed of recorded actions, filterable by module and time range.

**Why this priority**: High-value, and unlike most of this feature's other areas, backed entirely
by already-computable backend data — no widget/placeholder complexity involved.

**Independent Test**: Can be fully tested by loading the Activity Log with no filters, confirming
entries render newest-first in the documented format, then applying module and time-range filters
and confirming the list narrows correctly.

**Acceptance Scenarios**:

1. **Given** the Activity Log screen, **When** loaded, **Then** entries render newest-first as
   avatar/icon → user → action → target → timestamp.
2. **Given** the module filter (All / HR / Payroll / Machinery / Projects / Inventory / Partners /
   Settings) and the time-range filter (Today / 7 days / 30 days), **When** either is changed,
   **Then** the list re-fetches and narrows accordingly; the two filters combine.
3. **Given** a module filter with currently zero matching entries (e.g. Machinery), **When**
   selected, **Then** an empty state is shown, not an error.
4. **Given** the list, **When** scrolled/paginated to its end, **Then** further entries load
   (or a clear "no more entries" state is shown) rather than the list simply stopping silently.

---

### User Story 4 - Notifications (Priority: P2)

An admin sees a bell icon with a badge count in the shell header; opening it shows currently-active
notifications, which disappear automatically once resolved.

**Why this priority**: Builds on User Story 1's rendering approach for a second list type; valuable
but not the primary landing screen.

**Independent Test**: Can be fully tested by seeding a pending leave application, confirming it
appears in the notification dropdown panel and the bell badge count increments, then approving it
and confirming both update without a manual dismiss action.

**Acceptance Scenarios**:

1. **Given** active notifications exist, **When** the shell header renders, **Then** the bell badge
   shows the current count, refreshed on the documented polling interval.
2. **Given** the bell is clicked, **When** the dropdown panel opens (per clarification — anchored
   to the header, not a separate page), **Then** each entry shows its icon (color-coded by
   severity), title, subtitle, and an action link to the relevant page.
3. **Given** a notification's underlying condition resolves, **When** the list is next refreshed,
   **Then** it no longer appears — there is no dismiss/close control anywhere in this feature.
4. **Given** zero active notifications, **When** the panel is opened, **Then** a clear empty state
   is shown, and the bell badge shows no count (or a zero/hidden badge).
5. **Given** the panel is open, **When** a click occurs outside it (or Escape is pressed), **Then**
   it closes, consistent with standard dropdown-panel behavior.

---

### User Story 5 - Site Dashboard (Priority: P2)

An admin selects a site from a dropdown and sees that site's widget set, refreshing on selection
change.

**Why this priority**: Reuses User Story 1's rendering mechanism entirely; valuable for site-level
oversight but secondary to the main Dashboard.

**Independent Test**: Can be fully tested by selecting a seeded site and confirming its widgets
(Workers Today real, others placeholder) render and refresh when a different site is selected.

**Acceptance Scenarios**:

1. **Given** the Site Dashboard, **When** loaded, **Then** the site selector is populated from the
   backend's site list for the caller's company.
2. **Given** a site is selected, **When** its widget list resolves, **Then** the same generic
   rendering mechanism (User Story 1) displays its KPIs and tables, real or placeholder per the
   backend's response.
3. **Given** a different site is selected, **When** the change is made, **Then** the widget list
   re-fetches for the new site and the display updates — no stale data from the previous selection
   lingers.

---

### User Story 6 - Group Dashboard and cross-company employee search (Priority: P2)

An admin sees per-company summary cards plus a Group Total, and can search for an employee across
every company they can access.

**Why this priority**: Reuses the widget-rendering mechanism for company cards; the search is a
small, independent, high-value addition.

**Independent Test**: Can be fully tested by loading Group Dashboard as a cross-company user
(multiple cards + Group Total) versus a single-company user (one card), then searching for a known
employee by a partial name.

**Acceptance Scenarios**:

1. **Given** Group Dashboard loads, **When** the company-cards widget list resolves, **Then** one
   card per accessible company plus a Group Total render via the same generic mechanism (real
   Headcount, placeholder for the rest).
2. **Given** the Statutory Calendar section, **When** rendered, **Then** it shows the "Coming soon"
   placeholder, consistent with User Story 1's unavailable-state treatment.
3. **Given** the employee search field, **When** at least 2 characters are entered, **Then**
   results appear (debounced, not one request per keystroke); **When** fewer than 2 characters are
   present, **Then** no request is sent and no results are shown.

---

### User Story 7 - Reports (Priority: P3)

An admin selects a report type, sees whether it's available or "Coming soon," and for available
ones applies filters, views results, and exports to PDF or Excel — with large exports handled
asynchronously.

**Why this priority**: The least time-critical area, and most of the 8 named report types are
placeholder-only today.

**Independent Test**: Can be fully tested by listing report types (confirming availability
badges), running the Attendance report, exporting it, and separately triggering a large export to
confirm the async/notification path.

**Acceptance Scenarios**:

1. **Given** the Reports screen, **When** loaded, **Then** all 9 report types (8 PRD-named +
   Equipment Utilization) are listed, each showing an availability badge; selecting an unavailable
   one shows the "Coming soon" state instead of a filter form.
2. **Given** an available report type, **When** selected, **Then** its specific filters (from the
   backend's declared filter metadata, not hardcoded per report) render, followed by a date range
   picker and a tabular result once run.
3. **Given** a report result, **When** Export (PDF or Excel) is chosen, **Then** a small export
   completes and downloads directly; a large export instead shows a "processing" state and the
   file becomes available (download link, or via the Notifications' "Export Ready" entry) once
   ready — the screen never hangs waiting for a large export synchronously.
4. **Given** an export that fails, **When** its status is checked, **Then** a clear failure message
   is shown, not silence or an indefinite "processing" state.

---

### Edge Cases

- What happens when the widget-list backend call itself fails (network error, 500)? A clear
  page-level error state with a retry action is shown, distinct from any individual widget's
  `unavailable` state (which is a normal, successful response, not an error).
- What happens when a user without Dashboard-area access navigates to any of this feature's routes?
  The existing access-denied pattern (established by the Settings feature) applies uniformly.
- What happens if the backend adds a `displayType` value this frontend's renderer set doesn't
  recognize? It falls back to a generic "unsupported widget" placeholder rather than crashing the
  whole page — one bad/newer widget entry must never break the rest of the list.
- What happens to the Site Dashboard when a company has zero sites yet? The selector shows an
  empty state guiding the admin to Settings' Employee Setup area, rather than an empty dropdown
  with no explanation.
- What happens to the notification bell while the panel is open and a poll refresh occurs mid-view?
  The list updates in place without closing the panel or losing scroll position.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render every widget/report-result entry using a shared set of
  display-type components (KPI card, table, list, stat) selected by that entry's own `displayType`
  field — the codebase MUST NOT contain a per-widget-id conditional or a widget-specific component
  for any individual tile.
- **FR-002**: The system MUST render an `unavailable` entry as a distinctly-styled "Coming soon"
  placeholder in its designated section, through the same generic rendering path as a real value —
  never hidden, filtered out, or treated as an error.
- **FR-003**: The system MUST place each rendered entry according to the `section` field the
  backend provides, not a frontend-hardcoded per-widget-id layout mapping.
- **FR-004**: The system MUST render the main Dashboard (`/dashboard`) from a single widget-list
  call covering the KPI row, sidebar, alerts section, and both table widgets.
- **FR-005**: The system MUST refresh the active widget list on the documented polling interval
  without a full page reload, updating only the values that changed.
- **FR-006**: The system MUST provide an Activity Log screen with module and time-range filters
  that combine, rendering entries newest-first in the documented format, with pagination or
  infinite scroll for entries beyond the first page.
- **FR-007**: The system MUST show a distinct empty state (not an error) when a selected Activity
  Log filter combination currently matches zero entries.
- **FR-008**: The system MUST show a bell icon with a badge reflecting the current active-
  notification count in the shell header, refreshed on the documented polling interval.
- **FR-009**: The system MUST render notification entries (icon/severity, title, subtitle, action
  link) with no dismiss/close control anywhere — an entry's disappearance on next refresh is the
  only removal mechanism.
- **FR-010**: The system MUST provide a Site Dashboard with a site selector (populated from the
  backend) whose selection change re-fetches and re-renders that site's widget list via the same
  generic mechanism as the main Dashboard.
- **FR-011**: The system MUST provide a Group Dashboard rendering company-card widgets (and a Group
  Total) via the generic mechanism, plus a debounced cross-company employee search requiring a
  minimum 2-character input before any request is sent.
- **FR-012**: The system MUST provide a Reports screen listing all registered report types with an
  availability badge per type, rendering an unavailable type's selection as the "Coming soon" state
  instead of a filter form.
- **FR-013**: For an available report type, the system MUST render its filter fields from the
  backend's declared filter metadata (not a per-report hardcoded form) using a small, shared set of
  generic filter-input renderers (text, single-select, date, date-range, number-range — matching
  each filter's own declared type, the same generic-rendering principle as FR-001), plus a shared
  date-range picker for the report's overall From/To range.
- **FR-014**: The system MUST handle a synchronous export by triggering a direct file download, and
  an asynchronous export by showing a processing state and polling (or relying on the Notifications
  "Export Ready" entry) until the file is ready, without blocking the UI on a long-running request.
- **FR-015**: The system MUST show a clear failure state for a failed export, distinguishable from
  the processing state.
- **FR-016**: The system MUST show a page-level error state with retry for a failed widget-list (or
  any other list) request, distinct from a successful response containing `unavailable` entries.
- **FR-017**: The system MUST fall back to a generic "unsupported widget" placeholder — without
  crashing the rest of the page — for any `displayType` value the current renderer set doesn't
  recognize.
- **FR-018**: All requests to `buildcore-api`'s Dashboard endpoints MUST go through the typed
  `app/lib/api/` fetch wrapper, per the constitution's API Access Boundary principle.
- **FR-019**: Every screen in this feature MUST remain usable at mobile viewport widths without
  horizontal page scrolling, and every non-widget-specific interactive control (filters, selectors,
  search, export buttons) MUST be keyboard-operable with semantic HTML, per this app's established
  mobile-first and basic-accessibility conventions.

### Key Entities

- **Widget Entry (view)**: One rendered tile — id, `displayType`, title, `section`, an optional
  `actionLink` (present only when a target screen is ready to navigate to, per clarification), and
  either a value or an `unavailable` marker — mirrors the backend's Widget Result exactly; this
  frontend adds no fields of its own.
- **Notification Entry (view)**: Mirrors the backend's notification row (type, severity, title,
  subtitle, action link).
- **Report Type (view)**: Mirrors the backend's report-type registration — id, name, availability,
  and filter metadata (each filter declaring its own `type`: text/select/date/dateRange/
  numberRange, plus options for `select`), rendered via the shared generic filter-input renderers
  (FR-013).
- **Export Job (view)**: Mirrors the backend's export-job status (pending/processing/ready/failed,
  download reference) for the async-export UI state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Dashboard's full widget set renders (all sections populated or placeholder) in
  under 3 seconds under normal load, matching the PRD's own performance target.
- **SC-002**: Across all testing, zero widget-specific (per-id) rendering code exists anywhere in
  this feature — verified by adding a simulated new widget entry to a test backend response and
  confirming it renders correctly with no frontend code change.
- **SC-003**: Across all testing, 100% of `unavailable` entries render as the "Coming soon"
  placeholder, never hidden and never styled as if they were real data.
- **SC-004**: Across all testing, zero notifications remain visible after their underlying
  condition has resolved, with no dismiss action ever exposed.
- **SC-005**: Across all testing, a large export never blocks the UI — a processing state or
  navigation away is always possible while it completes.
- **SC-006**: Every interactive, non-widget-specific control across this feature's screens can be
  reached and operated using only a keyboard, in testing.

## Assumptions

- Per the confirmed architecture, this feature builds a small, fixed set of generic display-type
  renderers (KPI card, table, list, stat, plus the shared "unavailable"/"unsupported" placeholder
  states) and contains zero widget-specific components — this is the central design constraint
  every user story above is written against.
- Routes nest under the existing `/dashboard/*` shell (`DashboardLayout`/`SideNav`), consistent
  with the Settings feature's established placement decision: `/dashboard` (main, already the app's
  home page), `/dashboard/group`, `/dashboard/site`, `/dashboard/activity-log`, `/dashboard/
  reports`; `nav-links.tsx` already has "Dashboard" and "Reports" entries and gains "Group
  Dashboard," "Site Dashboard," and "Activity Log" entries. Notifications are reached via a bell
  icon in the shell header opening a dropdown panel (per clarification), not a new sidenav entry
  or route.
- The Activity Log's module filter list (All / HR / Payroll / Machinery / Projects / Inventory /
  Partners / Settings) is a small, stable, hardcoded set of options in this frontend — unlike
  widgets/reports, the PRD does not ask for this specific list to be extensible, so hardcoding it
  does not conflict with the "backend-driven" architecture's actual goal.
- "Refreshed on a polling interval" (PRD's own wording for the notification bell and live widget
  data) is implemented as polling, not push/WebSocket, consistent with no real-time infrastructure
  existing anywhere else in this app's stack (matching the same decision already made for the My
  Workspace feature's live-data needs); the exact interval is a planning-level detail expected to
  match the backend's own documented refresh interval (30 seconds).
- Equipment Utilization Report is one more entry in the Reports screen's report-type list (per the
  backend's registration), not a bespoke screen — it becomes a real, filter-rich report once the
  Machinery module lands, without requiring rework of this feature's generic Reports screen.
- No automated test framework exists yet in this repo; verification (including the "add a
  simulated widget and confirm no code change is needed" check in SC-002) is manual, per this
  app's established known gap.
