---

description: "Task list for feature implementation"
---

# Tasks: Projects Frontend (Portfolio, Clients, Sites, BOQ, DWR, Revenue, P&L)

**Input**: Design documents from `/specs/008-projects/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/projects-web-api.md, quickstart.md

**Tests**: No automated test framework installed (constitution's documented gap). Verification
via quickstart.md.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US8)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] Add "Projects" nav group to `app/ui/dashboard/nav-links.tsx` with sub-items:
      Portfolio (`/dashboard/projects/portfolio`), DWR (`/dashboard/projects/dwr`),
      Clients (`/dashboard/projects/clients`), Sites (`/dashboard/projects/sites`)
- [ ] T002 [P] Create `app/dashboard/projects/layout.tsx` with breadcrumb and sub-nav shell
      consistent with the existing dashboard module layout pattern
- [ ] T003 [P] Add `formatCurrency(amount: number): string` utility to `app/lib/utils.ts`
      using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` — research.md §8,
      FR-010
- [ ] T004 [P] Create `app/lib/api/projects.ts` with all typed API function signatures
      (stubs returning `fetch` calls to the correct endpoints) — research.md §7,
      contracts/projects-web-api.md
- [ ] T005 [P] Create `app/ui/projects/ProjectLockContext.tsx`: React context providing
      `isLocked: boolean` and `projectId: string`; consumed by all tab components and action
      buttons to disable writes — plan.md constraint
- [ ] T006 [P] Create `app/ui/projects/StatusBadge.tsx`: shared badge component accepting
      `status` prop with colour maps for project status (Planning=gray, Ongoing=green,
      On Hold=orange, Completed=blue), DWR status (Draft=gray, Submitted=orange,
      Approved=green), and RA Bill status (Draft=gray, Submitted=yellow, Approved=green) —
      FR-009, research.md §9

**Checkpoint**: Nav, layout, API module, lock context, currency formatter, and status badge ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T007 Define all TypeScript interfaces and zod schemas from data-model.md in
      `app/lib/api/projects.ts`: `Client`, `Site`, `Project`, `ProjectDetail`, `BOQTaskGroup`,
      `BOQTaskItem`, `DWR`, `Revenue`, `RABill`, `WorkOrder`, `PnlCostRow`, `ProjectPnl`,
      `projectSchema`, `dwrTaskSchema` — these type the API functions from T004

**Checkpoint**: All types and schemas defined; components can be built with correct prop shapes.

---

## Phase 3: User Story 1 — Manage Clients (Priority: P1) 🎯 MVP

**Goal**: Client list with search/status filter, Add/Edit modal with GSTIN validation, status
toggle, delete guard.

**Independent Test**: Add a client, edit it, toggle inactive, verify filtered list — no project
data needed.

### Implementation for User Story 1

- [ ] T008 [P] [US1] Implement `getClients`, `createClient`, `updateClient`, `deleteClient` in
      `app/lib/api/projects.ts` — contracts/projects-web-api.md Clients section
- [ ] T009 [P] [US1] Create `app/ui/projects/ClientModal.tsx`: `react-hook-form` form with
      zod validation for Name (required), Contact Person, Phone, Email, Address, GSTIN
      (15-char alphanumeric format validation per FR in spec); handles create and edit modes
- [ ] T010 [US1] Create `app/dashboard/projects/clients/page.tsx`: `ClientsPage` — table with
      columns (Client Name, Contact Person, Phone, Email, Projects count, Status, Actions),
      search + status filter, pagination, "Add Client" button opening `ClientModal`, inline
      delete with `409` handling ("Client has linked projects")
- [ ] T011 [US1] Wire `@tanstack/react-query` for client list (`['projects', 'clients', params]`
      query key) and mutations (create/update/delete with `invalidateQueries` on success)

**Checkpoint**: Clients CRUD fully functional and independently verifiable.

---

## Phase 4: User Story 2 — Manage Sites (Priority: P1)

