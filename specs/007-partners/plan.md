# Implementation Plan: Partners Frontend (Vendors, Contractor Vault, Compliance, RAG Matrix, BOCW)

**Branch**: `007-partners` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-partners/spec.md`

## Summary

Build six route areas under `/dashboard/partners/*` — Vendor Categories (sub-page), Vendor list
with 4-tab modal (single `react-hook-form` with `useFieldArray` contacts), Contractor Vault with
document expiry warnings, Monthly Compliance recording + verify workflow, RAG Matrix as a sticky
CSS table with FY URL param, and BOCW Cess table with payment recording. Extends `StatusBadge`
with compliance statuses. All API calls through `app/lib/api/partners.ts`. See
[research.md](research.md) for all 8 decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing only — `react-hook-form` + `useFieldArray`, `zod`,
`@tanstack/react-query`, `useSearchParams`/`useRouter`. No new dependency.

**Storage**: N/A — all data in `buildcore-api`.

**Testing**: No automated test framework. Verification via [quickstart.md](quickstart.md).

**Target Platform**: Desktop web (primary) + mobile-responsive.

**Project Type**: Web application — `buildcore-web` frontend only.

**Performance Goals**: RAG Matrix renders 50 contractors × 12 months in under 3 seconds (SC-002).
Vendor 4-tab form never loses entered data on tab switch (SC-004).

**Constraints**: All API calls through `app/lib/api/partners.ts`; `formatCurrency` from
`app/lib/utils.ts`; `StatusBadge` extended (not duplicated); RAG Matrix with native CSS sticky
(no grid library); compliance month picker restricted to past months client-side (FR-006 in spec).

**Scale/Scope**: 7 new route files, ~15 new components, ~22 typed API functions, 1 API module.

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| No inline styles | Tailwind + clsx throughout | PASS |
| No literal strings/URLs inline | All endpoints in `app/lib/api/partners.ts` | PASS |
| TypeScript strict + zod | All form schemas are zod; all API types defined in data-model.md | PASS |
| All API calls through `app/lib/api/` | Single `partners.ts` module | PASS |
| Mobile-first | Responsive at existing breakpoints; RAG Matrix overflow-x on narrow screens | PASS |

## Project Structure

```text
app/
├── dashboard/
│   └── partners/
│       ├── layout.tsx
│       ├── vendors/
│       │   ├── page.tsx
│       │   └── categories/page.tsx
│       ├── contractors/
│       │   ├── page.tsx
│       │   ├── [id]/page.tsx
│       │   ├── compliance/page.tsx
│       │   └── rag/page.tsx
│       └── bocw/page.tsx
├── lib/api/
│   └── partners.ts
└── ui/partners/
    └── [15 components per data-model.md]
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Add "Partners" nav group to `nav-links.tsx` (Vendors, Contractors, Compliance, RAG, BOCW)
- [ ] Create `app/dashboard/partners/layout.tsx` (breadcrumb + sub-nav)
- [ ] Create `app/lib/api/partners.ts` with all 22 typed API function stubs
- [ ] Ensure `formatCurrency` exists in `app/lib/utils.ts` (create if 008 not yet merged)
- [ ] Extend `StatusBadge` colour map with compliance statuses (research.md §7)

**Checkpoint**: Nav, layout, API module, and badge extension ready.

### Phase 2: US1 — Vendor Categories (P1)

- [ ] `VendorCategoryModal.tsx` (Add/Edit)
- [ ] `app/dashboard/partners/vendors/categories/page.tsx` — table with count, modal, delete
      with 409 handling
- [ ] Wire `@tanstack/react-query` category queries

**Checkpoint**: Categories CRUD functional.

### Phase 3: US2 — Vendors (P1)

- [ ] `VendorDetailsTab.tsx`, `VendorAddressTab.tsx`, `VendorWorkDetailTab.tsx`
- [ ] `VendorContactsTab.tsx` with `useFieldArray` add/remove rows (FR-003)
- [ ] `VendorModal.tsx` — 4-tab single `react-hook-form` instance with `vendorSchema`; Work
      Detail tab conditionally enabled on type = subcontractor/labour_contractor (FR-005)
- [ ] `VendorListTable.tsx` — active toggle with confirmation dialog (FR-010)
- [ ] `app/dashboard/partners/vendors/page.tsx` — list, search/type/active filters, Add Vendor

**Checkpoint**: Vendor 4-tab modal and list fully functional.

### Phase 4: US3 — Contractor Vault (P2)

- [ ] `ContractorModal.tsx` — vendor picker (filtered to subcontractor/labour_contractor type)
- [ ] `ContractorDocumentRow.tsx` — document row with `expiryWarning` badge (FR in spec)
- [ ] `app/dashboard/partners/contractors/page.tsx` — list with complianceStatus badge
- [ ] `app/dashboard/partners/contractors/[id]/page.tsx` — detail: documents with upload +
      delete, compliance history link

**Checkpoint**: Contractor vault and document management functional.

### Phase 5: US4 — Monthly Compliance (P2)

- [ ] `ComplianceModal.tsx` — contractor dropdown, month picker (`max={currentMonth}`),
      PF + ESIC sections independent, `complianceSchema` validation
- [ ] `ComplianceTable.tsx` — table with status badges, Edit, Verify action (confirmation dialog
      + "Verified by X on Y" label for verified rows — spec US4 AC4/AC5)
- [ ] `app/dashboard/partners/contractors/compliance/page.tsx` — reads `contractorId` + `month`
      from URL params (for RAG dot navigation), pre-filters table

**Checkpoint**: Compliance recording and verify workflow fully functional.

### Phase 6: US5 — RAG Matrix (P2)

- [ ] `RagDot.tsx` — coloured dot component (`verified`=green, `submitted`/`partial`=yellow,
      `missing`=red, `gray`=gray; `pointer-events: none` for gray — FR-007)
- [ ] `RagMatrix.tsx` — sticky CSS table (sticky first column + header row), overflow-x
      container, FY selector updating `?fy=` URL param, dot click → navigate to compliance
      list with filters (research.md §4, §5)
- [ ] `app/dashboard/partners/contractors/rag/page.tsx` — reads `?fy=` from URL, calls
      `getRagMatrix(fy)`, renders `RagMatrix`

**Checkpoint**: RAG Matrix with sticky layout, FY switching, and dot navigation functional.

### Phase 7: US6 — BOCW Cess (P3)

- [ ] `BOCWPaymentModal.tsx` — Amount, Date, Reference, Remarks fields
- [ ] `BOCWTable.tsx` — project rows with `formatCurrency` on all monetary columns, Status
      badge, Record Payment button (disabled when status=paid — spec US6 AC3)
- [ ] `app/dashboard/partners/bocw/page.tsx` — paginated BOCW list, payment modal integration

**Checkpoint**: BOCW cess recording fully functional.

### Phase 8: Polish

- [ ] Verify all monetary displays use `formatCurrency` (BOCW table, compliance amounts)
- [ ] Verify all status displays use `StatusBadge` (contractor list, compliance table, BOCW)
- [ ] TypeScript type check (`npx tsc --noEmit`)
- [ ] Manual quickstart.md walkthrough
