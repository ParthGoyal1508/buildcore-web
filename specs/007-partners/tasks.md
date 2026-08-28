---

description: "Task list for feature implementation"
---

# Tasks: Partners Frontend (Vendors, Contractor Vault, Compliance, RAG Matrix, BOCW Cess)

**Input**: Design documents from `/specs/007-partners/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/partners-web-api.md,
quickstart.md

**Tests**: No automated test framework installed (constitution's documented gap). Verification
via quickstart.md.

**Organization**: Tasks grouped by user story (US1–US6).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1–US6)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] Add "Partners" nav group to `app/ui/dashboard/nav-links.tsx` with sub-items:
      Vendors (`/dashboard/partners/vendors`), Contractors (`/dashboard/partners/contractors`),
      Compliance (`/dashboard/partners/contractors/compliance`), RAG Matrix
      (`/dashboard/partners/contractors/rag`), BOCW Cess (`/dashboard/partners/bocw`)
- [ ] T002 [P] Create `app/dashboard/partners/layout.tsx` with breadcrumb and sub-nav shell
- [ ] T003 [P] Create `app/lib/api/partners.ts` with all 22 typed API function signatures
      (stubs) — data-model.md TypeScript types, contracts/partners-web-api.md
- [ ] T004 [P] Ensure `formatCurrency` exists in `app/lib/utils.ts`; create if not present
      (should exist from Projects 008, but create here if 008 not yet merged)
- [ ] T005 [P] Extend `StatusBadge` colour map (or create `app/ui/projects/StatusBadge.tsx`
      if not yet present) with compliance statuses: `compliant`=green, `non_compliant`=red,
      `partially_compliant`=yellow, `verified`=green, `submitted`=blue, `partial`=yellow,
      `missing`=red; and BOCW statuses with distinct keys to avoid colour collision:
      `bocw_pending`=red, `bocw_partial`=orange, `bocw_paid`=green — M-005 remediation
      (BOCW `partial` is orange, not yellow; use `bocw_partial` key in `BOCWTable`)
- [ ] T005a [P] Extend `middleware.ts` with a `/dashboard/partners/*` route matcher: `PARTNERS`
      for `/dashboard/partners/{vendors,contractors,bocw}/*`, `SETTINGS` for
      `/dashboard/partners/vendors/categories` (a Settings-owned master, backend research.md §1)
      — FR-013, missing entirely from this feature's original task list, found during a
      master-PRD alignment audit

**Checkpoint**: Nav, layout, API module, currency formatter, status badge, and route guard ready.

---

## Phase 2: Foundational — TypeScript types and zod schemas

- [ ] T006 Define all TypeScript interfaces in `app/lib/api/partners.ts` from data-model.md:
      `VendorCategory`, `VendorListItem`, `VendorDetail`, `VendorContact`, `ContractorListItem`,
      `ContractorDocument`, `ContractorDetail`, `MonthlyCompliance`, `RagRow`, `RagMatrix`,
      `BOCWRow`. Add `vendorSchema` and `complianceSchema` zod schemas.

**Checkpoint**: All types defined; components can be built with correct prop shapes.

---

## Phase 3: User Story 1 — Vendor Categories (Priority: P1) 🎯 MVP

**Goal**: Category table with Add/Edit modal, delete with 409 handling.

**Independent Test**: Add, edit, delete category; delete linked category → inline error.

### Implementation for User Story 1

- [ ] T007 [P] [US1] Implement `getVendorCategories`, `createVendorCategory`,
      `updateVendorCategory`, `deleteVendorCategory` in `app/lib/api/partners.ts`
- [ ] T008 [P] [US1] Create `app/ui/partners/VendorCategoryModal.tsx`: Name + Description
      fields, `react-hook-form` with zod validation
- [ ] T009 [US1] Create `app/dashboard/partners/vendors/categories/page.tsx`:
      `CategoriesPage` — `ResponsiveList`-based table (#, Category Name, Description, Vendors
      count, Edit/Delete actions), fully keyboard-operable (FR-014), "Add Category" button,
      inline 409 delete error handling

**Checkpoint**: Vendor categories CRUD functional.

---

## Phase 4: User Story 2 — Manage Vendors (Priority: P1)

**Goal**: Vendor list with filters; 4-tab modal with `useFieldArray` contacts; active toggle
with confirmation; Work Detail tab conditional on type.

**Independent Test**: Create vendor with 2 contacts + 3 tags; edit contacts (1 new, 1 removed);
toggle active (confirm dialog); Work Detail disabled for material type.

### Implementation for User Story 2

- [ ] T010 [P] [US2] Implement `getVendors`, `createVendor`, `getVendor`, `updateVendor`,
      `toggleVendorActive` in `app/lib/api/partners.ts`
- [ ] T011 [P] [US2] Create `app/ui/partners/VendorDetailsTab.tsx`: Name, Type dropdown,
      Deals In multi-select (tags from `getVendorCategories()`), GSTIN, PAN, TDS Section,
      TDS Rate, Active toggle
- [ ] T012 [P] [US2] Create `app/ui/partners/VendorAddressTab.tsx`: Address, City, State,
      PIN Code fields
- [ ] T013 [P] [US2] Create `app/ui/partners/VendorContactsTab.tsx`: `useFieldArray` dynamic
      rows (Name, Phone, Email per row), "+ Add Contact" button, Delete icon per row — FR-003
- [ ] T014 [P] [US2] Create `app/ui/partners/VendorWorkDetailTab.tsx`: hire/contract/machine/
      charges fields; rendered but inputs disabled when `type` is not
      subcontractor/labour_contractor (FR-005); tooltip "Available for Subcontractor types only"
- [ ] T015 [US2] Create `app/ui/partners/VendorModal.tsx`: 4-tab container composing
      T011–T014; single `react-hook-form` instance with `vendorSchema`; preserves all tab
      data across tab switches (FR-011); loads existing data in edit mode
- [ ] T016 [P] [US2] Create `app/ui/partners/VendorListTable.tsx`: `ResponsiveList`-based,
      fully keyboard-operable (FR-014), columns (Vendor name+city, Deals In tags, Contact, Type
      badge, GSTIN, TDS, Active toggle); Active toggle fires confirmation dialog before
      `toggleVendorActive()` API call (FR-010)
- [ ] T017 [US2] Create `app/dashboard/partners/vendors/page.tsx`: `VendorsPage` — list with
      search, type filter, active filter, pagination; "Add Vendor" + "Manage Categories"
      (→ `/vendors/categories`) buttons; `VendorModal` integration; wire
      `@tanstack/react-query` with `['partners', 'vendors', params]` key

**Checkpoint**: Vendor 4-tab modal and list fully functional.

---

## Phase 5: User Story 3 — Contractor Vault (Priority: P2)

**Goal**: Contractor list with compliance status badges; detail page with document checklist
and expiry warnings; Add contractor modal with vendor picker.

**Independent Test**: Create contractor (→ Non-compliant badge); upload document with expiry
15 days out (→ expiry warning badge); open detail page.

### Implementation for User Story 3

- [ ] T018 [P] [US3] Implement `getContractors`, `createContractor`, `getContractor`,
      `updateContractor`, `uploadContractorDocument`, `deleteContractorDocument` in
      `app/lib/api/partners.ts`
- [ ] T019 [P] [US3] Create `app/ui/partners/ContractorModal.tsx`: Vendor picker (searchable
      dropdown filtered to subcontractor/labour_contractor type via `getVendors({ type: ... })`),
      registration number fields (Licence Number, PF Registration, ESIC Registration, BOCW
      Registration, Insurance Policy Number)
- [ ] T020 [P] [US3] Create `app/ui/partners/ContractorDocumentRow.tsx`: document type label,
      file link, upload date, expiry date; expiry warning badge (orange "Expiring soon" or red
      "Expired") when `expiryWarning: true`
- [ ] T021 [US3] Create `app/dashboard/partners/contractors/page.tsx`: `ResponsiveList`-based
      contractor list table, fully keyboard-operable (FR-014), with compliance status
      `StatusBadge`, "Add Contractor" button, `ContractorModal`
- [ ] T022 [US3] Create `app/dashboard/partners/contractors/[id]/page.tsx`:
      `ContractorDetailPage` — document checklist section (one `ContractorDocumentRow` per
      `ContractorDocument` + upload control per document type), compliance history link
      (→ compliance page filtered to this contractor)

**Checkpoint**: Contractor vault and document management functional.

---

## Phase 6: User Story 4 — Monthly Compliance (Priority: P2)

**Goal**: Compliance table with status badges; Record modal with past-month restriction; Verify
action with confirmation; "Verified by X" label on verified rows.

**Independent Test**: Record PF-only (→ Partial); add ESIC (→ Submitted); verify (→ Verified +
label); verify action hidden on verified rows.

### Implementation for User Story 4

- [ ] T023 [P] [US4] Implement `getCompliance`, `createCompliance`, `updateCompliance`,
      `verifyCompliance` in `app/lib/api/partners.ts`
- [ ] T024 [P] [US4] Create `app/ui/partners/ComplianceModal.tsx`: Contractor dropdown
      (active contractors only), Month picker (`<input type="month">` with `max` = current
      YYYY-MM — research.md §6), PF section (Challan #, Amount, Date), ESIC section
      (Challan #, Amount, Date); sections are independent (either can be submitted alone);
      `complianceSchema` zod validation
- [ ] T025 [US4] Create `app/ui/partners/ComplianceTable.tsx`: `ResponsiveList`-based, fully
      keyboard-operable (FR-014), columns (Contractor, Month, PF Challan/Amount/Date, ESIC
      Challan/Amount/Date, Status badge, Actions); Verify action
      shows confirmation dialog ("Verify? This records your identity."); verified rows show
      "Verified by [name] on [date]" label with Verify action hidden (spec US4 AC4/AC5)
- [ ] T026 [US4] Create `app/dashboard/partners/contractors/compliance/page.tsx`:
      `CompliancePage` — reads `?contractorId=` and `?month=` URL params (for RAG dot
      navigation — research.md §5) and pre-filters table; "Record Compliance" button +
      `ComplianceModal`; wire `@tanstack/react-query` with
      `['partners', 'compliance', { contractorId, month, status }]` key; on verify success
      invalidate contractor query (complianceStatus badge update)

**Checkpoint**: Compliance recording and verify workflow fully functional.

---

## Phase 7: User Story 5 — RAG Matrix (Priority: P2)

**Goal**: Sticky CSS table (50 contractors × 12 months), FY selector as URL param, coloured
dots navigating to compliance on click; gray dots non-clickable.

**Independent Test**: Load matrix; verify dot colours; change FY (URL updates + dots refresh);
click non-gray dot (→ compliance page filtered); gray dot not clickable.

### Implementation for User Story 5

- [ ] T027 [P] [US5] Implement `getRagMatrix(fy)` in `app/lib/api/partners.ts`
- [ ] T028 [P] [US5] Create `app/ui/partners/RagDot.tsx`: coloured circle component;
      `verified`=green, `submitted`/`partial`=yellow, `missing`=red, `gray`=gray;
      `pointer-events: none` + `cursor: default` for gray; `onClick` prop for non-gray dots
      (navigates via `useRouter.push`) — FR-007
- [ ] T029 [US5] Create `app/ui/partners/RagMatrix.tsx`: HTML `<table>` with:
      - overflow-x scroll container
      - `position: sticky; left: 0; z-index: 1` on contractor name `<td>`
      - `position: sticky; top: 0; z-index: 2` on month header `<th>` row
      - FY selector `<select>` calling `router.push({ query: { fy: val } })` — FR-008
      - renders `RagDot` per cell as a real `<button>` (Tab-reachable, `disabled` for gray
        cells) rather than a `<div onClick>` — keyboard-navigable per FR-014's exemption note
        (dense grid exempt from `ResponsiveList`'s card layout, but not from keyboard access)
      - research.md §4
- [ ] T030 [US5] Create `app/dashboard/partners/contractors/rag/page.tsx`: `RagMatrixPage`
      — reads `?fy=` via `useSearchParams`; defaults to current FY (e.g. `2025-26`); renders
      `RagMatrix`; wire `@tanstack/react-query` with `['partners', 'rag', fy]` key

**Checkpoint**: RAG Matrix with sticky layout, FY switching, and dot navigation functional.

---

## Phase 8: User Story 6 — BOCW Cess (Priority: P3)

**Goal**: BOCW cess table with on-demand liability/balance; Record Payment modal; paid projects
disable record action.

**Independent Test**: Table shows liability = contract value × 1%; record payment → Partial;
record full balance → Paid (green badge, button disabled).

### Implementation for User Story 6

- [ ] T031 [P] [US6] Implement `getBOCW`, `recordBOCWPayment` in `app/lib/api/partners.ts`
- [ ] T032 [P] [US6] Create `app/ui/partners/BOCWPaymentModal.tsx`: Amount Paid, Payment Date,
      Reference Number, Remarks fields; `react-hook-form` with zod validation
- [ ] T033 [US6] Create `app/ui/partners/BOCWTable.tsx`: `ResponsiveList`-based, fully
      keyboard-operable (FR-014), columns (Project Name, Contract Value, Cess Rate, Cess
      Liability, Paid, Balance, Last Payment Date, Status badge, Actions); all monetary columns
      via `formatCurrency` (FR-009); Record Payment button disabled when
      `status === 'paid'` (spec US6 AC3); `BOCWPaymentModal` integration
- [ ] T034 [US6] Create `app/dashboard/partners/bocw/page.tsx`: `BOCWPage` — paginated BOCW
      list; wire `@tanstack/react-query` with `['partners', 'bocw']` key; invalidate on payment

**Checkpoint**: All 6 user stories implemented.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T035 [P] Verify all monetary displays use `formatCurrency` — BOCW table, compliance
      amounts in `ComplianceModal` and `ComplianceTable`
- [ ] T036 [P] Verify all status displays use `StatusBadge` — contractor list, compliance
      table, BOCW table (no inline colour class strings)
- [ ] T037 [P] Verify `VendorModal` tab data is never lost on tab switch — manual test per
      quickstart.md Scenario 2 step 3
- [ ] T038 [P] Run TypeScript type check (`npx tsc --noEmit`) and fix issues
- [ ] T039 [P] Verify RAG Matrix renders without horizontal scroll issues on a 1280px viewport
      (minimum expected admin screen width)
- [ ] T040 [P] Spot-check every `ResponsiveList`-based screen (Categories, Vendors, Contractors,
      Compliance, BOCW) at a mobile viewport (card layout, no horizontal scroll) and for keyboard
      operability across all controls, including RAG Matrix's dot buttons — FR-014

---

## Dependencies

```
Phase 1 → Phase 2 → US1 (Categories) ──┐
                 └── US2 (Vendors) ──────┤
                                          └── US3 (Contractors) ── US4 (Compliance) ── US5 (RAG)
Phase 1 → Phase 2 ────────────────────── US6 (BOCW — independent)
```

US1 and US2 can build in parallel after Phase 2. US3 needs the vendor picker (depends on
`getVendors` from US2 API functions existing). US4 needs contractor list (US3). US5 needs
compliance data (US4). US6 is independent of US1–US5.

## Parallel execution opportunities

- T007, T008, T009 (US1) and T010–T016 (US2) can begin simultaneously after T006
- Within US2: T011, T012, T013, T014 (tab components) are all independent
- T018, T019, T020 (US3) are independent of each other
- T023, T024 (US4) are independent of each other
- T027, T028 (US5) and T031, T032 (US6) are independent
- T035–T039 (Phase 9 polish) are all independent

## Implementation Strategy

**MVP (Phase 1–4, US1–US2)**: Shared infra, vendor categories, and vendor CRUD. Delivers the
core vendor master data screen other modules (Inventory, Machinery) depend on.

**Increment 2 (Phase 5–7, US3–US5)**: Contractor vault, compliance recording, RAG Matrix —
the compliance monitoring workflow.

**Increment 3 (Phase 8–9, US6 + polish)**: BOCW cess, final consistency checks.
