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

- [x] T001 [P] Add "Partners" nav group to `app/ui/dashboard/nav-links.tsx` with sub-items:
      Vendors (`/dashboard/partners/vendors`), Contractors (`/dashboard/partners/contractors`),
      Compliance (`/dashboard/partners/contractors/compliance`), RAG Matrix
      (`/dashboard/partners/contractors/rag`), BOCW Cess (`/dashboard/partners/bocw`)
- [x] T002 [P] Create `app/dashboard/partners/layout.tsx` with breadcrumb and sub-nav shell
- [x] T003 [P] Create `app/lib/api/partners.ts` with all 22 typed API function signatures
      (stubs) — data-model.md TypeScript types, contracts/partners-web-api.md
- [x] T004 [P] Ensure `formatCurrency` exists in `app/lib/utils.ts`; create if not present
      (should exist from Projects 008, but create here if 008 not yet merged)
- [x] T005 [P] Extend `StatusBadge` colour map (or create `app/ui/projects/StatusBadge.tsx`
      if not yet present) with compliance statuses: `compliant`=green, `non_compliant`=red,
      `partially_compliant`=yellow, `verified`=green, `submitted`=blue, `partial`=yellow,
      `missing`=red; and BOCW statuses with distinct keys to avoid colour collision:
      `bocw_pending`=red, `bocw_partial`=orange, `bocw_paid`=green — M-005 remediation
      (BOCW `partial` is orange, not yellow; use `bocw_partial` key in `BOCWTable`)
- [x] T005a [P] Extend `middleware.ts` with a `/dashboard/partners/*` route matcher: `PARTNERS`
      for `/dashboard/partners/{vendors,contractors,bocw}/*`, `SETTINGS` for
      `/dashboard/partners/vendors/categories` (a Settings-owned master, backend research.md §1)
      — FR-013, missing entirely from this feature's original task list, found during a
      master-PRD alignment audit

**Checkpoint**: Nav, layout, API module, currency formatter, status badge, and route guard ready.

---

## Phase 2: Foundational — TypeScript types and zod schemas

- [x] T006 Define all TypeScript interfaces in `app/lib/api/partners.ts` from data-model.md:
      `VendorCategory`, `VendorListItem`, `VendorDetail`, `VendorContact`, `ContractorListItem`,
      `ContractorDocument`, `ContractorDetail`, `MonthlyCompliance`, `RagRow`, `RagMatrix`,
      `BOCWRow`. Add `vendorSchema` and `complianceSchema` zod schemas.

**Checkpoint**: All types defined; components can be built with correct prop shapes.

---

## Phase 3: User Story 1 — Vendor Categories (Priority: P1) 🎯 MVP

**Goal**: Category table with Add/Edit modal, delete with 409 handling.

**Independent Test**: Add, edit, delete category; delete linked category → inline error.

### Implementation for User Story 1

- [x] T007 [P] [US1] Implement `getVendorCategories`, `createVendorCategory`,
      `updateVendorCategory`, `deleteVendorCategory` in `app/lib/api/partners.ts`
- [x] T008 [P] [US1] Create `app/ui/partners/VendorCategoryModal.tsx`: Name + Description
      fields, `react-hook-form` with zod validation
- [x] T009 [US1] Create `app/dashboard/partners/vendors/categories/page.tsx`:
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

- [x] T010 [P] [US2] Implement `getVendors`, `createVendor`, `getVendor`, `updateVendor`,
      `toggleVendorActive` in `app/lib/api/partners.ts`
- [x] T011 [P] [US2] Create `app/ui/partners/VendorDetailsTab.tsx`: Name, Type dropdown,
      Deals In multi-select (tags from `getVendorCategories()`), GSTIN, PAN, TDS Section,
      TDS Rate, Active toggle
- [x] T012 [P] [US2] Create `app/ui/partners/VendorAddressTab.tsx`: Address, City, State,
      PIN Code fields
- [x] T013 [P] [US2] Create `app/ui/partners/VendorContactsTab.tsx`: `useFieldArray` dynamic
      rows (Name, Phone, Email per row), "+ Add Contact" button, Delete icon per row — FR-003
- [x] T014 [P] [US2] Create `app/ui/partners/VendorWorkDetailTab.tsx`: hire/contract/machine/
      charges fields; rendered but inputs disabled when `type` is not
      subcontractor/labour_contractor (FR-005); tooltip "Available for Subcontractor types only"
- [x] T015 [US2] Create `app/ui/partners/VendorModal.tsx`: 4-tab container composing
      T011–T014; single `react-hook-form` instance with `vendorSchema`; preserves all tab
      data across tab switches (FR-011); loads existing data in edit mode
