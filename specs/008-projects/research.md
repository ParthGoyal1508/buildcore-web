# Research: Projects Frontend (Portfolio, Clients, Sites, BOQ, DWR, Revenue, P&L)

## 1. Route structure under `/dashboard/projects/*`

**Decision**: Seven route areas under `app/dashboard/projects/`:
- `portfolio/page.tsx` — project list
- `portfolio/[id]/page.tsx` — project detail (tabbed)
- `portfolio/new/page.tsx` — create project (full-page form)
- `portfolio/[id]/edit/page.tsx` — edit project
- `dwr/page.tsx` — DWR list
- `pnl/page.tsx` — P&L (redirect to portfolio → select project first)
- `clients/page.tsx` — client list
- `sites/page.tsx` — site list

`nav-links.tsx` gains a "Projects" group with sub-items: Portfolio, DWR, Clients, Sites.

**Rationale**: Mirrors the HR & Payroll pattern (feature 005) — sub-routes under a module prefix,
consistent with every other feature in `buildcore-web`. The P&L and Costing views live as tabs
inside `/portfolio/[id]/page.tsx` rather than their own top-level routes, since they are
project-scoped (no meaningful P&L view without selecting a project).

**Alternatives considered**: A single `/dashboard/projects/page.tsx` with internal tab routing —
rejected: each area has its own list page with its own filters and pagination, matching the pattern
Settings and HR & Payroll established.

## 2. Project detail page: full-page with tab strip

**Decision**: `/dashboard/projects/portfolio/[id]/page.tsx` is a full page (not a modal) with a
sticky tab strip for the nine tabs: Overview, Employees, Machinery, Materials, DWRs, Bills &
Expenses, Revenue, Costing, P&L. Each tab's content is a separate component co-located under
`app/dashboard/projects/portfolio/[id]/tabs/`. Tab navigation is URL-hash-based for shareability.

**Rationale**: The project detail page is the central hub of this feature with nine distinct tabs
of content — more than any other feature's detail page. A full page with its own URL makes it
linkable and avoids modal scrolling for large data sets (same logic as HR's 8-tab Employee form,
research.md §2 there).

**Alternatives considered**: Modal — rejected on same grounds as HR feature.

## 3. Project create/edit form: full page, single react-hook-form instance

**Decision**: `/dashboard/projects/portfolio/new/page.tsx` (and `[id]/edit/`) uses a single
`react-hook-form` instance spanning all fields, grouped into logical sections (not tabs, since
the form is smaller than the Employee 8-tab form). Fields match the PRD's modal exactly. On
navigation away with unsaved changes, Next.js route-change interception shows a "Discard changes?"
dialog.

**Rationale**: The project form has ~20 fields — large enough for a dedicated page but small
enough to show on one scrollable form without tabs, unlike the Employee form. Consistent
`react-hook-form` + `zod` validation pattern.

## 4. DWR measurement formula: live client-side computation

**Decision**: The DWR task entry section computes `Actual Qty = nos1 × nos2 × length × breadth ×
depth × density` live in the browser using a `watch` on those six fields in `react-hook-form`,
displaying the result in a read-only "Actual Qty" field. The server re-validates and stores the
computed value independently (FR-003). Zero values in any field produce 0 with an inline warning.

**Rationale**: The PRD explicitly shows the formula as an interactive "calculator" row; live
feedback is the expected UX. Client-side computation is purely presentational — the server
recomputes authoritatively on submit.

**Alternatives considered**: Show Actual Qty only after submit — rejected: the formula row is
a key data entry aid; without live feedback the user can't verify their measurements before
submitting.

## 5. BOQ tree: collapsible task groups with inline computed fields

**Decision**: BOQ is rendered as a collapsible tree table — `BOQTaskGroup` rows act as expandable
section headers; `BOQTaskItem` rows appear indented beneath them. Columns: BOQ No., Task Name,
Unit, Scope Qty, Done Qty, Pending Qty, Per Day Qty, Avg Qty Per Day, Days to Complete. The BOQ
Alert tabs (Today Task, Delayed, To Be Delayed) are shown as a separate card above the tree,
collapsible.

**Rationale**: BOQ structures are inherently hierarchical; a flat table loses the group context.
The collapsible tree matches the PRD's "Task Group (from BOQ groups)" / "Task (from BOQ items)"
dropdown hierarchy used in DWR entry.

## 6. P&L period selector: URL query parameter

**Decision**: The P&L tab's period selector (`?period=monthly|quarterly|yearly|cumulative`,
`?month=`, `?quarter=`, `?year=`) is reflected in the URL as a query parameter (FR-006). On
mount, the component reads the query param and issues the API call; on selector change, it pushes
the new param to the router and re-fetches. Implemented via Next.js `useSearchParams` +
`useRouter`.

**Rationale**: FR-006 mandates URL shareability. `useSearchParams` is the App Router's idiomatic
approach; tab-level query params are already used by the Dashboard feature for widget filters.

## 7. API client: `app/lib/api/projects.ts`

**Decision**: All `buildcore-api` calls for this feature go through a single typed API module at
`app/lib/api/projects.ts`, following the pattern `app/lib/api/hr-payroll.ts` (005) established.
Each function is a typed async function wrapping `fetch` with the auth header. `@tanstack/
react-query` manages caching and refetch logic in components.

**Rationale**: Constitution Principle V for this codebase requires all API calls through
`app/lib/api/<module>.ts`; centralising them here makes mocking trivial for future automated
tests.

## 8. Indian number formatting for financial figures

**Decision**: A `formatCurrency(amount: number): string` utility (or an existing one, if already
in `app/lib/utils.ts`) formats amounts with the Indian locale: `₹` symbol, lakh/crore grouping
(`1,00,000` style). This is used on every monetary display: Contract Value, Revenue Booked, P&L
cost lines, Budget amounts. The formatter is added to `app/lib/utils.ts` if not already present.

**Rationale**: FR-010 mandates Indian number formatting; using a centralised formatter avoids
18 separate `toLocaleString('en-IN')` calls scattered across components.

## 9. Status badge consistency

**Decision**: Project status badges (Planning=gray, Ongoing=green, On Hold=orange,
Completed=blue), DWR status badges (Draft=gray, Submitted=orange, Approved=green), and RA Bill
status badges (Draft=gray, Submitted=yellow, Approved=green) all use a shared `StatusBadge`
component (or the existing badge pattern from Settings/HR features) with a colour map. No
ad-hoc inline colour classes.

**Rationale**: FR-009 mandates consistent badge colours; a single `StatusBadge` component with a
`status → colour` map is the only way to enforce this reliably across eight screens.