**Goal**: Site list with project filter, Add/Edit modal with GPS validation, status toggle.

**Independent Test**: Add a site with lat/lng/radius, confirm it appears in the list, edit
radius — no DWR or BOQ needed.

### Implementation for User Story 2

- [ ] T012 [P] [US2] Implement `getSites`, `createSite`, `updateSite` in
      `app/lib/api/projects.ts`
- [ ] T013 [P] [US2] Create `app/ui/projects/SiteModal.tsx`: fields for Site Name, Project
      (searchable dropdown), Location address, Latitude (`@Min(-90)/@Max(90)` via zod),
      Longitude (`@Min(-180)/@Max(180)`), Geofence Radius (positive integer, helper label
      "Employees outside this radius will be flagged") — spec FR-012
- [ ] T014 [US2] Create `app/dashboard/projects/sites/page.tsx`: `SitesPage` — table with
      (Site Name, Project linked, Location, Geofence Radius m, Status, Actions), project filter,
      "Add Site" button, `SiteModal` integration

**Checkpoint**: Sites CRUD fully functional.

---

## Phase 5: User Story 3 — Project Portfolio List & Form (Priority: P1)

**Goal**: Project list with search/status/client filters and lock badge; Create/Edit full-page
form; lock toggle with confirmation.

**Independent Test**: Create a project (auto-code), apply status filter, edit it, toggle lock
(lock icon appears, locked banner on detail page).

### Implementation for User Story 3

- [ ] T015 [P] [US3] Implement `getProjects`, `createProject`, `updateProject`, `deleteProject`
      in `app/lib/api/projects.ts`
- [ ] T016 [P] [US3] Create `app/ui/projects/ProjectForm.tsx`: single `react-hook-form`
      instance with `projectSchema` (data-model.md), grouped fields (Basic Info, Contract,
      Dates, Assignment), Client searchable dropdown, Project Manager searchable employee
      dropdown (calls HR employee list API), route-change interception for unsaved changes
      ("Discard changes?" dialog) — spec FR-002, research.md §3
- [ ] T017 [P] [US3] Create `app/ui/projects/ProjectListTable.tsx`: table with (Code, Name,
      Client, Location, Contract Value via `formatCurrency`, Status badge, Start Date, End Date,
      lock icon if `isLocked`, Actions: View/Edit/Delete) — FR-010
- [ ] T018 [US3] Create `app/dashboard/projects/portfolio/page.tsx`: `PortfolioPage` with
      `ProjectListTable`, search/status/client filters, "Add Project" button
- [ ] T019 [US3] Create `app/dashboard/projects/portfolio/new/page.tsx` and
      `app/dashboard/projects/portfolio/[id]/edit/page.tsx` using `ProjectForm` for create
      and edit respectively; redirect to detail page on save
- [ ] T020 [US3] Lock toggle: in the Edit form, "Is Locked" toggle shows a confirmation dialog
      ("Lock this project? All data entry will be disabled.") before saving; on save, re-fetch
      project data to propagate lock state through `ProjectLockContext`

**Checkpoint**: Portfolio list, create, edit, and lock toggle fully functional.

---

## Phase 6: User Story 4 — Project Detail Page (Priority: P1)

**Goal**: Nine-tab full-page project detail layout with `ProjectLockContext` provider and
persistent locked banner; all tabs render (empty states for no-data tabs).

**Independent Test**: Open detail page, click all 9 tabs, confirm each renders without error;
lock project → banner appears, action buttons disabled.

### Implementation for User Story 4

- [ ] T021 [P] [US4] Implement `getProject` in `app/lib/api/projects.ts` (returns
      `ProjectDetail` with tabs aggregation)
- [ ] T022 [US4] Create `app/dashboard/projects/portfolio/[id]/page.tsx`: `ProjectDetailPage`
      — sticky tab strip (9 tabs, URL-hash-based navigation), `ProjectLockContext.Provider`
      wrapping the page, locked banner (`isLocked` → persistent red/orange banner
      "This project is locked — data entry is disabled" — FR-005)