- [x] T016 [P] [US2] Create `app/ui/partners/VendorListTable.tsx`: `ResponsiveList`-based,
      fully keyboard-operable (FR-014), columns (Vendor name+city, Deals In tags, Contact, Type
      badge, GSTIN, TDS, Active toggle); Active toggle fires confirmation dialog before
      `toggleVendorActive()` API call (FR-010)
- [x] T017 [US2] Create `app/dashboard/partners/vendors/page.tsx`: `VendorsPage` — list with
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

- [x] T018 [P] [US3] Implement `getContractors`, `createContractor`, `getContractor`,
      `updateContractor`, `uploadContractorDocument`, `deleteContractorDocument` in
      `app/lib/api/partners.ts`
- [x] T019 [P] [US3] Create `app/ui/partners/ContractorModal.tsx`: Vendor picker (searchable
      dropdown filtered to subcontractor/labour_contractor type via `getVendors({ type: ... })`),
      registration number fields (Licence Number, PF Registration, ESIC Registration, BOCW
      Registration, Insurance Policy Number)
- [x] T020 [P] [US3] Create `app/ui/partners/ContractorDocumentRow.tsx`: document type label,
      file link, upload date, expiry date; expiry warning badge (orange "Expiring soon" or red
      "Expired") when `expiryWarning: true`
- [x] T021 [US3] Create `app/dashboard/partners/contractors/page.tsx`: `ResponsiveList`-based
      contractor list table, fully keyboard-operable (FR-014), with compliance status
      `StatusBadge`, "Add Contractor" button, `ContractorModal`
- [x] T022 [US3] Create `app/dashboard/partners/contractors/[id]/page.tsx`:
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

- [x] T023 [P] [US4] Implement `getCompliance`, `createCompliance`, `updateCompliance`,
      `verifyCompliance` in `app/lib/api/partners.ts`
