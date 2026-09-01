---

description: "Task list for feature implementation"
---

# Tasks: Dashboard & General Frontend (Widgets, Notifications, Activity Log, Reports)

**Input**: Design documents from `/specs/004-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/dashboard-ui.md, quickstart.md

**Tests**: Not included — no automated test framework is installed in `buildcore-web` yet
(constitution's documented gap); verification is manual via `quickstart.md`, including the
"add a simulated new widget, confirm zero code change" check (spec SC-002).

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. All paths are in this repo (`buildcore-web`) — the
backend this feature consumes is a separate, already-fully-specced feature in the sibling
`buildcore-api` repo (`specs/004-dashboard-backend`) and is not re-tasked here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] Add `/dashboard/*` sub-routes, copy, the 30s refresh interval, and the employee-
      search debounce delay to `app/lib/constants.ts`
- [ ] T002 [P] Create `zod` schemas for `WidgetResult`, `NotificationRow`, `ActivityLogEntry`,
      `ReportType`/`FilterSpec`, `ReportResult`, `ExportJobStatus` in `app/lib/api/dashboard.ts`
      (schema definitions only, functions per-story)

**Checkpoint**: Constants and response schemas ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Create `app/ui/dashboard/widget-renderer.tsx`: the `WidgetRenderer` switch component
      plus `KpiCard`, `WidgetTable` (reusing Settings' `ResponsiveList` pattern), `WidgetList`,
      `StatCard`, `ComingSoonCard`, and `UnsupportedWidgetCard` — research.md §1, spec FR-001,
      FR-002, FR-003, FR-017
- [ ] T004 [P] Create `app/ui/dashboard/filter-field.tsx`: the generic `FilterField` switch
      component (text/select/date/dateRange/numberRange) — research.md §6, spec FR-013

**Checkpoint**: The two generic rendering components (the architectural core of this feature) are
ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Generic widget rendering (Priority: P1) 🎯 MVP

**Goal**: Prove the rendering mechanism works end-to-end against real backend widget data before
wiring any specific screen's full layout.

**Independent Test**: Point `WidgetRenderer` at a real `GET /dashboard/widgets` response and
confirm every entry renders correctly with zero per-widget-id code.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Add `getWidgets()` to `app/lib/api/dashboard.ts`
- [ ] T006 [US1] Manually verify `WidgetRenderer` (T003) against a live `GET /dashboard/widgets`
      response in a scratch page or Storybook-less manual render, confirming KPI/table/unavailable
      entries all render correctly (depends on T003, T005) — spec SC-002's "add a simulated widget"
      check belongs here

**Checkpoint**: User Story 1 fully functional and independently testable (the rendering mechanism
itself, ahead of any specific screen's full layout).

---

## Phase 4: User Story 2 - Company Dashboard (Priority: P1)

**Goal**: `/dashboard` renders its full section layout from one widget-list call, replacing the
existing hardcoded placeholder.

**Independent Test**: Load `/dashboard` and confirm KPI row, sidebar, alerts, and both tables all
populate from one network call and refresh on interval.

### Implementation for User Story 2

- [ ] T007 [US2] Rewrite `app/dashboard/page.tsx`: fetch `getWidgets()` (T005), group results by
      `section`, render each group via `WidgetRenderer` (T003), 30s `refetchInterval` (research.md
      §4) — spec FR-004, FR-005 (depends on T003, T005)
- [ ] T008 [US2] Remove `app/ui/dashboard/cards.tsx` (superseded placeholder — research.md §2)
- [ ] T009 [US2] Wire a per-section (or whole-list) loading state and a page-level error-with-retry
      state on `app/dashboard/page.tsx` — spec FR-016, Edge Cases

**Checkpoint**: User Stories 1 AND 2 both independently functional.

---

## Phase 5: User Story 3 - Activity Log (Priority: P1)

**Goal**: A filterable, paginated chronological feed.

**Independent Test**: Load the Activity Log, apply module and time-range filters, confirm correct
narrowing and empty-state handling.

### Implementation for User Story 3

- [ ] T010 [P] [US3] Add `getActivityLog()` and `exportActivityLog()` to
      `app/lib/api/dashboard.ts` — `exportActivityLog` triggers a direct download from
      `GET /activity-log/export?module=&timeRange=` (spec FR-006a)
- [ ] T011 [US3] Create `app/ui/dashboard/activity-log-list.tsx`: `ResponsiveList`-based feed,
      module + time-range filters (combining), pagination/infinite-scroll, distinct empty state per
      filter combination, an "Export CSV" button calling `exportActivityLog()` with the
      currently-applied filters — spec FR-006, FR-006a, FR-007 (depends on T010); native
      `<select>`/`<button>` elements and full keyboard operability for the filters and export
      button, per spec FR-019
- [ ] T012 [US3] Create `app/dashboard/activity-log/page.tsx` (depends on T011)

**Checkpoint**: User Stories 1–3 independently functional.

---

## Phase 6: User Story 4 - Notifications (Priority: P2)

**Goal**: Header bell + badge, dropdown panel, no dismiss control.

**Independent Test**: Seed a pending leave application, confirm it appears in the panel and badge
count; approve it, confirm it disappears on next poll.

### Implementation for User Story 4

- [ ] T013 [P] [US4] Add `getNotifications()`, `getNotificationCount()` to
      `app/lib/api/dashboard.ts`
- [ ] T014 [US4] Create `app/ui/dashboard/notification-bell.tsx`: badge with 30s
      `refetchInterval` (depends on T013)
- [ ] T015 [US4] Create `app/ui/dashboard/notification-panel.tsx`: dropdown panel (click-outside +
      Escape to close — research.md §5), entries via icon/title/subtitle/action link, no dismiss
      control — spec FR-008, FR-009 (depends on T013, T014); focus-trapped while open with a
      native `<button>` trigger, per spec FR-019
- [ ] T016 [US4] Wire `NotificationBell`/`NotificationPanel` into the shell header in
      `app/ui/dashboard/sidenav.tsx` (or wherever header chrome renders)

**Checkpoint**: User Stories 1–4 independently functional.

---

## Phase 7: User Story 5 - Site Dashboard (Priority: P2)

**Goal**: Site selector + site-scoped widgets via the same generic mechanism.

**Independent Test**: Select a site, confirm widgets render and refresh on selection change.

### Implementation for User Story 5

- [ ] T017 [P] [US5] Add `getSites()`, `getSiteWidgets()` to `app/lib/api/dashboard.ts`
- [ ] T018 [US5] Create `app/ui/dashboard/site-selector.tsx`: native `<select>` dropdown, fully
      keyboard-operable (spec FR-019), re-fetches `getSiteWidgets()` on change (depends on T017)
- [ ] T019 [US5] Create `app/dashboard/site/page.tsx`: renders `SiteSelector` +
      `WidgetRenderer`-mapped output (depends on T003, T018)

**Checkpoint**: User Stories 1–5 independently functional.

---

## Phase 8: User Story 6 - Group Dashboard and cross-company employee search (Priority: P2)

**Goal**: Company cards + Group Total via the generic mechanism, plus debounced cross-company
search.

**Independent Test**: Load as cross-company vs. single-company user; search by a 2+ character
term.

### Implementation for User Story 6

- [ ] T020 [P] [US6] Add `getGroupCompanies()`, `getStatutoryCalendar()`,
      `searchGroupEmployees()` to `app/lib/api/dashboard.ts`
- [ ] T021 [US6] Create `app/ui/dashboard/employee-search.tsx`: debounced input, no request below 2
      characters — spec FR-011 (depends on T020); native `<label>`-paired input and keyboard-
      operable result list, per spec FR-019
- [ ] T022 [US6] Create `app/dashboard/group/page.tsx`: renders `WidgetRenderer`-mapped company
      cards + Group Total + Statutory Calendar ("Coming soon"), plus `EmployeeSearch` (depends on
      T003, T020, T021)

**Checkpoint**: User Stories 1–6 independently functional.

---

## Phase 9: User Story 7 - Reports (Priority: P3)

**Goal**: Report-type list, generic filter rendering, run + export (sync and async) handling.

**Independent Test**: List types, run Attendance, export to PDF/Excel, trigger a large async
export and confirm the processing/ready flow.

### Implementation for User Story 7

- [ ] T023 [P] [US7] Add `getReportTypes()`, `runReport()`, `exportReport()`, `getExportStatus()`
      to `app/lib/api/dashboard.ts` (branches 200-blob vs 202-jobId per research.md §7)
- [ ] T024 [US7] Create `app/ui/dashboard/report-type-list.tsx`: availability badges, "Coming
      soon" state for unavailable types — spec FR-012 (depends on T023); native `<button>`
      elements per type, fully keyboard-operable, per spec FR-019
- [ ] T025 [US7] Create `app/ui/dashboard/report-result-table.tsx`: reuses `WidgetTable` (T003) for
      report rows (depends on T003)
- [ ] T026 [US7] Create `app/dashboard/reports/page.tsx`: renders `ReportTypeList`, `FilterField`
      (T004)-driven filter form + date-range picker, `ReportResultTable`, Export action (depends on
      T004, T023, T024, T025); native `<label>`/`<button>` elements and full keyboard operability
      for the filter form and Export action, per spec FR-019
- [ ] T027 [US7] Wire the export flow on the Reports page: sync (200) triggers direct blob
      download; async (202) shows "Processing..." and polls `getExportStatus()` until terminal,
      with a failure state distinct from processing — spec FR-014, FR-015 (depends on T023, T026)

**Checkpoint**: All seven user stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Run `npm run lint` and `next build`/`tsc --noEmit` across all new/modified files
- [ ] T029 [P] Manually verify SC-002 by adding a simulated new widget id/displayType to a test
      fixture and confirming it renders with zero code changes (beyond T006's initial check, this
      is the final regression confirmation)
- [ ] T030 [P] Manually verify every non-widget-specific interactive control (filters, selectors,
      search, export buttons) is keyboard-operable with a visible focus indicator — spec FR-019
- [ ] T031 [P] Manually verify every screen renders correctly at a mobile viewport (no horizontal
      scroll, `ResponsiveList` card layout) — spec FR-019
- [ ] T032 Update `app/ui/dashboard/nav-links.tsx`: add Group Dashboard, Site Dashboard, Activity
      Log entries; point Reports at the real `/dashboard/reports` route (contracts/dashboard-ui.md)
- [ ] T033 Run the full `quickstart.md` validation scenarios end-to-end and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the two generic renderer
  components are what every screen depends on)
- **User Stories (Phase 3–9)**: All depend on Foundational
  - US1 (rendering-mechanism proof) has no dependency on other stories and is the smallest,
    fastest-to-verify story — a good first target even though its "screen" is really just T006's
    manual check
  - US2 (Company Dashboard) depends only on Foundational + US1's `getWidgets()` (T005)
  - US3 (Activity Log), US4 (Notifications), US5 (Site Dashboard), US6 (Group Dashboard) are all
    mutually independent, each only depending on Foundational's `WidgetRenderer` where relevant
  - US7 (Reports) depends on Foundational's `FilterField` (T004) and `WidgetRenderer` (T003) but
    not on US2–US6
- **Polish (Phase 10)**: Depends on all desired user stories being complete; T032 (nav-links)
  should land once its target routes exist, so naturally near the end

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- T003 and T004 (Foundational) are independent files and can be built in parallel
- Once Foundational completes, US2 through US7 can all proceed in parallel (each only consumes the
  shared `WidgetRenderer`/`FilterField` components, never modifying them)

---

## Parallel Example: User Story 3

```bash
# Launch independent pieces of User Story 3 together:
Task: "Add getActivityLog() to app/lib/api/dashboard.ts"
Task: "Create app/ui/dashboard/activity-log-list.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — the two generic renderers everything else depends on)
3. Complete Phase 3: User Story 1 (prove the rendering mechanism)
4. Complete Phase 4: User Story 2 (Company Dashboard, replacing the old placeholder)
5. **STOP and VALIDATE**: Run quickstart.md Scenarios 1–2 independently
6. Deploy/demo if ready — a real, extensible Dashboard replacing the zeros-only placeholder

### Incremental Delivery

1. Setup + Foundational → the two generic renderer components ready
2. US1 (prove mechanism) → US2 (Company Dashboard) → test independently → MVP
3. US3 (Activity Log) → US4 (Notifications) → US5 (Site Dashboard) → US6 (Group Dashboard) → each
   tested independently
4. US7 (Reports) → tested independently → feature complete

---

## Amendment 2026-09-01 — Department Dashboard and Reminders Centre

Covers spec FR-020 to FR-030 and plan Phases A1–A4. Task IDs prefixed `TA`. **No new permission**
(reuses `DASHBOARD`).

**Build-order note**: TA006–TA011 (the Reminders centre) unblock the 002, 006, and 012 amendments,
which all render from it rather than evaluating reminders themselves. Schedule them early.

- [ ] TA001 Extend the dashboard API module with department-widget and reminders functions plus
      `zod` schemas
- [ ] TA002 [P] Add reminder severity labels and colour maps to constants
- [ ] TA003 [US8] `department-selector.tsx` populated from the API, showing **only the caller's
      permitted departments** (spec FR-023)
- [ ] TA004 [US8] `app/dashboard/department/page.tsx` rendering through the **existing shared widget
      components** — no second rendering path or response shape (spec FR-020)
- [ ] TA005 [US8] Selected department encoded in the URL so the view is shareable and survives
      reload (spec FR-022); empty department renders zero values, not an error (spec FR-021);
      unbuilt-module widgets fall through to the existing "Coming soon" treatment
- [ ] TA006 [US9] `reminders-list.tsx`: source module, type, subject, due date, signed days
      remaining, and severity via `StatusBadge`; **overdue first, then soonest due** (spec FR-025)
- [ ] TA007 [US9] Module / type / severity filters without a full-page reload
- [ ] TA008 [US9] An unavailable module source **reported as such without failing the screen**
      (spec FR-026)
- [ ] TA009 [US9] `snooze-modal.tsx` collecting an until-date and a reason (spec FR-029)
- [ ] TA010 [US9] Header reminder count **visually distinguishable from the existing notifications
      badge** (spec FR-027)
- [ ] TA011 [US9] Row click navigates to the underlying record in its owning module (spec FR-028);
      distinct empty state, not an error
- [ ] TA012 [P] Confirm no cross-department KPI leakage (SC-A01)
- [ ] TA013 [P] 320px spot-check both screens; `npx tsc --noEmit`

**Unblocks**: 002 TA011, 006 TA017, 012 T044.