- [ ] T023 [P] [US4] Create `app/dashboard/projects/portfolio/[id]/tabs/OverviewTab.tsx`:
      summary card with all project fields, Contract Value via `formatCurrency`
- [ ] T024 [P] [US4] Create `EmployeesTab.tsx`, `MachineryTab.tsx`, `MaterialsTab.tsx`:
      read-only lists from `ProjectDetail.tabs` aggregation; empty states if no data
- [ ] T025 [P] [US4] Create `DWRTab.tsx`: summary count + link to `/dashboard/projects/dwr
      ?projectId=` with "Add DWR" button (disabled when locked via `ProjectLockContext`)
- [ ] T026 [P] [US4] Create `BillsExpensesTab.tsx`: sub-tab shell (Bills, Expenses, Work
      Orders) — content wired in US7 (Phase 9)

**Checkpoint**: Detail page shell with all 9 tabs navigable; lock context and banner working.

---

## Phase 7: User Story 5 — BOQ Management (Priority: P2)

**Goal**: Collapsible BOQ tree, Add Group/Item forms, Excel import with error display, BOQ
Alert tabs.

**Independent Test**: Add group + 2 items, import 5-row Excel (1 bad row) → see "4 imported,
1 error" + download link; BOQ Alerts show correct classifications.

### Implementation for User Story 5

- [ ] T027 [P] [US5] Implement `getBOQ`, `createBOQGroup`, `createBOQItem`, `importBOQ`,
      `getBOQAlerts` in `app/lib/api/projects.ts`
- [ ] T028 [P] [US5] Create `app/ui/projects/BOQTree.tsx`: collapsible tree table (group rows
      expand to show items), columns (BOQ No., Task Name, Unit, Scope Qty, Done Qty, Pending Qty,
      Per Day Qty, Avg Qty/Day, Days to Complete), inline Add Group/Add Item forms at the
      bottom; disabled when locked (`ProjectLockContext`)
- [ ] T029 [P] [US5] Create `app/ui/projects/BOQImportButton.tsx`: file input for `.xlsx`,
      upload via `importBOQ`, on complete show "N rows imported. M errors." with "Download Error
      Report" anchor link to `errorReportUrl`; progress indicator during upload — FR-004
- [ ] T030 [US5] Create `app/ui/projects/BOQAlertTabs.tsx`: three-tab card (Today Task,
      Delayed, To Be Delayed) each showing a list of BOQ items with their context (BOQ No.,
      Task Name, Pending Qty, deadline info); auto-refreshes when BOQ query is invalidated
- [ ] T031 [US5] Integrate BOQ section into project detail (new tab or within existing DWR tab
      area) and wire `@tanstack/react-query` BOQ queries

**Checkpoint**: BOQ tree, import, and alerts fully functional.

---

## Phase 8: User Story 6 — Daily Work Reports (Priority: P2)

**Goal**: DWR list with filters; Add DWR modal with BOQ task picker and live Actual Qty
computation; Approve action with confirmation.

**Independent Test**: Create DWR, enter measurement values, see live Actual Qty, submit, approve
from list — BOQ Done Qty updates visible on next BOQ load.

### Implementation for User Story 6

- [ ] T032 [P] [US6] Implement `getDWRs`, `createDWR`, `getDWR`, `updateDWR`, `approveDWR`
      in `app/lib/api/projects.ts`
