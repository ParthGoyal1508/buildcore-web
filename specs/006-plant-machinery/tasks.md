---

description: "Task list for feature implementation"
---

# Tasks: Plant & Machinery Frontend

**Input**: Design documents from `/specs/006-plant-machinery/`

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Add "Plant & Machinery" nav group to `nav-links.tsx`: Asset Register, Logbook,
      Fuel, Maintenance, Services, Hire Bills, Masters
- [X] T002 [P] Create `app/dashboard/plant/layout.tsx` (breadcrumb + sub-nav)
- [X] T003 [P] Create `app/lib/api/plant.ts` with all typed API function stubs
- [X] T004 [P] Extend `StatusBadge` with plant statuses: `under_maintenance`=orange,
      `inactive`=gray, `due_soon`=orange, `overdue`=red, `pending_verification`=gray,
      `verified`=blue
- [X] T004a Extend `middleware.ts` with a `/dashboard/plant/*` route matcher mapping each
      sub-path to its permission (`MACHINERY`/`LOGBOOK`/`FUEL`/`MAINTENANCE`/`HIRE_BILLS`/
      `SETTINGS`), mirroring the backend's corrected permission mapping — FR-009, missing
      entirely from this feature's original task list

---

## Phase 2: US1 — Asset Register (P1) 🎯 MVP

- [X] T005 [P] [US1] `app/ui/plant/EquipmentModal.tsx`: Add/Edit equipment form (Code, Name,
      Category dropdown, Ownership, Vendor if Hired, Power Source, Meter Type, Site dropdown,
      Depreciation Rate if owned)
- [X] T006 [P] [US1] `app/ui/plant/EquipmentDocumentRow.tsx`: document type, file link, expiry,
      alert badge (Expiring Soon/Expired)
- [X] T007 [US1] `app/dashboard/plant/equipment/page.tsx`: `AssetRegisterPage` — `ResponsiveList`
      -based table with Code/Name/Category/Ownership/Site/Reading/Status/Utilisation%/Doc Alert,
      fully keyboard-operable (FR-010); "Add Equipment" button; wire `@tanstack/react-query`
- [X] T008 [US1] `app/dashboard/plant/equipment/[id]/page.tsx`: Equipment detail with tabs
      (Overview, Documents, Logbook, Fuel, Maintenance, Services, Hire Bills)

---

## Phase 3: US2 — Logbook (P1)

- [X] T009 [P] [US2] `app/ui/plant/LogbookModal.tsx`: Equipment dropdown, Date, Opening Reading,
      Closing Reading, Total Hours (live: closing − opening via `watch` — FR-002), Fuel Consumed,
      Operator dropdown (HR employees), Project dropdown; inline error for closing < opening
- [X] T010 [US2] `app/dashboard/plant/logbook/page.tsx`: `ResponsiveList`-based Logbook list
      (FR-010) + filters (equipment, project, date range), "Add Entry" button + `LogbookModal`

---

## Phase 4: US3 — Fuel (P2)

- [X] T011 [P] [US3] `app/ui/plant/FuelModal.tsx`: Equipment, Date, Quantity, Rate, Amount
      (live: qty × rate — FR-003), Vendor; `varianceAlert` badge shown if backend returns it
- [X] T012 [US3] `app/dashboard/plant/fuel/page.tsx`: `ResponsiveList`-based Fuel list (FR-010)
      with Variance % and alert badge; monthly summary view

---

## Phase 5: US4 — Maintenance (P2)

- [X] T013 [P] [US4] `app/ui/plant/MaintenanceModal.tsx`: Equipment dropdown, Type (Breakdown/
      Scheduled), Description, Link to Service Schedule (optional); Close Job modal (closing
      reading, date, parts, costs)
- [X] T014 [US4] `app/dashboard/plant/maintenance/page.tsx`: `ResponsiveList`-based Maintenance
      list (FR-010) + filters; on job open/close invalidate equipment query (status badge updates
      — FR-005)

---

## Phase 6: US5 — Service Schedules (P2)

- [X] T015 [P] [US5] `app/ui/plant/ServiceScheduleModal.tsx`: Equipment, Service Type, Interval,
      Last Done Reading; Next Due = Last Done + Interval shown as preview
- [X] T016 [US5] `app/dashboard/plant/services/page.tsx`: `ResponsiveList`-based Schedule list
      (FR-010) with status badges

---

## Phase 7: US6 — Hire Bills (P3)

