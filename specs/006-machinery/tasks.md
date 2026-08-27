# Tasks: Machinery Frontend (Asset Register, Logbook, Fuel, Maintenance, Hire Bills, Equipment Categories, Equipment Doc Types, Hire Rates, Utilization Report)

**Input**: Design documents from `/specs/006-machinery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/machinery-ui.md,
quickstart.md — all present.

**Tests**: No automated test framework exists yet in this repo (constitution's documented gap);
verification is manual per quickstart.md, consistent with every prior frontend feature this
session.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 [P] Add `recharts` to `package.json` (research.md §3, constitution v1.2.0).
- [ ] T002 [P] Add `/dashboard/plant/*` route paths and user-facing copy to `app/lib/constants.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Create `app/lib/api/machinery.ts` with `zod` schemas for every entity in data-model.md
  (Equipment, EquipmentDocument, EquipmentCategory, EquipmentDocType, LogbookEntry, FuelEntry,
  ServiceSchedule, MaintenanceJob, HireBill, HireRate, Vendor) and the shared fetch-wrapper
  scaffolding (Principle V).
- [ ] T004 Extend `middleware.ts` with a `/dashboard/plant/*` route matcher mapping each sub-path
  to its permission (`ASSET_REGISTER`/`LOGBOOK`/`FUEL`/`MAINTENANCE`/`HIRE_BILLS`/
  `MACHINERY_SETTINGS`), per research.md §6 — the same guard extension every prior admin feature
  has required.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Asset Register (Priority: P1) 🎯 MVP

**Goal**: Register and browse equipment with document tracking.

**Independent Test**: Add a machine, upload a document with an expiry date, and confirm the list's
Flags badge and the document's derived status.

- [ ] T005 [P] [US1] Implement `listEquipment`, `getEquipment`, `createEquipment`,
  `updateEquipment` in `app/lib/api/machinery.ts` (depends on T003).
- [ ] T006 [US1] Implement `EquipmentList` — `ResponsiveList`-based, Search/Category/Ownership/
  Status/Site filters, Flags badge styling, fully keyboard-operable — in
  `app/ui/machinery/equipment-list.tsx` (depends on T005).
- [ ] T007 [US1] Implement `EquipmentFormModal` (Add/Edit, all fields, keyboard-operable,
  `react-hook-form` + `zod`) in `app/ui/machinery/equipment-form-modal.tsx` (depends on T005).
- [ ] T008 [US1] Implement `app/dashboard/plant/page.tsx` (Server Component initial fetch +
  `EquipmentList` + Add Equipment trigger) (depends on T006, T007).
- [ ] T009 [P] [US1] Implement `listEquipmentDocuments`, `uploadEquipmentDocument` in
  `app/lib/api/machinery.ts` (depends on T003).
- [ ] T010 [US1] Implement `EquipmentDocuments` — mirrors HR & Payroll's `documents-tab.tsx` UI
  pattern with this feature's own data-fetching functions (research.md §4), field-level rejection
  when a required-expiry doc type is uploaded without one (FR-004) — in
  `app/ui/machinery/equipment-documents.tsx` (depends on T009).
- [ ] T011 [US1] Implement `EquipmentDetailTabs` (Overview + Documents) in
  `app/ui/machinery/equipment-detail-tabs.tsx` (depends on T010).
- [ ] T012 [US1] Implement `app/dashboard/plant/[id]/page.tsx` (depends on T011).

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Logbook (Priority: P1)

**Goal**: Daily logbook entries that keep the machine's Current Reading accurate.

**Independent Test**: Add a logbook entry and confirm the machine's Current Reading updates, and
the next Add Entry form pre-fills Opening Reading from it.

- [ ] T013 [P] [US2] Implement `listLogbookEntries`, `createLogbookEntry`, `updateLogbookEntry`,
  `deleteLogbookEntry` in `app/lib/api/machinery.ts` (depends on T003).
- [ ] T014 [US2] Implement `LogbookTable` (`ResponsiveList`-based, with keyboard-operable Edit and
  Delete row actions wired to `updateLogbookEntry`/`deleteLogbookEntry`, FR-008) in
  `app/ui/machinery/logbook-table.tsx` (depends on T013).
- [ ] T015 [US2] Implement `LogbookEntryModal` — Opening Reading pre-fill, the meter-reset
  override confirmation flow (FR-007), keyboard-operable — in
  `app/ui/machinery/logbook-entry-modal.tsx` (depends on T013).
- [ ] T016 [US2] Implement `app/dashboard/plant/logbook/page.tsx` (depends on T014, T015).

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Fuel (Priority: P2)

**Goal**: Record fuel entries and surface variance flags.

**Independent Test**: Record fuel entries pushing a machine's consumption past its threshold and
confirm the resulting flag.

- [ ] T017 [P] [US3] Implement `listFuelEntries` (returns `{ entries, totals }`),
  `createFuelEntry`, `updateFuelEntry`, `deleteFuelEntry` in `app/lib/api/machinery.ts` (depends
  on T003).
- [ ] T018 [US3] Implement `FuelTable` (`ResponsiveList`-based, Summary Totals bar reflecting
  applied filters, a visible fuel-variance flag per row sourced from the backend's computed flag —
  no frontend variance calculation, FR-011) in `app/ui/machinery/fuel-table.tsx` (depends on
  T017).
- [ ] T019 [US3] Implement `FuelEntryModal` — live Amount computation, Vendor dropdown scoped to
  `type: 'fuel'`, an explicit empty-state message when no fuel vendors exist yet (spec Edge
  Cases), keyboard-operable — in `app/ui/machinery/fuel-entry-modal.tsx` (depends on T017).
- [ ] T020 [US3] Implement `app/dashboard/plant/fuel/page.tsx` (depends on T018, T019).

**Checkpoint**: User Stories 1, 2, and 3 all work independently.

---

## Phase 6: User Story 4 - Maintenance (Priority: P2)

**Goal**: Preventive service schedules and maintenance jobs.

**Independent Test**: Open a job linked to a schedule, confirm the machine's Status everywhere it
displays, close it, and confirm the schedule resets.

- [ ] T021 [P] [US4] Implement `listServiceSchedules`, `createServiceSchedule`,
  `listMaintenanceJobs`, `createMaintenanceJob`, `closeMaintenanceJob` in
  `app/lib/api/machinery.ts` (depends on T003).
- [ ] T022 [US4] Implement `DueServicesTable` (`ResponsiveList`-based, red flag when
  `isBelowTenPercent`) in `app/ui/machinery/due-services-table.tsx` (depends on T021).
- [ ] T023 [US4] Implement `MaintenanceJobsTable` with a Close action (`ResponsiveList`-based,
  keyboard-operable) in `app/ui/machinery/maintenance-jobs-table.tsx` (depends on T021).
- [ ] T024 [US4] Implement `ServiceScheduleModal` and `MaintenanceJobModal` (both keyboard-
  operable) in `app/ui/machinery/service-schedule-modal.tsx` /
  `maintenance-job-modal.tsx` (depends on T021).
- [ ] T025 [US4] Implement `app/dashboard/plant/maintenance/page.tsx` (depends on T022, T023,
  T024).

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Hire Bills (Priority: P2)

**Goal**: Verify hire bills against logbook data before authorizing payment.

**Independent Test**: Create a bill with Billed Hours differing from logbook data, Verify it, and
confirm Variance/TDS/Net Payable and the Status workflow.

- [ ] T026 [P] [US5] Implement `listHireBills`, `createHireBill`, `verifyHireBill`,
  `markHireBillPaid` in `app/lib/api/machinery.ts` (depends on T003).
- [ ] T027 [US5] Implement `HireBillList` (`ResponsiveList`-based, Status badges) in
  `app/ui/machinery/hire-bill-list.tsx` (depends on T026).
- [ ] T028 [US5] Implement `HireBillModal` — Machine dropdown restricted to Hired equipment
  (FR-015), Rate/Amount auto-populated from the backend, Vendor empty-state message when none
  exist, keyboard-operable — in `app/ui/machinery/hire-bill-modal.tsx` (depends on T026).
- [ ] T029 [US5] Wire Verify (Variance display, over-billed variance visibly highlighted) and Mark
  Paid (disabled/unavailable unless Status is Verified, FR-017) actions into `HireBillList`
  (depends on T027).
- [ ] T030 [US5] Implement `app/dashboard/plant/hire-bills/page.tsx` (depends on T028, T029).

**Checkpoint**: User Stories 1–5 all work independently.

---

## Phase 8: User Story 6 - Reference Data masters (Priority: P3)

**Goal**: Admin CRUD for Equipment Categories, Equipment Doc Types, and Hire Rates.

**Independent Test**: Edit a seeded category's fuel benchmark and confirm a subsequent Fuel entry
(US3) uses it; add a Hire Rate and confirm the prior "Current" row's Effective To updates.

- [ ] T031 [P] [US6] Implement `listEquipmentCategories`, `createEquipmentCategory`,
  `updateEquipmentCategory` in `app/lib/api/machinery.ts` (depends on T003).
- [ ] T032 [P] [US6] Implement `listEquipmentDocTypes`, `createEquipmentDocType`,
  `updateEquipmentDocType` in `app/lib/api/machinery.ts` (depends on T003).
- [ ] T033 [P] [US6] Implement `listHireRates`, `createHireRate` in `app/lib/api/machinery.ts`
  (depends on T003).
- [ ] T034 [US6] Implement `EquipmentCategoriesTable` + edit modal (`ResponsiveList`-based,
  keyboard-operable) in `app/ui/machinery/equipment-categories-table.tsx` (depends on T031).
- [ ] T035 [US6] Implement `EquipmentDocTypesTable` + edit modal in
  `app/ui/machinery/equipment-doc-types-table.tsx` (depends on T032).
- [ ] T036 [US6] Implement `HireRatesTable` + add modal — effective-dated history per category,
  `null` Effective To rendered as "Current" (FR-019) — in
  `app/ui/machinery/hire-rates-table.tsx` (depends on T033).
- [ ] T037 [US6] Implement `app/dashboard/plant/categories/page.tsx`, `doc-types/page.tsx`,
  `rates/page.tsx` (depends on T034, T035, T036).

**Checkpoint**: User Stories 1–6 all work independently.

---

## Phase 9: User Story 7 - Equipment Utilization Report (Priority: P3)

**Goal**: Monthly fleet utilization visibility.

**Independent Test**: Select a month and confirm the summary cards' counts match the table's Band
column, sorted ascending.

- [ ] T038 [P] [US7] Implement `getUtilizationReport(month)` in `app/lib/api/machinery.ts`
  (depends on T003).
- [ ] T039 [US7] Implement `UtilizationSummaryCards` (Total Machines, Underutilized, Well
  Utilized, Overutilized) in `app/ui/machinery/utilization-summary-cards.tsx` (depends on T038).
- [ ] T040 [US7] Implement `UtilizationBandChart` (`recharts` horizontal stacked bar, research.md
  §3, band segment widths as the constitution's named runtime-computed-value exception) in
  `app/ui/machinery/utilization-band-chart.tsx` (depends on T038).
- [ ] T041 [US7] Implement `UtilizationTable` (`ResponsiveList`-based, sorted by Utilization %
  ascending, Band-matched styling) in `app/ui/machinery/utilization-table.tsx` (depends on T038).
- [ ] T042 [US7] Implement `app/dashboard/plant/utilization/page.tsx` (Month Selector defaulting
  to current month, wiring T039–T041 to refresh together) (depends on T039, T040, T041).

**Checkpoint**: All seven user stories are independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Spot-check every list screen at a mobile viewport (`ResponsiveList` card layout, no
  horizontal scroll, per Principle VI) across all seven stories.
- [ ] T044 [P] Spot-check keyboard operability (tab order, visible focus) across every modal and
  table action.
- [ ] T045 Run quickstart.md validation end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–9)**: All depend on Foundational. US1 and US2 (P1) have no dependency on
  each other. US3, US4, US5 (P2) each depend only on US1 (Equipment existing) and, where noted, US2
  (Logbook data for Fuel variance display and Hire Bill verification) — but each remains
  independently testable using its own seeded/manually-entered data per quickstart.md. US6 and US7
  (P3) depend only on Foundational and US1's Equipment list existing for cross-reference — not on
  US2–US5.
- **Polish (Phase 10)**: Depends on all seven user stories being complete.

### Within Each User Story

- API functions before components; components before the `page.tsx` that assembles them.

### Parallel Opportunities

- All Setup tasks (T001–T002) in parallel.
- Within each user story, the `[P]`-marked API-function task can run alongside other stories' API-
  function tasks once Foundational completes.
- US1 and US2 can be built in parallel by different developers once Foundational completes.
- US6 and US7 can be built in parallel with US3/US4/US5 once Foundational + US1 complete.

---

## Parallel Example: User Story 1

```bash
Task: "Implement listEquipment/getEquipment/createEquipment/updateEquipment in app/lib/api/machinery.ts"
Task: "Implement listEquipmentDocuments/uploadEquipmentDocument in app/lib/api/machinery.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Asset Register)
4. **STOP and VALIDATE**: Test Asset Register independently via quickstart.md Scenario 1
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Asset Register) → test independently → MVP
3. US2 (Logbook) → test independently
4. US3 (Fuel), US4 (Maintenance), US5 (Hire Bills) → test independently (can proceed in parallel)
5. US6 (Reference Data masters), US7 (Utilization Report) → test independently (can proceed in
   parallel with each other and with US3–US5)
6. Polish (mobile/keyboard spot-checks, full quickstart.md validation)

## Notes

- `[P]` tasks touch different files with no unmet dependency.
- `[Story]` labels map every implementation task to its owning user story for traceability.
- Every list/table task states its `ResponsiveList` and keyboard-operability requirement inline
  (learned practice from this project's prior features' analyze passes).
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently.