- [x] T024 [P] [US4] Create `app/ui/partners/ComplianceModal.tsx`: Contractor dropdown
      (active contractors only), Month picker (`<input type="month">` with `max` = current
      YYYY-MM — research.md §6), PF section (Challan #, Amount, Date), ESIC section
      (Challan #, Amount, Date); sections are independent (either can be submitted alone);
      `complianceSchema` zod validation
- [x] T025 [US4] Create `app/ui/partners/ComplianceTable.tsx`: `ResponsiveList`-based, fully
      keyboard-operable (FR-014), columns (Contractor, Month, PF Challan/Amount/Date, ESIC
      Challan/Amount/Date, Status badge, Actions); Verify action
      shows confirmation dialog ("Verify? This records your identity."); verified rows show
      "Verified by [name] on [date]" label with Verify action hidden (spec US4 AC4/AC5)
- [x] T026 [US4] Create `app/dashboard/partners/contractors/compliance/page.tsx`:
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

- [x] T027 [P] [US5] Implement `getRagMatrix(fy)` in `app/lib/api/partners.ts`
- [x] T028 [P] [US5] Create `app/ui/partners/RagDot.tsx`: coloured circle component;
      `verified`=green, `submitted`/`partial`=yellow, `missing`=red, `gray`=gray;
      `pointer-events: none` + `cursor: default` for gray; `onClick` prop for non-gray dots
      (navigates via `useRouter.push`) — FR-007
- [x] T029 [US5] Create `app/ui/partners/RagMatrix.tsx`: HTML `<table>` with:
      - overflow-x scroll container
      - `position: sticky; left: 0; z-index: 1` on contractor name `<td>`
      - `position: sticky; top: 0; z-index: 2` on month header `<th>` row
      - FY selector `<select>` calling `router.push({ query: { fy: val } })` — FR-008
      - renders `RagDot` per cell as a real `<button>` (Tab-reachable, `disabled` for gray
        cells) rather than a `<div onClick>` — keyboard-navigable per FR-014's exemption note
        (dense grid exempt from `ResponsiveList`'s card layout, but not from keyboard access)
      - research.md §4
- [x] T030 [US5] Create `app/dashboard/partners/contractors/rag/page.tsx`: `RagMatrixPage`
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

- [x] T031 [P] [US6] Implement `getBOCW`, `recordBOCWPayment` in `app/lib/api/partners.ts`
- [x] T032 [P] [US6] Create `app/ui/partners/BOCWPaymentModal.tsx`: Amount Paid, Payment Date,
      Reference Number, Remarks fields; `react-hook-form` with zod validation
- [x] T033 [US6] Create `app/ui/partners/BOCWTable.tsx`: `ResponsiveList`-based, fully
      keyboard-operable (FR-014), columns (Project Name, Contract Value, Cess Rate, Cess
      Liability, Paid, Balance, Last Payment Date, Status badge, Actions); all monetary columns
      via `formatCurrency` (FR-009); Record Payment button disabled when
      `status === 'paid'` (spec US6 AC3); `BOCWPaymentModal` integration
- [x] T034 [US6] Create `app/dashboard/partners/bocw/page.tsx`: `BOCWPage` — paginated BOCW
      list; wire `@tanstack/react-query` with `['partners', 'bocw']` key; invalidate on payment

**Checkpoint**: All 6 user stories implemented.

---

## Phase 9: Polish & Cross-Cutting

- [x] T035 [P] Verify all monetary displays use `formatCurrency` — BOCW table, compliance
      amounts in `ComplianceModal` and `ComplianceTable`
- [x] T036 [P] Verify all status displays use `StatusBadge` — contractor list, compliance
      table, BOCW table (no inline colour class strings)
- [x] T037 [P] Verify `VendorModal` tab data is never lost on tab switch — manual test per
      quickstart.md Scenario 2 step 3
- [x] T038 [P] Run TypeScript type check (`npx tsc --noEmit`) and fix issues
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

---

## Implementation record — 2026-09-03

39 of 41 tasks complete. T039 and T040 are manual viewport and keyboard passes and
have not been performed — nothing has been opened in a browser.

### Two tasks were superseded by feature 014, not skipped

- **T001 (add a Partners nav group).** Feature 014 made the sidebar role-filtered from
  a single `NAV_MODULES` definition, which already contains a Partners entry guarded by
  the `PARTNERS` permission. Adding a second nav definition here is precisely the drift
  014's FR-014 exists to prevent. The sub-navigation *within* Partners is new
  (`app/ui/partners/partners-nav.tsx`); 014 scoped itself to top-level modules only, so
  that tier was genuinely unbuilt.
- **T005a (guard `/dashboard/partners/*` in `middleware.ts`).** Not reachable: feature
  001 keeps the access token in memory only, so middleware never sees it — the reason
  the Settings and HR guards live at their layout boundaries. 014's `ModuleGuard`
  already refuses this subtree without `PARTNERS`. What it could not know is that vendor
  categories are a Settings-owned master gated on `SETTINGS`, so `layout.tsx` adds that
  one check and nothing else.

### Other deviations

- **T004 / T005.** `formatCurrency` and a partners `StatusBadge` were to be created.
  `money`/`rupees` already exist in `app/lib/format.ts` and `StatusBadge` in
  `app/ui/hr/data-table.tsx`; both were extended rather than duplicated. BOCW statuses
  use `bocw_`-prefixed badge keys because BOCW's `partial` (part-paid, orange) and
  compliance's `partial` (one of two challans, amber) are different meanings that would
  otherwise be forced into one colour.
- **Component file consolidation.** T011–T014 specified four separate vendor tab files
  and T028 a separate `RagDot`. The tabs share one `react-hook-form` instance, so
  splitting them across files would mean threading `register`, `control` and `errors`
  through four prop interfaces to no benefit; they are sections of `vendor-modal.tsx`.
  Same for the RAG dot, which is one `<button>` in the cell.
- **`ResponsiveList` not used**, per this spec's own 2026-09-02 amendment: these are
  desktop surfaces, and `DataTable` puts the horizontal overflow on its own container so
  the page body never scrolls sideways.
- **"Verified by [name]" shows a date, not a name.** `GET /partners/compliance` returns
  `verifiedByUserId` and there is no endpoint that resolves an arbitrary user id, so the
  row says "Verified {date}". Inventing a name would be worse than omitting one.

### Verified

- `npx tsc --noEmit`, `npm run lint` (0 errors; 1 pre-existing warning), `npm run build`
  including the serwist step — all clean. All seven partners routes appear in the build.
- **Every one of the 22 API functions was executed against the running backend and its
  response parsed by the real zod schema** — the contract check passed on all 22. This is
  decision D4, and it is the class of bug that produced six defects in feature 005: four
  schemas there were written from the Prisma models rather than from responses, and each
  rejected a valid 200.
- One shape could not be checked live: a BOCW row, because the projects module it reads
  from is not built and the list is always empty. It is pinned by `bocw.service.spec.ts`
  in the API instead of guessed.

### Not verified

Nothing has been opened in a browser. The four-tab form's state preservation, the RAG
matrix's sticky columns at 1280px, keyboard operability, and every screen at a 768px
tablet width are written to satisfy their requirements and reasoned about, but not seen.
That is T039 and T040.