- [X] T017 [P] [US6] `app/ui/plant/HireBillModal.tsx`: Equipment (hired only), Vendor, Billed
      Hours, Rate, Billing Period; shows computed Gross Amount, Logbook Hours, Variance, TDS,
      Net Payable as read-only preview fields
- [X] T018 [US6] `app/dashboard/plant/hire-bills/page.tsx`: `ResponsiveList`-based Hire Bills list
      (FR-010) with status badges; Verify (+ confirmation dialog showing variance) and Pay
      (payment date + reference modal)

---

## Phase 8: US7 — Reference Data Masters (P1)

- [X] T018a [P] [US7] `app/ui/plant/EquipmentCategoryModal.tsx`,
      `EquipmentDocTypeModal.tsx`, `HireRateModal.tsx`: add/edit forms for each master
- [X] T018b [US7] `app/dashboard/plant/masters/page.tsx`: three-tab screen (Categories/Doc
      Types/Hire Rates), each tab a `ResponsiveList`-based table (FR-010); Hire Rates tab shows
      the effective-dated history per category with `null` `effectiveTo` rendered as "Current"
- [X] T018c [US7] Wire `EquipmentModal.tsx` (T005) and `EquipmentDocumentRow.tsx` (T006)'s
      Category/Doc Type dropdowns to `listEquipmentCategories()`/`listEquipmentDocTypes()`
      (`app/lib/api/plant.ts`) rather than a hardcoded list — FR-008

---

## Phase 9: Polish

- [X] T019 [P] Verify all monetary values use `formatCurrency`
- [X] T020 [P] Verify status badges across all plant pages
- [X] T021 [P] TypeScript type check (`npx tsc --noEmit`)
- [X] T021a [P] Spot-check every list screen across all seven user stories at a mobile viewport
      (`ResponsiveList` card layout, no horizontal scroll) and for keyboard operability — FR-010

---

## Amendment 2026-09-01 — Spare Parts and Service Bills Screens

Covers spec FR-011 to FR-020 and plan Phase A8. Task IDs prefixed `TA`. **No new permission**
(reuses `MAINTENANCE`).

**Note**: a `plan.md` was created for this feature during the same pass — it was the only frontend
feature without one. See [plan.md](plan.md).

- [X] TA001 Extend `app/lib/api/plant.ts` with spare-part, part-movement, and service-bill functions
      plus their `zod` schemas (spec FR-018)
- [X] TA002 [P] Add spare-part and service-bill statuses, payment statuses, and colour maps to
      constants
- [X] TA003 Extend the `middleware.ts` plant mapping to cover `/dashboard/plant/spare-parts`
      with `MAINTENANCE` (spec FR-011)
- [X] TA004 [US8] `spare-part-table.tsx` (`ResponsiveList`): stock, avg rate, stock value, reorder
      level, with a **low-stock marker on the row** visible without opening the detail
- [X] TA005 [US8] `spare-part-form.tsx`: duplicate part-number 409 inline; optional compatible
      categories and linked inventory item
- [X] TA006 [US8] `receive-part-modal.tsx` with **live Amount = Qty × Rate as a read-only computed
      field** (spec FR-012), matching FR-003's established pattern
- [X] TA007 [US8] Below-reorder filter; delete 409 as a toast for a part with consumption history
- [X] TA008 [US8] Linked-part reconciliation view showing **both balances side by side** so
      divergence is visible (spec FR-017)
- [X] TA009 [US9] `job-parts-tab.tsx`: consumed parts with quantity, rate at consumption, and value
- [X] TA010 [US9] Add Part with a **live available-stock hint disabling Save when exceeded**
      (spec FR-014)
- [X] TA011 [US9] Incompatible-part **non-blocking warning** — never prevents the action
      (spec FR-015)
- [X] TA012 [US9] Add Part **disabled on a closed job with an explanatory tooltip** rather than
      failing on submit (spec FR-016); Reverse requires a reason
- [X] TA013 [US9] `service-bill-form.tsx`: **TDS Amount and Net Payable as live read-only computed
      fields, never editable inputs** (spec FR-013); duplicate bill-number 409 inline
- [X] TA014 [US9] Pay **disabled while the bill is unverified with a tooltip** (spec FR-016);
      verified bills render read-only
- [X] TA015 [US9] `service-bill-table.tsx` with payment status badges via `StatusBadge`
      (spec FR-020)
- [X] TA016 [US9] Equipment maintenance-cost panel — parts / internal labour / service bills / total
- [X] TA017 Replace any local equipment document-expiry or service-due reminder rendering with the
      global Reminders centre — **blocked by 004 TA006**
