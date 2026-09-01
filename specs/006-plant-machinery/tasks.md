---

description: "Task list for feature implementation"
---

# Tasks: Plant & Machinery Frontend

**Input**: Design documents from `/specs/006-plant-machinery/`

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 [P] Add "Plant & Machinery" nav group to `nav-links.tsx`: Asset Register, Logbook,
      Fuel, Maintenance, Services, Hire Bills, Masters
- [ ] T002 [P] Create `app/dashboard/plant/layout.tsx` (breadcrumb + sub-nav)
- [ ] T003 [P] Create `app/lib/api/plant.ts` with all typed API function stubs
- [ ] T004 [P] Extend `StatusBadge` with plant statuses: `under_maintenance`=orange,
      `inactive`=gray, `due_soon`=orange, `overdue`=red, `pending_verification`=gray,
      `verified`=blue
- [ ] T004a Extend `middleware.ts` with a `/dashboard/plant/*` route matcher mapping each
      sub-path to its permission (`MACHINERY`/`LOGBOOK`/`FUEL`/`MAINTENANCE`/`HIRE_BILLS`/
      `SETTINGS`), mirroring the backend's corrected permission mapping — FR-009, missing
      entirely from this feature's original task list

---

## Phase 2: US1 — Asset Register (P1) 🎯 MVP

- [ ] T005 [P] [US1] `app/ui/plant/EquipmentModal.tsx`: Add/Edit equipment form (Code, Name,
      Category dropdown, Ownership, Vendor if Hired, Power Source, Meter Type, Site dropdown,
      Depreciation Rate if owned)
- [ ] T006 [P] [US1] `app/ui/plant/EquipmentDocumentRow.tsx`: document type, file link, expiry,
      alert badge (Expiring Soon/Expired)
- [ ] T007 [US1] `app/dashboard/plant/equipment/page.tsx`: `AssetRegisterPage` — `ResponsiveList`
      -based table with Code/Name/Category/Ownership/Site/Reading/Status/Utilisation%/Doc Alert,
      fully keyboard-operable (FR-010); "Add Equipment" button; wire `@tanstack/react-query`
- [ ] T008 [US1] `app/dashboard/plant/equipment/[id]/page.tsx`: Equipment detail with tabs
      (Overview, Documents, Logbook, Fuel, Maintenance, Services, Hire Bills)

---

## Phase 3: US2 — Logbook (P1)

- [ ] T009 [P] [US2] `app/ui/plant/LogbookModal.tsx`: Equipment dropdown, Date, Opening Reading,
      Closing Reading, Total Hours (live: closing − opening via `watch` — FR-002), Fuel Consumed,
      Operator dropdown (HR employees), Project dropdown; inline error for closing < opening
- [ ] T010 [US2] `app/dashboard/plant/logbook/page.tsx`: `ResponsiveList`-based Logbook list
      (FR-010) + filters (equipment, project, date range), "Add Entry" button + `LogbookModal`

---

## Phase 4: US3 — Fuel (P2)

- [ ] T011 [P] [US3] `app/ui/plant/FuelModal.tsx`: Equipment, Date, Quantity, Rate, Amount
      (live: qty × rate — FR-003), Vendor; `varianceAlert` badge shown if backend returns it
- [ ] T012 [US3] `app/dashboard/plant/fuel/page.tsx`: `ResponsiveList`-based Fuel list (FR-010)
      with Variance % and alert badge; monthly summary view

---

## Phase 5: US4 — Maintenance (P2)

- [ ] T013 [P] [US4] `app/ui/plant/MaintenanceModal.tsx`: Equipment dropdown, Type (Breakdown/
      Scheduled), Description, Link to Service Schedule (optional); Close Job modal (closing
      reading, date, parts, costs)
- [ ] T014 [US4] `app/dashboard/plant/maintenance/page.tsx`: `ResponsiveList`-based Maintenance
      list (FR-010) + filters; on job open/close invalidate equipment query (status badge updates
      — FR-005)

---

## Phase 6: US5 — Service Schedules (P2)

- [ ] T015 [P] [US5] `app/ui/plant/ServiceScheduleModal.tsx`: Equipment, Service Type, Interval,
      Last Done Reading; Next Due = Last Done + Interval shown as preview
- [ ] T016 [US5] `app/dashboard/plant/services/page.tsx`: `ResponsiveList`-based Schedule list
      (FR-010) with status badges

---

## Phase 7: US6 — Hire Bills (P3)

- [ ] T017 [P] [US6] `app/ui/plant/HireBillModal.tsx`: Equipment (hired only), Vendor, Billed
      Hours, Rate, Billing Period; shows computed Gross Amount, Logbook Hours, Variance, TDS,
      Net Payable as read-only preview fields
