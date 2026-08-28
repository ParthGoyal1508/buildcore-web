# Research: Partners Frontend (Vendors, Contractor Vault, Compliance, RAG Matrix, BOCW Cess)

## 1. Route structure under `/dashboard/partners/*`

**Decision**: Six route areas:
- `vendors/page.tsx` — vendor list
- `vendors/categories/page.tsx` — vendor categories
- `contractors/page.tsx` — contractor vault list
- `contractors/[id]/page.tsx` — contractor detail (documents + compliance history)
- `contractors/compliance/page.tsx` — monthly compliance table
- `contractors/rag/page.tsx` — RAG Matrix
- `bocw/page.tsx` — BOCW cess table

`nav-links.tsx` gains a "Partners" group with sub-items: Vendors, Contractors, Compliance, RAG
Matrix, BOCW Cess. Vendor Categories is a sub-page linked from the Vendors page header
("Manage Categories" button), not a top-level nav item.

**Rationale**: Mirrors the Projects (008) pattern of a module-prefix route group. Categories
is a settings-style sub-page used infrequently — keeping it off the main nav reduces clutter
while remaining accessible.

## 2. Vendor 4-tab modal (not a full page)

**Decision**: Vendor Add/Edit is a modal with 4 tabs (Details, Address, Contacts, Work Detail),
using a single `react-hook-form` instance. Same pattern as Settings' Company modal (002) and
Projects' WorkOrder modal (008). The Vendor modal is kept modal-sized because the form is
comparable to Settings' Company (not as large as the 8-tab Employee full page from 005).

**Rationale**: Vendor CRUD is frequent (many vendors added); a modal is faster than navigating
away. The 4-tab structure fits comfortably in a large modal (≤ ~20 fields per tab).

## 3. Contacts tab: `useFieldArray` for dynamic rows

**Decision**: The Contacts tab uses `react-hook-form`'s `useFieldArray` hook to manage a
dynamic list of `{ name, phone, email }` rows with Add/Remove controls. Minimum 0 rows. The
array is the complete contacts state sent on save (atomic replace matches the backend).

**Rationale**: `useFieldArray` is already available from `react-hook-form` (no new dependency);
it handles the add/remove-row pattern cleanly with proper form state integration.

## 4. RAG Matrix: sticky CSS table, FY selector as URL param

**Decision**: The RAG Matrix is a plain HTML `<table>` with:
- `position: sticky; left: 0` on the contractor name column (first `<td>`)
- `position: sticky; top: 0` on the month header row (`<th>`)
- Overflow-x scroll on the table container
- FY selector updates `?fy=YYYY-YY` query param via `useSearchParams` + `useRouter.push`
  (same pattern as Projects' P&L period selector — research.md §6 there)

No third-party grid library. CSS sticky is supported in all modern browsers and requires no
additional dependencies.

**Rationale**: The RAG Matrix data is small (≤50 rows × 12 cols = 600 cells) — a plain table
handles it without virtualisation. CSS sticky is the standard approach for frozen headers/columns.

## 5. RAG dot click: URL navigation to compliance list

**Decision**: Clicking a non-gray RAG dot navigates to `/dashboard/partners/contractors/compliance
?contractorId=X&month=YYYY-MM` — pre-filtering the compliance list to that exact contractor and
month. No modal or drawer overlay. Gray dots have `pointer-events: none` to prevent clicks.

**Rationale**: URL-based navigation is simpler than a drawer, more shareable, and consistent
with Projects' pattern of using URL params for filters.

## 6. Compliance month picker: restrict to past months

**Decision**: The Month field in the compliance recording modal uses `<input type="month">`
with `max={currentYearMonth}` (e.g., `max="2026-08"`) to prevent future-month selection.
Validated client-side before submission.

**Rationale**: The backend allows future months but the PRD intends compliance recording for
concluded months. Client-side prevention avoids a confusing server rejection.

## 7. StatusBadge extension for compliance and partner statuses

**Decision**: The `StatusBadge` component (introduced in Projects, 008) is extended with new
colour mappings: `compliant` → green, `non_compliant` → red, `partially_compliant` → yellow,
`verified` → green (same as compliant), `submitted` → blue, `partial` → yellow, `missing` →
red, `pending` → red (BOCW), `paid` → green (BOCW), `partial` (BOCW) → orange.

If `StatusBadge` doesn't yet exist (if 008 hasn't shipped), create it in this feature.

## 8. API client: `app/lib/api/partners.ts`

**Decision**: All `buildcore-api` calls go through `app/lib/api/partners.ts` — same convention
as `app/lib/api/projects.ts` (008). Follows Constitution Principle V for this codebase.

## 9. Middleware guard and ResponsiveList/keyboard-operability — found missing on re-audit

**Decision**: `middleware.ts` gains a `/dashboard/partners/*` route matcher: `PARTNERS` for
vendors/contractors/bocw sub-routes, `SETTINGS` for `/dashboard/partners/vendors/categories`
(mirroring the backend's corrected permission mapping, `007-partners-backend` research.md §9).
Every list screen (Categories, Vendors, Contractors, Compliance, BOCW) uses this app's existing
`ResponsiveList` component and is fully keyboard-operable, built in per-component from the
start. The RAG Matrix is the one exception — a dense contractor×month grid isn't amenable to
`ResponsiveList`'s card-layout pattern — but its dots are real `<button>` elements (Tab-reachable,
`disabled` rather than merely `pointer-events: none` for gray cells) so keyboard access isn't
lost even where the card layout is.

**Rationale**: Both were simply missing from this feature's original scope — a gap caught during
a master-PRD alignment audit, the same class of gap (middleware guard, `ResponsiveList`) that
`006-plant-machinery`'s web spec needed the identical retrofit for. This app's constitution makes
both NON-NEGOTIABLE; there's no principled reason for Partners to be the exception.

**Alternatives considered**: Exempting the RAG Matrix from keyboard access entirely (treating it
as a read-only visualization) — rejected: FR-007 already requires dot clicks to navigate, so the
interaction exists regardless; making it keyboard-reachable costs nothing beyond using `<button>`
instead of a styled `<div>`.