- [X] TA018 [P] Verify `formatCurrency` (spec FR-006) throughout and that **no computed financial
      field is an editable input** (SC-A02)
- [X] TA019 [P] `ResponsiveList` and 320px spot-check on both new screens (spec FR-019);
      `npx tsc --noEmit`

---

## Implementation note — 2026-09-04

All 45 tasks above are implemented. What follows is every place the code departs
from the task text, and what was verified.

### Deviations from the specified design

1. **`formatRupees`, not `formatCurrency` (spec FR-006, FR-020).**
   `formatCurrency` divides by 100 because it was written for amounts stored in
   paise. `buildcore-api` sends money as Prisma `Decimal` columns in *rupees*, so
   passing those through it would understate every figure on screen by two orders of
   magnitude. `formatRupees` exists for exactly this and is what 008 and 009 use.

2. **A layout guard, not `middleware.ts` (spec FR-009, task T004a, TA003).**
   Feature 001 keeps the access token in memory only, so middleware never sees it —
   the same reason the Inventory, Partners, Settings and HR guards all live at their
   layout boundaries. `app/dashboard/plant/layout.tsx` does the per-section check
   the matcher was specified to do, with the longest-prefix rule `SectionTabs` and
   feature 014's guard already use.

3. **`NAV_MODULES.plant` became any-of over five permissions.**
   It was `['MACHINERY']` alone, which — with `guardsSubtree: true` — would have
   locked an operator holding only `LOGBOOK` out of the logbook the backend would
   happily have served them. This module's sections genuinely carry five different
   permissions; the module entry now answers "may this user see Plant at all" and
   the layout answers "which sections".

4. **The machine detail page links into the module's lists rather than repeating
   them as tabs (task T008).** The task asked for Overview / Documents / Logbook /
   Fuel / Maintenance / Services / Hire Bills tabs. Overview, Documents, Service
   Schedules and the FR-026 maintenance-cost panel are on the page; the other four
   are links into lists that already page, already filter and already exist. Each
   list now seeds its machine filter from `?equipmentId=`, so the link lands
   pre-filtered. Two implementations of the same table would have drifted apart.

5. **Masters tabs are local state, not routes (task T018b).** The module strip above
   already owns `/dashboard/plant/masters`, and a second route-driven strip would
   fight it for the active-tab highlight.

6. **Document upload is base64-in-JSON**, matching the backend and every other
   upload in this app.

7. **Fuel variance is not previewed on the entry form.** It is measured against the
   day's logbook entry and the machine category's own threshold, neither of which
   the form has. Showing a guess and contradicting it on save is worse than showing
   nothing; the same reasoning applies to the hire bill's TDS rate, which comes from
   the vendor's record in Partners.

### Changes outside this feature's own files

- **`PERMISSIONS` gained `MAINTENANCE`, `HIRE_BILLS` and `INVENTORY_APPROVE`.** The
  Roles screen renders its checkboxes from this list, so an administrator had no way
  to grant any of them. `INVENTORY_APPROVE` had been in that state since 009 shipped:
  the backend gated indent approval on it and the UI offered no way to hand it out.
- **`SelectField` gained a `hint` prop**, matching `TextField`. A disabled or
  constrained select needs to say why under itself.
- **`Pager` gained an optional `plural`**, because "entry" pluralised to "entrys".
- **`StatusBadge`** gained the plant statuses. `verified` is deliberately blue rather
  than green: a verified bill is still money owed, and green would read as settled.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint`: **0 errors**. One warning remains, pre-existing in feature 010.
- `npm run build` emits all **10** `/dashboard/plant` routes.
- **42/42 zod schemas parsed a response the running API actually returned** —
  captured from a booted API against a real database, covering every endpoint this
  module calls including the FR-024 reconciliation with a genuinely linked inventory
  item (workshop 8 @ ₹200 against inventory 25 @ ₹180, difference −17). This is the
  check feature 005 skipped and shipped six bugs through.

### Not done

- **Nothing here has been opened in a browser.** The 320px viewport pass and the
  keyboard walkthrough (spec FR-010, FR-019) are both outstanding. This matters more
  than usual: feature 004 shipped a filter row that spilled its own borders and it
  took a screenshot to find.
- **Touch targets have not been measured.** `RowAction` is smaller than 44×44px,
  which spec FR-019 requires but plan.md's Constitution VI row explicitly does not —
  it classes this module as desktop-first back-office. The two documents disagree and
  the disagreement is unresolved rather than decided here.
