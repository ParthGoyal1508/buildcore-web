---

description: "Task list for feature implementation"
---

# Tasks: Plant & Machinery Frontend

**Input**: Design documents from `/specs/006-plant-machinery/`

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 [P] Add "Plant & Machinery" nav group to `nav-links.tsx`: Asset Register, Logbook,
      Fuel, Maintenance, Services, Hire Bills
- [ ] T002 [P] Create `app/dashboard/plant/layout.tsx` (breadcrumb + sub-nav)
- [ ] T003 [P] Create `app/lib/api/plant.ts` with all typed API function stubs
- [ ] T004 [P] Extend `StatusBadge` with plant statuses: `under_maintenance`=orange,
      `inactive`=gray, `due_soon`=orange, `overdue`=red, `pending_verification`=gray,
      `verified`=blue

---

## Phase 2: US1 — Asset Register (P1) 🎯 MVP

- [ ] T005 [P] [US1] `app/ui/plant/EquipmentModal.tsx`: Add/Edit equipment form (Code, Name,
      Category dropdown, Ownership, Vendor if Hired, Power Source, Meter Type, Site dropdown,
      Depreciation Rate if owned)
- [ ] T006 [P] [US1] `app/ui/plant/EquipmentDocumentRow.tsx`: document type, file link, expiry,
      alert badge (Expiring Soon/Expired)
- [ ] T007 [US1] `app/dashboard/plant/equipment/page.tsx`: `AssetRegisterPage` — table with
      Code/Name/Category/Ownership/Site/Reading/Status/Utilisation%/Doc Alert; "Add Equipment"
      button; wire `@tanstack/react-query`
- [ ] T008 [US1] `app/dashboard/plant/equipment/[id]/page.tsx`: Equipment detail with tabs
      (Overview, Documents, Logbook, Fuel, Maintenance, Services, Hire Bills)

---

## Phase 3: US2 — Logbook (P1)

- [ ] T009 [P] [US2] `app/ui/plant/LogbookModal.tsx`: Equipment dropdown, Date, Opening Reading,
      Closing Reading, Total Hours (live: closing − opening via `watch` — FR-002), Fuel Consumed,
      Operator dropdown (HR employees), Project dropdown; inline error for closing < opening
- [ ] T010 [US2] `app/dashboard/plant/logbook/page.tsx`: Logbook list + filters (equipment,
      project, date range), "Add Entry" button + `LogbookModal`

---

## Phase 4: US3 — Fuel (P2)

- [ ] T011 [P] [US3] `app/ui/plant/FuelModal.tsx`: Equipment, Date, Quantity, Rate, Amount
      (live: qty × rate — FR-003), Vendor; `varianceAlert` badge shown if backend returns it
- [ ] T012 [US3] `app/dashboard/plant/fuel/page.tsx`: Fuel list with Variance % and alert badge;
      monthly summary view

---

## Phase 5: US4 — Maintenance (P2)

- [ ] T013 [P] [US4] `app/ui/plant/MaintenanceModal.tsx`: Equipment dropdown, Type (Breakdown/
      Scheduled), Description, Link to Service Schedule (optional); Close Job modal (closing
      reading, date, parts, costs)
- [ ] T014 [US4] `app/dashboard/plant/maintenance/page.tsx`: Maintenance list + filters;
      on job open/close invalidate equipment query (status badge updates — FR-005)

---

## Phase 6: US5 — Service Schedules (P2)

- [ ] T015 [P] [US5] `app/ui/plant/ServiceScheduleModal.tsx`: Equipment, Service Type, Interval,
      Last Done Reading; Next Due = Last Done + Interval shown as preview
- [ ] T016 [US5] `app/dashboard/plant/services/page.tsx`: Schedule list with status badges

---

## Phase 7: US6 — Hire Bills (P3)

- [ ] T017 [P] [US6] `app/ui/plant/HireBillModal.tsx`: Equipment (hired only), Vendor, Billed
      Hours, Rate, Billing Period; shows computed Gross Amount, Logbook Hours, Variance, TDS,
      Net Payable as read-only preview fields
- [ ] T018 [US6] `app/dashboard/plant/hire-bills/page.tsx`: Hire Bills list with status badges;
      Verify (+ confirmation dialog showing variance) and Pay (payment date + reference modal)

---

## Phase 8: Polish

- [ ] T019 [P] Verify all monetary values use `formatCurrency`
- [ ] T020 [P] Verify status badges across all plant pages
- [ ] T021 [P] TypeScript type check (`npx tsc --noEmit`)