- [ ] T033 [P] [US6] Create `app/ui/projects/DWRTaskRow.tsx`: single task entry row with 6
      measurement inputs (nos1, nos2, length, breadth, depth, density), live `actualQty`
      computed via `react-hook-form` `watch` (displayed as read-only result), `boqItemId`
      selector (searchable from project's BOQ items), zero-value warning — spec FR-003,
      research.md §4
- [ ] T034 [US6] Create `app/ui/projects/DWRModal.tsx`: full DWR form — Project dropdown,
      Work Date (default today), DPR Number (read-only auto), Supervisor searchable employee
      dropdown, Weather, Contract For (radio), add/remove `DWRTaskRow` entries; disabled when
      locked (`ProjectLockContext`) — spec US6 AC2/AC3
- [ ] T035 [US6] Create `app/ui/projects/DWRListTable.tsx` and
      `app/dashboard/projects/dwr/page.tsx`: DWR list with (Date, Project, Supervisor, Workers,
      Machinery, Progress %, Weather, Status badge, Actions); filters (Project, date range,
      Status); "Add DWR" button; Approve action with `window.confirm` dialog — spec US6 AC5
- [ ] T036 [US6] Wire `@tanstack/react-query` DWR queries with project-scoped keys
      `['project', id, 'dwr']`; on approve mutation, also invalidate BOQ query to reflect
      updated `doneQty`

**Checkpoint**: DWR creation, submission, approval, and BOQ doneQty refresh all working.

---

## Phase 9: User Story 7 — Revenue, RA Bills & Work Orders (Priority: P3)

**Goal**: Revenue entries modal, RA Bill cards with Submit/Approve/Reject state actions
(confirm dialogs, Reject requires remark), Work Order tabbed modal.

**Independent Test**: Add revenue entry, create RA bill → Submit → Approve; confirm P&L tab
Revenue Booked updates.

### Implementation for User Story 7

- [ ] T037 [P] [US7] Implement `getRevenue`, `createRevenue`, `getRABills`, `createRABill`,
      `submitRABill`, `approveRABill`, `rejectRABill`, `getWorkOrders`, `createWorkOrder`
      in `app/lib/api/projects.ts`
- [ ] T038 [P] [US7] Create `app/ui/projects/RevenueModal.tsx`: fields for Description,
      Amount, Date, Status (Received/Pending)
- [ ] T039 [P] [US7] Create `app/ui/projects/RABillCard.tsx`: displays bill row with
      `StatusBadge`; action buttons per state: Submit (→ confirm dialog), Approve (→ confirm
      dialog), Reject (→ modal with required `rejectionRemark` text area before Confirm) —
      spec FR-007, US7 AC5
- [ ] T040 [P] [US7] Create `app/ui/projects/WorkOrderModal.tsx`: 6-tab modal (Work Detail,
      Terms & Conditions, Requirements, Hire Contract, Material, Labour); single
      `react-hook-form` instance preserving data across tab switches — spec FR-011
- [ ] T041 [US7] Complete `RevenueTab.tsx` (US4 Phase 6 shell): wire revenue list +
      `RevenueModal`, RA Bills section with `RABillCard` rows, lock-aware action buttons
- [ ] T042 [US7] Complete `BillsExpensesTab.tsx` (US4 Phase 6 shell): wire Work Orders sub-tab
      with `WorkOrderModal`

**Checkpoint**: Revenue, RA Bill workflow, and Work Orders fully functional.

---

## Phase 10: User Story 8 — Project P&L Dashboard (Priority: P3)

**Goal**: P&L tab with 5 summary cards, cost breakdown table (red overrun highlights), P&L
statement, period selector as URL param, budget entry form.

**Independent Test**: Open P&L tab, change period selector (URL updates, figures refresh),
enter budgets, verify overrun highlight when actual > budget × 1.10.

### Implementation for User Story 8

- [ ] T043 [P] [US8] Implement `getBudget`, `upsertBudget`, `getPnl` in
      `app/lib/api/projects.ts`
- [ ] T044 [P] [US8] Create `app/ui/projects/PnlSummaryCards.tsx`: 5 cards — Contract Value
      (neutral), Revenue Booked (green), Total Expenses (red), Gross Profit (purple),
      Margin % (orange) — all amounts via `formatCurrency`
- [ ] T045 [P] [US8] Create `app/ui/projects/PnlCostBreakdown.tsx`: table with rows for 5
      P&L categories, columns (Category, Budget ₹, Actual ₹, Variance ₹, Variance %);
      rows with `costOverrunAlert: true` highlighted red (row background); rows under budget
      show green variance — spec US8 AC2
- [ ] T046 [P] [US8] Create `app/ui/projects/PnlStatement.tsx`: static equation display
      (Revenue Booked − Labour − Materials − Machinery & Fuel − Subcontractors − Overheads =
      Gross Profit) with live values filled in; Margin % below
- [ ] T047 [P] [US8] Create `app/ui/projects/BudgetForm.tsx`: inline editable form with 5
      category rows (Category label + Amount input); submits via `upsertBudget` on save;
      disabled when locked (`ProjectLockContext`)
- [ ] T048 [US8] Complete `PnlTab.tsx`: compose `PnlSummaryCards`, `PnlCostBreakdown`,
      `PnlStatement`, `BudgetForm`; period selector dropdown wired to `useSearchParams` +
      `useRouter` push (→ URL updates, react-query refetch on param change) — FR-006,
      research.md §6; `unavailableModules` array renders inline "data unavailable" badge per
      row — spec US8 AC5
- [ ] T049 [US8] Complete `CostingTab.tsx` (US4 Phase 6 shell): wire `PnlCostBreakdown` and
      `BudgetForm` for the Costing tab view (same data, no period selector)

**Checkpoint**: Full P&L tab functional with period selector, budget entry, and overrun alerts.

---

## Phase 11: Polish & Cross-Cutting

- [ ] T050 [P] Add "Projects" entry to the dashboard nav and confirm the layout renders without
      errors in dev server (`npm run dev`)
- [ ] T051 [P] Verify all monetary displays use `formatCurrency` — no raw `amount.toFixed(2)`
      or plain number renders in any projects component
- [ ] T052 [P] Verify all status displays use `StatusBadge` — no inline colour class strings
      for status in any projects component
- [ ] T053 [P] Verify all `ProjectLockContext` consumers (`DWRModal`, `BOQTree`, `RevenueModal`,
      `RABillCard`, `WorkOrderModal`, `BudgetForm`) disable their add/edit/delete actions when
      `isLocked: true` — FR-005
- [ ] T054 [P] Run TypeScript type check (`npx tsc --noEmit`) and fix any issues
- [ ] T055 [P] Manually verify quickstart.md Scenario 8 (locked project end-to-end) in dev

---

## Dependencies

```
Phase 1 (Setup) → Phase 2 (Types) ──┬── US1 (Clients) ──┐
                                     ├── US2 (Sites)      │
                                     └── US3 (Portfolio) ─┤
                                                           └── US4 (Detail) ─┬── US5 (BOQ)
                                                                              ├── US6 (DWR)
                                                                              ├── US7 (Revenue)
                                                                              └── US8 (P&L)
```

US1, US2, and US3 can be built in parallel after Phase 2. US4 requires US3 (needs a project
to view). US5–US8 all require the US4 detail page shell. US5 and US6 are independent of each
other. US7 and US8 are independent of each other and of US5/US6 (though US8 benefits from
US7 data).

## Parallel execution opportunities

- T008–T011 (US1) and T012–T014 (US2) and T015–T020 (US3) can all begin in parallel after T007
- Within US5: T027, T028, T029 are all independent (API functions, BOQ tree, import button)
- Within US6: T032, T033 are independent (API functions, task row component)
- Within US7: T037, T038, T039, T040 are all independent
- Within US8: T043, T044, T045, T046, T047 are all independent
- T050–T055 (Phase 11) are all independent

## Implementation Strategy

**MVP (Phase 1–6, US1–US4)**: Nav + shared infrastructure, Clients, Sites, Portfolio list/form,
and the Project Detail page shell. Delivers a fully navigable projects section where every tab
renders (even if most show empty states).

**Increment 2 (Phase 7–8, US5–US6)**: BOQ management and DWR — the daily operational workflow.

**Increment 3 (Phase 9–11, US7–US8 + polish)**: Revenue/billing, P&L dashboard, and final
cross-cutting consistency checks.