- [ ] T018 [US6] `app/dashboard/plant/hire-bills/page.tsx`: `ResponsiveList`-based Hire Bills list
      (FR-010) with status badges; Verify (+ confirmation dialog showing variance) and Pay
      (payment date + reference modal)

---

## Phase 8: US7 — Reference Data Masters (P1)

- [ ] T018a [P] [US7] `app/ui/plant/EquipmentCategoryModal.tsx`,
      `EquipmentDocTypeModal.tsx`, `HireRateModal.tsx`: add/edit forms for each master
- [ ] T018b [US7] `app/dashboard/plant/masters/page.tsx`: three-tab screen (Categories/Doc
      Types/Hire Rates), each tab a `ResponsiveList`-based table (FR-010); Hire Rates tab shows
      the effective-dated history per category with `null` `effectiveTo` rendered as "Current"
- [ ] T018c [US7] Wire `EquipmentModal.tsx` (T005) and `EquipmentDocumentRow.tsx` (T006)'s
      Category/Doc Type dropdowns to `listEquipmentCategories()`/`listEquipmentDocTypes()`
      (`app/lib/api/plant.ts`) rather than a hardcoded list — FR-008

---

## Phase 9: Polish

- [ ] T019 [P] Verify all monetary values use `formatCurrency`
- [ ] T020 [P] Verify status badges across all plant pages
- [ ] T021 [P] TypeScript type check (`npx tsc --noEmit`)
- [ ] T021a [P] Spot-check every list screen across all seven user stories at a mobile viewport
      (`ResponsiveList` card layout, no horizontal scroll) and for keyboard operability — FR-010

---

## Amendment 2026-09-01 — Spare Parts and Service Bills Screens

Covers spec FR-011 to FR-020 and plan Phase A8. Task IDs prefixed `TA`. **No new permission**
(reuses `MAINTENANCE`).

**Note**: a `plan.md` was created for this feature during the same pass — it was the only frontend
feature without one. See [plan.md](plan.md).

- [ ] TA001 Extend `app/lib/api/plant.ts` with spare-part, part-movement, and service-bill functions
      plus their `zod` schemas (spec FR-018)
- [ ] TA002 [P] Add spare-part and service-bill statuses, payment statuses, and colour maps to
      constants
- [ ] TA003 Extend the `middleware.ts` plant mapping to cover `/dashboard/plant/spare-parts`
      with `MAINTENANCE` (spec FR-011)
- [ ] TA004 [US8] `spare-part-table.tsx` (`ResponsiveList`): stock, avg rate, stock value, reorder
      level, with a **low-stock marker on the row** visible without opening the detail
- [ ] TA005 [US8] `spare-part-form.tsx`: duplicate part-number 409 inline; optional compatible
      categories and linked inventory item
- [ ] TA006 [US8] `receive-part-modal.tsx` with **live Amount = Qty × Rate as a read-only computed
      field** (spec FR-012), matching FR-003's established pattern
- [ ] TA007 [US8] Below-reorder filter; delete 409 as a toast for a part with consumption history
- [ ] TA008 [US8] Linked-part reconciliation view showing **both balances side by side** so
      divergence is visible (spec FR-017)
- [ ] TA009 [US9] `job-parts-tab.tsx`: consumed parts with quantity, rate at consumption, and value
- [ ] TA010 [US9] Add Part with a **live available-stock hint disabling Save when exceeded**
      (spec FR-014)
- [ ] TA011 [US9] Incompatible-part **non-blocking warning** — never prevents the action
      (spec FR-015)
- [ ] TA012 [US9] Add Part **disabled on a closed job with an explanatory tooltip** rather than
      failing on submit (spec FR-016); Reverse requires a reason
- [ ] TA013 [US9] `service-bill-form.tsx`: **TDS Amount and Net Payable as live read-only computed
      fields, never editable inputs** (spec FR-013); duplicate bill-number 409 inline
- [ ] TA014 [US9] Pay **disabled while the bill is unverified with a tooltip** (spec FR-016);
      verified bills render read-only
- [ ] TA015 [US9] `service-bill-table.tsx` with payment status badges via `StatusBadge`
      (spec FR-020)
- [ ] TA016 [US9] Equipment maintenance-cost panel — parts / internal labour / service bills / total
- [ ] TA017 Replace any local equipment document-expiry or service-due reminder rendering with the
      global Reminders centre — **blocked by 004 TA006**
- [ ] TA018 [P] Verify `formatCurrency` (spec FR-006) throughout and that **no computed financial
      field is an editable input** (SC-A02)
- [ ] TA019 [P] `ResponsiveList` and 320px spot-check on both new screens (spec FR-019);
      `npx tsc --noEmit`
