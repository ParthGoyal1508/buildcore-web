# Feature Specification: Projects Frontend (Portfolio, Clients, Sites, BOQ, DWR, Revenue, P&L)

**Feature Branch**: `008-projects`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Projects Module (Portfolio, Clients, Sites, BOQ, Daily Work Reports,
Revenue & Billing, Project P&L) for the BuildCore ERP frontend (buildcore-web), per the PRD at
/Users/p0g02o7/Personal/ERP-Demo/docs/prd/05-projects.prd.md. Nested under the existing admin
/dashboard/* shell at /dashboard/projects/* (nav-links.tsx will need a 'Projects' entry). Consumes
the backend contract specified in buildcore-api specs/008-projects-backend/contracts/projects-api.md.
Reuses this app's established patterns: ResponsiveList (Settings), the generic widget/filter
renderers (Dashboard), and the tabbed detail layout (HR & Payroll Employee Detail)."

## Clarifications

### Session 2026-09-01 (ratification — frontend gap-closure clarify pass)

- Q: How much backend validation should the client duplicate? → A: Only deterministic rules —
  baseline weightage summing to 100 is checked client-side; dependency cycle detection is surfaced
  from the server response.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Clients (Priority: P1)

An admin views the Client list (search, filter, paginate), creates and edits clients in a modal,
and toggles client status (Active/Inactive).

**Why this priority**: Clients are the first dependency for creating a project; this is the
simplest, no-dependency master-data screen.

**Independent Test**: Can be fully tested by opening `/dashboard/projects/clients`, creating a
client with all fields (Name, Contact Person, Phone, Email, Address, GSTIN), confirming it appears
in the table, editing its phone number, and toggling it to Inactive — independent of projects,
sites, or any other screen existing.

**Acceptance Scenarios**:

1. **Given** the Clients page, **When** loaded, **Then** it shows a table with columns: Client
   Name, Contact Person, Phone, Email, Address, Projects (count), Status, Actions (Edit/Delete);
   server-side paginated and filterable by name/contact search and status.
2. **Given** the Add Client modal, **When** all required fields are filled and submitted, **Then**
   the client is created, the modal closes, and the table refreshes with the new row.
3. **Given** the Edit Client modal, **When** a field is changed and saved, **Then** the table row
   updates immediately (optimistic or refetch).
4. **Given** a client linked to active projects, **When** Delete is attempted, **Then** a
   confirmation dialog warns that the client has linked projects; deletion is blocked if projects
   exist (per backend `409`).
5. **Given** a GSTIN field, **When** the user types, **Then** it is validated for format
   (15-character alphanumeric per Indian GST standard) before submission.

---

### User Story 2 - Manage Sites (Priority: P1)

An admin views the Site list, creates and edits sites with geofencing data (lat/lng + radius),
and links sites to projects.

**Why this priority**: Sites feed HR attendance geofencing; building the full site form (including
coordinates and radius) is a prerequisite for projects to have operational sites.

**Independent Test**: Can be fully tested by opening `/dashboard/projects/sites`, creating a site
with a project, latitude, longitude, and radius, confirming it appears in the list, and editing
the radius — independent of DWR or BOQ screens.

**Acceptance Scenarios**:

1. **Given** the Sites page, **When** loaded, **Then** it shows a table with: Site Name, Project
   (linked), Location (address + coordinates), Geofence Radius (m), Status, Actions (Edit/Delete).
2. **Given** the Add/Edit Site modal, **When** opened, **Then** it shows Site Name, Project
   (dropdown), Location address, Latitude, Longitude, Geofence Radius (m), and Status toggle.
3. **Given** the Latitude/Longitude fields, **When** the user enters values, **Then** they are
   validated as numbers within valid GPS ranges (Latitude −90 to 90, Longitude −180 to 180).
4. **Given** the Geofence Radius field, **When** set, **Then** it accepts only positive integers
   (meters) and shows a helper label (e.g., "Employees punching outside this radius will be
   flagged").
5. **Given** a saved site, **When** the Edit modal is opened, **Then** current coordinates and
   radius are pre-filled.

---

### User Story 3 - Project Portfolio (Priority: P1)

An admin views the Project list, creates and edits projects using a multi-field modal (including
all metadata fields from the PRD), and locks/unlocks projects.

**Why this priority**: Core screen — everything else (DWR, BOQ, P&L) is accessed through a
project. Depends on Clients (US1) existing.

**Independent Test**: Can be fully tested by creating a project (with a seeded client), viewing it
in the portfolio list with its status badge, opening the edit modal and changing the Contract Value,
and toggling `Is Locked` — confirming the locked badge appears on the list row.

**Acceptance Scenarios**:

1. **Given** the Portfolio page at `/dashboard/projects/portfolio`, **When** loaded, **Then** it
   shows a table with: Code, Project Name, Client, Location, Contract Value (₹), Status badge,
   Start Date, End Date, Actions (View/Edit/Delete); filterable by search, Status, and Client.
2. **Given** the Add/Edit Project modal, **When** opened, **Then** it shows all PRD fields grouped
   logically: Basic Info (Code, Name, Client, Location, Description), Contract (Value, Division,
   Project Type, Department Type, Order Number, Purchase Limit), Dates (Start, Expected End, Site/
   Toll/Plant Start Date), Assignment (Project Manager, CGST checkbox, HO checkbox, Site Type),
   Status and Lock controls.
3. **Given** the Client dropdown in the project modal, **When** opened, **Then** it is a
   searchable dropdown populated from the Clients master (US1).
4. **Given** the Project Manager dropdown, **When** opened, **Then** it shows employees from the
   HR module (searchable by name/code).
5. **Given** a project with `isLocked: true`, **When** displayed in the list, **Then** a lock
   icon/badge is shown on the row, and the Edit modal shows a locked warning banner.
6. **Given** the Status dropdown, **When** changed to Completed, **Then** the status badge
   updates to the correct colour (Planning: gray, Ongoing: green, On Hold: orange, Completed: blue).
7. **Given** a project, **When** the View action is clicked, **Then** the user is navigated to
   `/dashboard/projects/:id` — the tabbed project detail page (US4).

---

### User Story 4 - Project Detail Page (Priority: P1)

An admin views a project's tabbed detail page with all seven tabs: Overview, Employees, Machinery,
Materials/Inventory, Daily Work Reports, Bills & Expenses, Revenue, Costing, and P&L.

**Why this priority**: The central navigation hub for a project — all DWR, BOQ, revenue, and P&L
views are accessed here.

**Independent Test**: Can be fully tested by opening a project's detail page and confirming each
tab renders its section (even with empty data) with the correct columns, summary cards, and action
buttons — independent of data being populated.

**Acceptance Scenarios**:

1. **Given** a project detail page, **When** opened, **Then** the Overview tab shows a summary
   card: Project Code, Name, Client, Location, Contract Value (₹), Status, Start Date, Expected
   End Date, Project Manager, Division, and lock status.
2. **Given** the Employees tab, **When** selected, **Then** it lists employees assigned to this
   project (from HR, filtered by project), showing Code, Name, Designation, and Contact.
3. **Given** the Machinery tab, **When** selected, **Then** it lists equipment deployed at this
   project's sites (from Plant module, filtered by site).
4. **Given** the Materials/Inventory tab, **When** selected, **Then** it lists stock items at the
   project's store (from Inventory module).
5. **Given** the Daily Work Reports tab, **When** selected, **Then** it lists DWRs for this
   project with Date, Supervisor, Workers, Machinery count, Progress %, Weather, and Status — with
   an "Add DWR" button.
6. **Given** the Bills & Expenses tab, **When** selected, **Then** it shows sub-tabs for Bills,
   Expenses, and Work Orders, each with their respective columns and an "Add" action.
7. **Given** the Revenue tab, **When** selected, **Then** it shows revenue entries with
   Description, Amount, Date, Status columns plus an RA Bills section.
8. **Given** the Costing tab, **When** selected, **Then** it shows a cost breakdown table with
   Category, Budget, Actual, Variance (₹), and Variance % — variances over budget coloured red,
   under budget green.
9. **Given** the P&L tab, **When** selected, **Then** it shows summary cards (Contract Value,
   Revenue Booked, Total Expenses, Gross Profit, Margin %) and the full P&L statement with a
   period selector (Monthly/Quarterly/Yearly/Cumulative).

---

### User Story 5 - BOQ Management (Priority: P2)

An admin manages BOQ task groups and items from the project detail page, imports BOQ data from
Excel with live validation feedback, and views BOQ progress alerts (Today Task, Delayed, To Be
Delayed).

**Why this priority**: BOQ is the target-quantity backbone for DWRs; without it DWR entries have
no measurable context. Depends on Project Portfolio (US3/US4).

**Independent Test**: Can be fully tested by navigating to a project's BOQ section, creating a
task group, adding three items, uploading a five-row Excel file (one bad row) and confirming the
validation report shows the error with row number and column name and nothing is written yet,
then clicking Confirm Import and confirming the four valid rows now appear in the BOQ tree —
without needing DWR or P&L to exist.

**Acceptance Scenarios**:

1. **Given** the BOQ section of a project, **When** opened, **Then** it shows task groups
   collapsible into their items, with columns: BOQ No., Task Name, Unit, Scope Qty, Done Qty,
   Pending Qty, Per Day Qty, Avg Qty Per Day, Days to Complete.
2. **Given** the Add Task Group form, **When** submitted, **Then** the new group appears
   immediately in the BOQ tree.
3. **Given** the Import BOQ button, **When** an Excel file is uploaded, **Then** the backend
   validates it and returns a report (valid row count + any rejected rows with row number, column
   name, error reason, and a downloadable error report) without writing anything yet; **When** the
   admin reviews the report and clicks Confirm Import, **Then** the valid rows are committed and
   appear in the BOQ tree (matches the backend's two-step validate/confirm import, buildcore-api
   008-projects-backend research.md §12).
4. **Given** the BOQ Alert section, **When** viewed, **Then** it shows three tabs: Today Task
   (items with today as target date), Delayed (items past their Finish Date with pending qty),
   To Be Delayed (items at risk based on current Avg Qty Per Day vs required Per Day Qty).
5. **Given** a locked project, **When** the BOQ section is viewed, **Then** Add/Edit/Import
   controls are disabled with a "Project Locked" tooltip.

---

### User Story 6 - Daily Work Reports (DWR) (Priority: P2)

A site supervisor creates and submits DWRs with BOQ-linked task entries including the full
measurement formula UI (Nos × Nos × Length × Breadth × Depth × Density = Actual Qty); an admin
approves submitted DWRs from the DWR list.

**Why this priority**: The PRD's primary daily operational screen — core to the construction
workflow. Depends on BOQ (US5).

**Independent Test**: Can be fully tested by opening the DWR list (`/dashboard/projects/dwr`),
creating a DWR for a project with a task entry, entering measurement values and confirming the
computed Actual Qty is shown live in the form, submitting it, and confirming an admin can approve
it — independent of P&L or Revenue.

**Acceptance Scenarios**:

1. **Given** the DWR list at `/dashboard/projects/dwr`, **When** loaded, **Then** it shows: Date,
   Project, Supervisor, Workers (count), Machinery (count), Progress %, Weather, Status badge,
   Actions; filterable by Project, date range, and Status.
2. **Given** the Add DWR modal, **When** opened, **Then** it shows Project (dropdown), Work Date
   (default today), DPR Number (auto-generated, read-only), Supervisor (searchable employee
   dropdown), Weather, Contract For (radio: Self / Contract Number), and a Task entry section.
3. **Given** the Task entry section, **When** a Task Group and Task (BOQ item) are selected,
   **Then** the form shows the BOQ item's Unit, Total Qty, Completed Qty, Pending Qty, and Target
   Qty as read-only context fields.
4. **Given** the measurement formula row, **When** the user enters values for Nos × Nos × Length
   × Breadth × Depth × Density, **Then** the Actual Qty is computed and displayed live (client-side
   preview), with the server re-validating on submit.
5. **Given** a submitted DWR in the list, **When** an admin clicks Approve, **Then** a
   confirmation dialog is shown, and on confirm the DWR status updates to Approved in the list.
6. **Given** a locked project, **When** the Add DWR button is shown for that project, **Then** it
   is disabled with a "Project Locked" tooltip.
7. **Given** the DWR detail view, **When** opened, **Then** it shows all measurement fields,
   computed Actual Qty, BOQ item progress context, worker/machinery counts, attachments, and
   Engineer's name.

---

### User Story 7 - Revenue, RA Bills & Work Orders (Priority: P3)

An admin records revenue entries and manages RA bills through their Draft → Submitted → Approved
workflow from the project's Revenue tab; work orders are managed from the Bills & Expenses tab.

**Why this priority**: Required for a meaningful P&L; revenue recognition via RA Bill approval
drives the Revenue Booked figure. Depends on Project Detail (US4).

**Independent Test**: Can be fully tested by adding a revenue entry on the Revenue tab, creating
an RA bill, submitting and approving it, and confirming its amount appears in the P&L tab's
Revenue Booked card — without needing DWR/BOQ to be fully built.

**Acceptance Scenarios**:

1. **Given** the Revenue tab, **When** Add Revenue is clicked, **Then** a modal opens with
   Description, Amount (₹), Date, and Status (Received/Pending) fields.
2. **Given** the RA Bills section, **When** Add RA Bill is clicked, **Then** a form opens with
   bill number, description, amount, and billing date.
3. **Given** a Draft RA bill, **When** the Submit action is clicked, **Then** it transitions to
   Submitted with a status badge update.
4. **Given** a Submitted RA bill, **When** the Approve action is clicked, **Then** it transitions
   to Approved and the P&L tab's Revenue Booked card updates on next load.
5. **Given** a Submitted RA bill, **When** Reject is clicked, **Then** a remarks input is shown
   (required), and on confirm the bill reverts to Draft.
6. **Given** the Work Orders section in the Bills & Expenses tab, **When** Add Work Order is
   clicked, **Then** a tabbed modal opens with Work Detail, Terms & Conditions, Requirements, Hire
   Contract, Material, and Labour tabs.

---

### User Story 8 - Project P&L Dashboard (Priority: P3)

An admin views the live Project P&L with summary cards, a cost-breakdown-vs-budget table, a
P&L statement, and a period selector — with cost overrun categories highlighted in red.

**Why this priority**: The PRD's flagship visibility outcome; a read-only aggregation view. Depends
on Revenue (US7) and cross-module data being available.

**Independent Test**: Can be fully tested by opening the P&L tab on a project with seeded revenue
and cross-module cost data, changing the period selector between Monthly/Quarterly/Yearly/
Cumulative, and confirming cost overrun categories (Actual > Budget by >10%) are highlighted red.

**Acceptance Scenarios**:

1. **Given** the P&L tab on a project, **When** loaded, **Then** five summary cards are shown:
   Contract Value (₹, neutral), Revenue Booked (green), Total Expenses (red), Gross Profit
   (purple), Margin % (orange).
2. **Given** the Cost Breakdown table, **When** rendered, **Then** it shows rows for Labour,
   Materials, Machinery & Fuel, Subcontractors, and Overheads, each with Budget (₹), Actual (₹),
   Variance (₹), and Variance %; rows where Actual > Budget by >10% are highlighted in red.
3. **Given** the P&L statement section, **When** rendered, **Then** it shows the full equation:
   Revenue Booked − Labour − Materials − Machinery & Fuel − Subcontractors − Overheads = Gross
   Profit, with Margin % below.
4. **Given** the period selector, **When** a different period is selected (Monthly/Quarterly/
   Yearly/Cumulative), **Then** all P&L figures refresh to reflect only the selected time range.
5. **Given** a module with unavailable data (e.g., plant costs not yet set up), **When** P&L loads,
   **Then** the affected line shows ₹0 with a "data unavailable" indicator rather than an error.

---

### Edge Cases

- What happens when the Project Manager dropdown has no employees yet? → Shows an empty searchable
  dropdown with a "No employees found" state; project can be saved without a manager (field is
  optional).
- How does the BOQ measurement formula handle zero values? → Any zero value in the formula
  produces Actual Qty = 0; the field is highlighted with a warning but not blocked.
- What if the P&L tab is opened for a brand-new project with no data? → All summary cards show
  ₹0 / 0% and the cost breakdown shows ₹0 rows — no empty-state error, consistent with US8 SC5.
- What if an RA Bill is in Approved state and the user tries to edit it? → Edit is disabled (read-
  only display); only Draft bills are editable.
- How does the DWR list handle projects with hundreds of DWRs? → Server-side pagination with date
  range filter pre-applied (defaulting to the last 30 days).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All project routes MUST be nested under `/dashboard/projects/*` and protected by the
  existing JWT auth guard — consistent with how all prior features are nested under `/dashboard/`.
- **FR-002**: The Project Manager dropdown in the project modal MUST be a searchable employee
  picker reusing the pattern from HR's employee-picker (005 frontend).
- **FR-003**: The DWR measurement formula (Nos × Nos × Length × Breadth × Depth × Density) MUST
  compute Actual Qty live client-side as the user types, displayed as a read-only result field
  before submission.
- **FR-004**: BOQ Excel import MUST be a two-step validate-then-confirm flow, not a single blind
  commit: on upload, show upload progress and, on completion, display the validation report (valid
  row count, any per-row errors, and a "Download Error Report" link if any rows failed) without
  anything being written yet; a separate "Confirm Import" action then commits the valid rows
  (matches the backend's `/boq/import/validate` + `/boq/import/confirm` endpoints).
- **FR-005**: Locked project pages MUST display a persistent banner ("This project is locked —
  data entry is disabled") and disable all Add/Edit/Delete action buttons — the UI must not rely
  solely on backend `423` responses to communicate lock state.
- **FR-006**: The P&L period selector MUST be a controlled dropdown that triggers a fresh API call
  on change; the selected period MUST be reflected in the URL query parameter for shareability.
- **FR-007**: RA Bill state transitions (Submit, Approve, Reject) MUST show a confirmation dialog
  before calling the API, with Reject requiring a remarks input before enabling Confirm.
- **FR-008**: The BOQ Alert tabs (Today Task, Delayed, To Be Delayed) MUST refresh automatically
  when DWRs are approved and the BOQ quantities change.
- **FR-009**: DWR status badges MUST use consistent colours: Draft (gray), Submitted (orange),
  Approved (green) — matching the status badge convention from Settings and HR features.
- **FR-010**: The Project list Contract Value column MUST format amounts with Indian number
  formatting (₹ symbol, lakhs/crores grouping) — consistent with the rest of the financial module.
- **FR-011**: All modals and forms in this feature MUST preserve entered data across tab switches
  within the same modal — consistent with the multi-tab form pattern from Settings (002) and HR
  (005).
- **FR-012**: The site form's Latitude/Longitude fields MUST be validated client-side with clear
  error messages before submission.
- **FR-013**: `middleware.ts` MUST be extended with a route guard for `/dashboard/projects/*`,
  mapping sub-routes to `PROJECTS`/`DWR`/`PROJECT_FINANCIALS` permissions — this app's own
  constitution requires every new route prefix to be guarded (found missing during the master-PRD
  alignment audit; not present in the original scope).
- **FR-014**: Every list screen in this feature (Clients, Sites, Portfolio, BOQ tree, DWR list,
  Revenue/RA Bills, Work Orders) MUST use the existing `ResponsiveList` component and be fully
  keyboard-operable, per this app's NON-NEGOTIABLE mobile-first/keyboard-operable constitution
  principle — not just assumed via the general Assumptions note, but a first-class requirement
  every list task must build in from the start.

### Key Entities

- **Client**: Name, ContactPerson, Phone, Email, Address, GSTIN, Status.
- **Site**: Name, Project (linked), Location, Latitude/Longitude, Geofence Radius, Status.
- **Project**: Code, Name, Client, Location, Contract Value, Status (badge), Start/End dates,
  Project Manager, Division, Lock status.
- **BOQ Task Group / Item**: BOQ No., Task Name, Unit, Scope/Done/Pending Qty, Per Day Qty,
  Days to Complete.
- **DWR**: Date, Project, Supervisor, Workers, Machinery, Progress %, Weather, Status badge,
  Task entries with measurement formula.
- **Revenue / RA Bill**: Amount, Date, Status (with workflow actions).
- **P&L**: Summary cards, Cost Breakdown table, P&L statement, Period selector.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A site supervisor can create and submit a DWR (including selecting a BOQ task and
  entering measurement values) in under 3 minutes.
- **SC-002**: A project manager can read the current P&L for any active project in under 5
  seconds from page load (covers API + render time at expected data scale).
- **SC-003**: BOQ import feedback — the user sees the import result (success count + downloadable
  error report if any) within 10 seconds for a 100-row Excel file.
- **SC-004**: All status badges (Project status, DWR status, RA Bill status) use consistent colours
  and labels across every screen in this feature.
- **SC-005**: The DWR measurement formula live-compute is instantaneous (no perceptible delay) as
  the user types individual measurement values.
- **SC-006**: Locked projects are visually distinguishable from unlocked projects in the Portfolio
  list without requiring the user to open the edit modal.
- **SC-007**: Every list screen in this feature is usable at a mobile viewport (card layout, no
  horizontal scroll) and every interactive control is reachable and operable by keyboard alone.

## Assumptions

- The `/dashboard/` shell layout and nav-links.tsx already exist (from 001–005); this feature adds
  a "Projects" nav group with sub-items: Portfolio, DWR, P&L, Clients, Sites.
- The API contract in `buildcore-api/specs/008-projects-backend/contracts/projects-api.md` is the
  authoritative source of truth for endpoint shapes; any discrepancy between this spec and that
  contract resolves in favour of the contract.
- The Indian number formatting utility (₹ with lakhs/crores grouping) already exists in
  `app/lib/utils.ts` or a shared formatter — if not, it is built as part of this feature in that
  file.
- The existing `ResponsiveList` component (Settings, 002) handles the table/pagination/search
  pattern; this feature reuses it rather than implementing a custom list.
- No map/geo-visualisation of site coordinates is required in this version — lat/lng are displayed
  as numeric values only.
- The `exceljs` library (pre-approved in the constitution, first used by Dashboard) is available
  for parsing uploaded BOQ Excel files client-side or is handled server-side (the backend contract
  determines this).
- Mobile responsiveness follows the existing app's breakpoint conventions; no native mobile
  features (camera, GPS capture) are required for this feature's screens.

---

## Amendment 2026-09-01 — Project Planning and Target-vs-Actual Screens

**Reason**: A gap audit against the module/submodule matrix found two uncovered items. Row 25
("Projects Portfolio: ... **Project Planning** ...") names a planning surface this spec lacks — a
project has dates and a BOQ but no phases, activities, milestones, or baseline, so nothing shows
whether it is running late. Row 26 ("Daily Progress Report: ... **Monthly Report Chart and Target
report**") names a comparison that cannot be drawn because nothing records what was *planned* for a
period. Everything above is unchanged.

### User Story 9 - Project schedule: phases, activities and baseline (Priority: P2)

A planning engineer builds a project schedule of phases and activities with dependencies and
milestones, then baselines it.

**Why this priority**: The plan is the reference every comparison needs. Depends on the project and
BOQ.

**Independent Test**: Build a two-phase schedule with four activities and one milestone, baseline it,
and confirm the computed project finish matches the latest activity finish.

**Acceptance Scenarios**:

1. **Given** `/dashboard/projects/[id]/schedule`, **When** loaded, **Then** phases and their activities
   are shown as an ordered outline with planned start, planned finish, weightage, percent complete, and
   a milestone marker.
2. **Given** the Add Activity form, **When** submitted, **Then** it collects Name, Planned Start,
   Planned Finish, optional BOQ Item, optional Planned Quantity, Weightage %, and Responsible person;
   a finish before start shows a field-level error.
3. **Given** activity weightages not summing to 100, **When** the schedule is viewed, **Then** the
   running total is displayed prominently with the shortfall or excess named.
4. **Given** the Baseline action, **When** weightages do not sum to 100, **Then** it is disabled with a
   tooltip naming the actual sum.
5. **Given** the Add Dependency control, **When** a dependency would create a cycle, **Then** the `400`
   is surfaced naming the cycle path.
6. **Given** an activity starting before a finish-to-start predecessor ends, **When** saved, **Then** a
   non-blocking dependency-violation marker appears — the plan still saves.
7. **Given** a baselined schedule, **When** planned dates are later edited, **Then** both baseline and
   current dates are shown side by side with the variance.
8. **Given** a locked project, **When** any schedule edit is attempted, **Then** controls are read-only
   with the existing lock explanation.
9. **Given** an activity with recorded actuals, **When** Delete is attempted, **Then** the `409` is
   surfaced and a Cancel action is offered instead.

---

### User Story 10 - Targets and target-vs-actual reporting (Priority: P2)

A project manager sets periodic quantity targets and sees them against actuals from approved DWRs, with
the monthly chart the matrix names.

**Why this priority**: The direct answer to the matrix's target report. Depends on US9 and the existing
DWR flow.

**Independent Test**: Set a monthly target of 500 cum, record DWRs totalling 400, and confirm 80%
achievement with a 100 cum shortfall.

**Acceptance Scenarios**:

1. **Given** the Targets screen, **When** a set is added, **Then** it collects Period Type
   (Weekly/Monthly), Period From/To, and lines targeting an activity or BOQ item with a quantity.
2. **Given** an overlapping target set, **When** submitted, **Then** the `409` names the existing set.
3. **Given** the Target vs Actual report, **When** a period is chosen, **Then** each line shows target,
   actual, achievement percentage, and variance, with a weightage-weighted project rollup.
4. **Given** a period with no target set, **When** viewed, **Then** actuals are shown with the target
   marked "not set" — never as zero, and no achievement percentage is computed.
5. **Given** the Monthly Report, **When** a month is chosen, **Then** opening and closing cumulative
   progress, quantity achieved, target, achievement percentage, man-days, equipment hours, and material
   consumed are shown.
6. **Given** the Progress Trend chart, **When** a range is chosen, **Then** planned and actual
   cumulative progress are plotted per period — the matrix's "Monthly Report Chart".
7. **Given** any chart, **When** rendered on mobile, **Then** it stays legible and scrolls within its
   own container without the page scrolling horizontally.
8. **Given** any of these reports, **When** exported, **Then** the established export handling applies.

---

### User Story 11 - Schedule variance and delay analysis (Priority: P3)

A manager sees which activities are behind, by how many days, and which are critical.

**Why this priority**: Derivative of US9 and US10.

**Independent Test**: With one activity trailing its baseline, confirm it is flagged behind schedule
with the correct slippage.

**Acceptance Scenarios**:

1. **Given** the Schedule Variance view, **When** loaded, **Then** each activity shows baseline dates,
   current planned dates, actual start/finish, percent complete, and a status
   (Not Started / On Track / Behind Schedule / Completed).
2. **Given** an activity trailing its time-elapsed percentage beyond tolerance, **When** rendered,
   **Then** it is flagged behind schedule with slippage in days.
3. **Given** the project, **When** the view loads, **Then** overall planned progress, actual progress,
   and schedule variance percentage are shown.
4. **Given** activities on the longest dependency chain, **When** rendered, **Then** they are marked
   critical and a delay on one is shown as affecting the project finish.
5. **Given** a project with no baseline, **When** the view is requested, **Then** an explanatory state
   is shown rather than a comparison against blank values.
6. **Given** an activity whose percent complete came from a manual value rather than quantity, **When**
   rendered, **Then** the source is marked so the two are not conflated.

### Additional Edge Cases

- A BOQ quantity is revised after targets referencing it were set → both original and revised are shown
  so the revision is visible.
- The project is locked mid-period → schedule and target edits go read-only while reports stay readable.
- Weightages are edited after baselining → both baseline and current sums are shown so the comparison
  basis is explicit.

### Additional Functional Requirements

- **FR-015**: All schedule and target screens MUST live under `/dashboard/projects/[id]/*` and reuse the
  existing `PROJECTS` and `REPORTS` permission guards — no new permission is introduced.
- **FR-016**: The existing project-lock treatment MUST extend to every schedule and target control,
  rendering them read-only rather than failing on save.
- **FR-017**: The schedule MUST display a running weightage total, and the Baseline action MUST be
  disabled with the actual sum named while it is not 100 — pre-empting the backend rejection.
- **FR-018**: A dependency cycle MUST be surfaced with the cycle path named; a dependency violation in
  planned dates MUST render as a non-blocking marker that still allows saving.
- **FR-019**: A baselined schedule MUST show baseline and current dates side by side with the variance;
  baseline values MUST never be presented as editable.
- **FR-020**: A period with no target set MUST show the target as "not set" and compute no achievement
  percentage — never display it as zero.
- **FR-021**: Percent complete MUST indicate whether it derived from recorded quantity or a manual
  value, so the two are never conflated.
- **FR-022**: The variance view MUST show an explanatory state when no baseline exists, rather than
  comparing against blank values.
- **FR-023**: Charts MUST remain legible on mobile and scroll within their own container; any
  runtime-computed bar dimension MUST be isolated to a single named line, the one permitted numeric
  exception to Principle II.
- **FR-024**: All new API calls MUST go through the existing typed projects API module with `zod`
  validation at the boundary (Principles IV, V), and all labels and status colour mappings MUST come
  from a constants module (Principle III).

### Additional Success Criteria

- **SC-A01**: Target-vs-actual figures on screen always reconcile with the approved DWR measurements
  for the period.
- **SC-A02**: A baselined schedule's baseline values are never editable from the UI.
- **SC-A03**: No dependency cycle can be created from the UI.
