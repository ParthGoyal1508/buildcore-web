# Feature Specification: Project Assets Frontend (Register, Allocation, Custody, Requests, Transfers, Reminders)

**Feature Branch**: `012-project-assets`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Project Assets module for the BuildCore ERP frontend (buildcore-web),
closing the gap identified by the module/submodule matrix row 36 ('Project Assets: Project Assets,
New Assets, Summary, Request, Stock, Reminders') under Store & Inventory. 009-inventory covers
consumable materials only and has no screen for a durable, individually-identified, returnable asset
that is allocated to a project or a person and comes back. Nested under /dashboard/assets/*.
Consumes the backend contract in buildcore-api/specs/012-project-assets-backend/. Reuses:
formatCurrency, StatusBadge, ResponsiveList, the multi-tab Masters modal pattern (Settings/002,
Inventory/009), and the document-upload pattern from 006-plant-machinery."

**Scope note**: the boundary the user sees — consumables live under Inventory (009), heavy machinery
with logbooks under Plant (006), durable returnable assets here. The three navigation entries are
deliberately distinct so a user never has to guess which module holds an item.

## Clarifications

### Session 2026-09-01

- Q: Do serialised and bulk assets share one list screen? → A: Yes, one Stock screen with a tracking
  mode indicator per row. Serialised assets render as individual rows with custodian and status;
  bulk assets render as one aggregated row per site with quantity columns. A mode filter separates
  them when needed. Two screens would split "where is my stuff" into two questions.
- Q: How is the two-step transfer surfaced? → A: A Transfers screen with three tabs — In Transit,
  Received, and Cancelled — where In Transit is the actionable one. The receiving site sees an
  "Acknowledge Receipt" action; the dispatching site sees a read-only awaiting state. This makes the
  in-transit gap visible rather than hiding it inside the asset row.
- Q: Where do reminders appear? → A: Both places. A dedicated Reminders screen under Assets for the
  full filterable list, and the same reminders surfaced in the global Reminders centre built by the
  004 amendment. The Assets screen is a pre-filtered view of the same data, not a second source.
- Q: Is depreciation shown to end users? → A: Only as "current book value" on the asset detail and in
  the Summary rollups. No depreciation schedule table and no accounting language — the backend states
  these are costing figures, not accounting postings, and the UI must not imply otherwise.
- Q: How does custody appear for an employee? → A: On the asset row and detail, plus an "Assets in
  custody" panel reachable from the employee record in 005, so the exit flow can see what must be
  recovered before settlement.

### Session 2026-09-01 (ratification — frontend gap-closure clarify pass)

- Q: How much backend validation should the client duplicate? → A: Only deterministic rules.
  Available-quantity hints are read live from the stock API rather than computed from a cache, and
  the authoritative check remains server-side at submit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asset Masters (Priority: P1)

An admin configures asset categories with their tracking mode, depreciation rate, custody and
inspection policy, plus asset document types and condition grades, from a Masters modal.

**Why this priority**: No asset can be registered without a category, and the tracking mode
determines every downstream screen behaviour. No dependencies.

**Independent Test**: Open the Masters modal, create a serialised "Power Tools" category with custody
required, create a bulk "Scaffolding" category, confirm the New Asset form changes its fields
depending on which is selected — without registering an asset.

**Acceptance Scenarios**:

1. **Given** the Masters modal from the Assets Stock page header, **When** opened, **Then** it shows
   three tabs: Categories, Document Types, and Condition Grades, following the established multi-tab
   modal pattern.
2. **Given** the Add Category form, **When** filled, **Then** it collects Name, Tracking Mode
   (serialised/bulk), Depreciation Rate %, Useful Life Years, Custody Required, Inspection Required,
   and — only when inspection is required — Inspection Interval Days.
3. **Given** Inspection Required is checked with no interval, **When** Save is attempted, **Then** a
   field-level error appears and no request is sent.
4. **Given** a category with existing assets, **When** its Tracking Mode is edited, **Then** the
   control is read-only with a tooltip explaining it is immutable once assets exist.
5. **Given** a category with linked assets, **When** Delete is clicked, **Then** the `409` is
   surfaced as a toast naming the asset count.
6. **Given** the Condition Grades tab, **When** a grade is added, **Then** its Damaged and Scrap flags
   are collected, with helper text explaining these drive the asset's status on return.
7. **Given** the Categories tab, **When** listed, **Then** each row shows asset count and total book
   value via `formatCurrency`.

---

### User Story 2 - New Assets and Asset Register (Priority: P1)

A store admin registers assets and browses the register with filters, seeing each asset's location,
custodian, status, condition, and current book value.

**Why this priority**: The core record. Everything else references an asset. Depends on US1.

**Independent Test**: Register a serialised power tool, confirm a generated asset code appears and
status shows Idle with book value equal to purchase cost on the capitalisation date — without
allocating it.

**Acceptance Scenarios**:

1. **Given** the New Asset modal, **When** a serialised category is chosen, **Then** the form shows
   Serial Number and hides Quantity; choosing a bulk category shows Quantity and Unit and hides
   Serial Number.
2. **Given** the New Asset form, **When** submitted, **Then** it collects Category, Name,
   Manufacturer, Model, Purchase Date, Purchase Cost, Capitalisation Date, Salvage Value, Site, and
   optional Vendor and linked Purchase.
3. **Given** a Capitalisation Date earlier than the Purchase Date, **When** Save is attempted,
   **Then** a field-level error appears before any request is sent.
4. **Given** a duplicate serial number, **When** submitted, **Then** the `409` is surfaced inline on
   the Serial Number field with a link to the existing asset.
5. **Given** `/dashboard/assets/register`, **When** loaded, **Then** rows show Asset Code, Name,
   Category, Site, Custodian, Status badge, Condition, and Book Value, filterable by category, site,
   status, and free-text search.
6. **Given** the asset detail, **When** opened, **Then** it shows identification, acquisition,
   current location and custody, condition, book value, and tabs for Documents, Allocations,
   Transfers, Inspections, and Repairs.
7. **Given** the Documents tab, **When** a document is uploaded, **Then** type, optional expiry, and
   file are collected and accepted types are restricted via the `accept` attribute.
8. **Given** an asset with an expiring document, **When** the register renders, **Then** the row
   carries an expiry marker visible without opening the detail.
9. **Given** an asset registered against a purchase, **When** the detail is viewed, **Then** the
   linked purchase is shown as a navigable reference to the Inventory module.

---

### User Story 3 - Stock and Summary (Priority: P1)

A store manager sees what is where — serialised assets individually, bulk assets aggregated per site
— and a summary rolling up counts and book value by category, project, or status.

**Why this priority**: The matrix names both "Stock" and "Summary"; these are the module's primary
daily views. Depends on US2.

**Independent Test**: With assets across two sites in mixed statuses, open the Stock screen filtered
by site and confirm the counts match, then open Summary and confirm category totals reconcile.

**Acceptance Scenarios**:

1. **Given** `/dashboard/assets/stock`, **When** loaded, **Then** serialised assets appear as
   individual rows with custodian and status, and bulk assets appear as one row per site with On
   Hand, Allocated, and In Transit quantity columns.
2. **Given** the Stock screen, **When** a tracking-mode filter is applied, **Then** the list narrows
   to serialised or bulk only.
3. **Given** `/dashboard/assets/summary`, **When** a grouping (category / project / status) is
   chosen, **Then** counts, original cost, accumulated depreciation, and current book value are shown
   per group with a company total, all monetary values via `formatCurrency`.
4. **Given** the Summary grouped by project, **When** a project is selected, **Then** the assets
   currently allocated to that project's sites are rolled up — the matrix's "Project Assets" view.
5. **Given** scrapped assets exist, **When** Summary is viewed, **Then** they appear in a separate
   Scrapped bucket, excluded from active counts and book value.
6. **Given** the book value column, **When** rendered, **Then** no depreciation schedule or accounting
   terminology is shown — book value only, consistent with the backend's costing-not-accounting
   position.
7. **Given** the Stock screen, **When** Export is clicked, **Then** the export follows the same
   synchronous-download / async-job handling established by the Dashboard feature.
8. **Given** either screen on a mobile viewport, **When** rendered, **Then** the wide table scrolls
   within its own container without the page scrolling horizontally.

---

### User Story 4 - Allocation and Custody (Priority: P1)

An asset is allocated from the idle pool to a project site for a period and, where the category
requires it, assigned to a custodian. Returns record the condition.

**Why this priority**: Allocation is what makes the register operationally useful. Depends on US2.

**Independent Test**: Allocate an idle power tool to a project site with an expected return date and
a custodian, confirm the status becomes Allocated and it appears in that project's asset list —
without returning it.

**Acceptance Scenarios**:

1. **Given** the Allocate modal for an idle asset, **When** opened, **Then** it collects Project,
   Site, Allocated From, Expected Return Date, and — when the category requires custody — Custodian.
2. **Given** a category requiring custody, **When** Allocate is submitted without a custodian,
   **Then** a field-level error appears before any request is sent.
3. **Given** a custodian whose active site differs from the allocation site, **When** submitted,
   **Then** the `400` is surfaced inline on the Custodian field explaining the site mismatch.
4. **Given** a bulk asset, **When** an allocation quantity exceeds available stock at the source site,
   **Then** the available quantity is shown as a live hint and Save is disabled — read from the stock
   API, matching how 009 shows available-stock hints.
5. **Given** an already-allocated serialised asset, **When** Allocate is attempted, **Then** the
   action is disabled with a tooltip naming the existing allocation.
6. **Given** the Return modal, **When** submitted, **Then** it collects Actual Return Date, Condition
   on Return, and optional remarks.
7. **Given** a return recorded in a damaged or scrap condition grade, **When** saved, **Then** the
   resulting status (Under Repair or Scrapped) is shown in the confirmation, so the consequence is
   not a surprise.
8. **Given** an allocation past its expected return date, **When** listed, **Then** it carries an
   overdue marker with the day count.
9. **Given** an employee record in 005, **When** their "Assets in custody" panel is opened, **Then**
   every asset still in their custody is listed — the view the exit flow needs before settlement.

---

### User Story 5 - Asset Requests (Priority: P2)

A site supervisor raises a request for an asset, it is approved, and it is fulfilled from the idle
pool or marked as needing procurement.

**Why this priority**: The matrix names "Request". It sits on top of allocation. Depends on US4.

**Independent Test**: Raise a request for one power tool, approve it, fulfil it against an idle asset,
and confirm the resulting allocation exists and the request shows Fulfilled.

**Acceptance Scenarios**:

1. **Given** the New Request modal, **When** opened, **Then** it collects Category, optional specific
   Asset, Quantity, Project, Site, Required By Date, and Justification.
2. **Given** `/dashboard/assets/requests`, **When** loaded, **Then** requests are listed with request
   number, category, quantity, project/site, required-by date, age in days, requester, and a status
   badge.
3. **Given** a caller without the approve permission, **When** viewing a pending request, **Then**
   the Approve action is not rendered.
4. **Given** the Reject action, **When** attempted with an empty reason, **Then** Reject stays
   disabled.
5. **Given** an approved request, **When** Fulfil is opened, **Then** only assets with Idle status
   appear in the asset picker.
6. **Given** an approved request with no idle asset available, **When** "Mark procurement needed" is
   clicked, **Then** the status changes and the request appears in the procurement-needed view with a
   link to the Inventory purchase flow — this module never creates a purchase itself.
7. **Given** a request past its required-by date, **When** listed, **Then** it carries an overdue
   marker.

---

### User Story 6 - Transfers with Dispatch and Receipt (Priority: P2)

An asset moves between sites through a two-step transfer: the source dispatches, the destination
acknowledges receipt, and the asset is visibly In Transit in between.

**Why this priority**: The two-step acknowledgement is what prevents assets going missing between
sites. Depends on US4.

**Independent Test**: Dispatch an idle asset from site A to site B, confirm it shows In Transit and is
absent from both sites' available lists, then acknowledge receipt at B and confirm it becomes
available there.

**Acceptance Scenarios**:

1. **Given** `/dashboard/assets/transfers`, **When** loaded, **Then** three tabs are shown — In
   Transit, Received, Cancelled — with In Transit first and carrying a count badge.
2. **Given** the Dispatch modal, **When** opened, **Then** it collects To Site, Dispatch Date,
   Transport Mode, optional Vehicle Number, and Dispatch Condition.
3. **Given** an allocated asset, **When** Dispatch is attempted, **Then** the action is disabled with
   a tooltip explaining it must be returned from its allocation first.
4. **Given** an in-transit transfer viewed from the destination site, **When** rendered, **Then** an
   "Acknowledge Receipt" action is shown; viewed from the source site it shows a read-only awaiting
   state.
5. **Given** the Receipt modal, **When** submitted, **Then** it collects Received Date, Condition on
   Receipt, and — for bulk — Received Quantity.
6. **Given** a bulk receipt for less than the dispatched quantity, **When** submitted, **Then** the
   shortfall is shown in the confirmation and the transfer closes with a visible shortage marker,
   never silently balancing.
7. **Given** a receipt condition worse than dispatch, **When** saved, **Then** a discrepancy marker
   appears on the transfer row.
8. **Given** an in-transit transfer older than the configured threshold, **When** listed, **Then** it
   carries a transit-overdue marker.
9. **Given** a caller without the approve permission, **When** viewing an in-transit transfer,
   **Then** the Cancel action is not rendered.

---

### User Story 7 - Inspection, Repair and Condemnation (Priority: P2)

Assets in inspection-required categories show their next inspection due date; inspections record
condition and outcome, and repairs track cost and downtime.

**Why this priority**: Condition tracking keeps the register trustworthy and feeds the inspection-due
reminders. Depends on US2.

**Independent Test**: Record an inspection for an asset, confirm the next due date advances by the
category interval, then record a repair and confirm the asset shows Under Repair until closed.

**Acceptance Scenarios**:

1. **Given** the Record Inspection modal, **When** submitted, **Then** it collects Inspection Date,
   Condition Grade, Outcome (pass / repair required / condemn), and Remarks.
2. **Given** an inspection outcome of Condemn, **When** submitted by a caller without the approve
   permission, **Then** that outcome option is not offered.
3. **Given** an outcome of Condemn on an allocated asset, **When** attempted, **Then** the `409` is
   surfaced explaining the asset must be returned from its allocation first.
4. **Given** a completed inspection, **When** the asset detail refreshes, **Then** the next
   inspection due date is shown, advanced from the inspection date.
5. **Given** the Record Repair modal, **When** submitted, **Then** it collects Repair Date,
   Description, Cost, optional Vendor, and Expected Completion.
6. **Given** an open repair, **When** Close is submitted, **Then** Actual Completion and resulting
   Condition Grade are collected and computed downtime days are displayed.
7. **Given** an asset whose cumulative repair cost exceeds the configured threshold, **When** the
   detail is viewed, **Then** a distinct warning marker is shown with the total.

---

### User Story 8 - Asset Reminders (Priority: P2)

Document expiry, inspections coming due, and overdue returns appear as a filterable reminders list
under Assets, and the same items appear in the global Reminders centre.

**Why this priority**: The matrix names "Reminders" for assets. Depends on documents, inspections,
and allocations existing.

**Independent Test**: Register an asset with a document expiring in 5 days against a 15-day alert
window, open the Assets Reminders screen, and confirm it appears with the correct type and days
remaining.

**Acceptance Scenarios**:

1. **Given** `/dashboard/assets/reminders`, **When** loaded, **Then** reminders are listed with type,
   asset, subject, due date, days remaining (negative when overdue), and a severity indicator.
2. **Given** the reminders list, **When** rendered, **Then** overdue items sort first, then soonest
   due.
3. **Given** filters (type, site, severity), **When** applied, **Then** the list narrows without a
   full-page reload.
4. **Given** the global Reminders centre built by the 004 amendment, **When** opened, **Then** these
   same asset reminders appear there — this screen is a pre-filtered view of the same data, not a
   second source.
5. **Given** a reminder, **When** Snooze is used, **Then** a snooze-until date and reason are
   collected and the item disappears from the list until that date.
6. **Given** a scrapped asset with an expired document, **When** the list renders, **Then** it does
   not appear.
7. **Given** no reminders exist, **When** the screen loads, **Then** a distinct empty state is shown
   — not an error.

---

### Edge Cases

- An asset's category is changed to another of the same tracking mode → permitted for approve-permission
  holders only; the action is hidden otherwise, and a confirmation explains the effect on reporting.
- A bulk asset row shows quantity while a transfer is mid-flight → On Hand, Allocated, and In Transit
  are shown as separate columns so the numbers visibly reconcile rather than appearing to lose stock.
- The API returns a status the client does not recognise → the row renders the raw status label with
  a neutral badge rather than crashing or hiding the asset.
- A custodian is deactivated in HR while holding assets → the asset row shows the custodian name with
  an inactive marker and surfaces the recovery action.
- Two users acknowledge the same in-transit transfer → the second gets a `409` and the tab refreshes
  to show it as already received, with no duplicate stock movement implied in the UI.
- A repair vendor is deactivated in Partners → the repair row still resolves the vendor name with an
  inactive marker.
- An asset document is uploaded with a past expiry date → accepted, and it immediately appears in the
  reminders list as expired.
- The Summary is opened for a company with no assets → an empty state with a "Register your first
  asset" affordance, not a zero-filled table.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All routes MUST be under `/dashboard/assets/*` and protected by JWT auth.
- **FR-002**: `middleware.ts` MUST guard `/dashboard/assets/*` with the `ASSETS` permission, and
  report routes additionally with `REPORTS`.
- **FR-003**: Actions requiring `ASSETS_APPROVE` (approve/reject requests, condemn, cancel a transfer,
  change an asset's category) MUST NOT be rendered for callers lacking that permission — hiding, not
  merely disabling.
- **FR-004**: All API calls MUST go through a typed `app/lib/api/assets.ts` module; no component may
  issue a raw `fetch()` (Principle V).
- **FR-005**: Every API response MUST be validated with a `zod` schema at the boundary and the
  inferred type used downstream (Principle IV).
- **FR-006**: The New Asset form MUST switch its fields on the selected category's tracking mode —
  Serial Number for serialised, Quantity and Unit for bulk — never showing both.
- **FR-007**: The Stock screen MUST render serialised assets as individual rows and bulk assets as one
  aggregated row per site with On Hand, Allocated, and In Transit as separate columns, so quantities
  visibly reconcile during a transfer.
- **FR-008**: Available-quantity hints in allocation and transfer forms MUST be read from the stock
  API and MUST disable Save when the requested quantity exceeds availability — matching how 009
  FR-003 surfaces stock hints.
- **FR-009**: The Transfers screen MUST present In Transit, Received, and Cancelled tabs, with the
  Acknowledge Receipt action rendered only for the destination site and a read-only awaiting state
  for the source.
- **FR-010**: A partial bulk receipt MUST show the shortfall in the confirmation and mark the closed
  transfer with a visible shortage indicator — never silently balancing the difference.
- **FR-011**: Book value MUST be displayed without any depreciation schedule or accounting
  terminology, consistent with the backend's position that these are costing figures, not postings.
- **FR-012**: A return recorded in a damaged or scrap condition grade MUST show the resulting asset
  status in the confirmation before it is applied.
- **FR-013**: Asset reminders MUST be rendered from the same source the global Reminders centre uses;
  this module's screen is a pre-filtered view, never a second evaluation.
- **FR-014**: A `409` or `400` from any endpoint MUST be surfaced as a specific, actionable message —
  inline on the offending field where one exists, otherwise as a toast.
- **FR-015**: All monetary values (purchase cost, book value, repair cost, stock value) MUST use
  `formatCurrency` from `app/lib/utils.ts`.
- **FR-016**: All status and condition indicators MUST use the shared `StatusBadge` component with a
  documented colour mapping, never ad-hoc styling.
- **FR-017**: Every list screen MUST use the existing `ResponsiveList` component so it degrades to a
  card layout on mobile (Principle VI).
- **FR-018**: Every route, label, status name, and colour mapping MUST come from a constants module,
  never inline literals (Principle III).
- **FR-019**: Components MUST default to Server Components with `"use client"` pushed as far down as
  possible — the modals, filters, and tab controls are the expected client boundaries (Principle I).
- **FR-020**: Data shaping and API calls MUST live in `app/lib/`, not inline in component bodies
  (Principle I).
- **FR-021**: No component may use the inline `style={}` prop; conditional classes MUST use `clsx`
  (Principle II).
- **FR-022**: Document uploads MUST restrict accepted types via the `accept` attribute and show upload
  progress; a failed upload MUST NOT roll back the parent asset record.
- **FR-023**: Stock and Summary exports MUST reuse the synchronous-download / async-job handling
  already established by the Dashboard feature, including a distinguishable failure state.
- **FR-024**: Every screen MUST remain usable at 320–428px without horizontal page scrolling; wide
  tables MUST scroll within their own container (Principle VI).
- **FR-025**: All interactive elements MUST meet the 44×44px minimum touch target and no action may be
  hover-gated (Principle VI).
- **FR-026**: An unrecognised status, condition, or reminder type from the API MUST render with a
  neutral badge and the raw label rather than crashing or hiding the record.
- **FR-027**: Every list screen MUST show distinct loading (skeleton), empty, and error states, with
  retry on error — reusing the existing `skeletons.tsx` patterns.
- **FR-028**: An "Assets in custody" panel MUST be exposed for an employee, reachable from the
  employee record in 005, listing every asset still in that employee's custody.

### Key Entities *(client-side view models)*

- **AssetRow**: code, name, category, tracking mode, site, custodian, status, condition, book value,
  expiry marker.
- **BulkStockRow**: asset, site, on-hand / allocated / in-transit quantities, unit, stock value.
- **AllocationForm**: project, site, custodian, dates, quantity with live availability hint.
- **TransferCard**: asset, from/to site, dispatch and receipt details, condition discrepancy,
  shortage, transit-overdue marker.
- **RequestRow**: request number, category, quantity, project/site, required-by, age, status.
- **InspectionForm / RepairForm**: dates, condition grade, outcome, cost, computed downtime.
- **AssetReminder**: type, asset, subject, due date, signed days remaining, severity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can answer "where is this asset and who has it" in one screen without opening a
  detail view.
- **SC-002**: Quantities visibly reconcile during a transfer — on hand plus allocated plus in transit
  always equals the registered total on screen.
- **SC-003**: No allocation or transfer can be submitted from the UI for a quantity exceeding
  availability, verified by a test asserting Save stays disabled.
- **SC-004**: Every screen renders without horizontal page scroll at 320px width.
- **SC-005**: Asset reminders shown here match the global Reminders centre exactly, verified by
  comparing both surfaces against the same dataset.
- **SC-006**: Every backend conflict case in this module maps to a specific, actionable message.
- **SC-007**: An employee's exit surfaces every asset still in their custody before settlement.

## Assumptions

- The backend feature `012-project-assets-backend` is built first; this feature consumes its contract
  and adds no business logic beyond client-side pre-emption of known rejections (FR-008).
- Barcode or QR scanning for asset identification is out of scope; assets are found by code or search.
- The "Assets in custody" panel (FR-028) is rendered by this feature but mounted into 005's employee
  screen, so 005's amendment must expose the mount point.
- Global navigation gains a distinct Assets entry, separate from Inventory and Plant, so the user is
  never left guessing which module holds an item.
- The linked-purchase reference depends on 009 being built; until then the link renders as a plain
  reference without navigation.

## Amendment 2026-09-02 — Desktop-First Responsiveness (constitution v2.0.0)

Constitution Principle VI was redefined from blanket mobile-first to **desktop-first with a closed
list of mobile-critical surfaces** (punch in/out, attendance including supervisor muster, leave,
and sign-in). Project Assets is a **desktop surface**: the asset register, allocations, custody and transfer approvals are administrative.

**What changes for this feature:**

- Screens are designed at **desktop width first**. Base Tailwind classes target the desktop layout;
  smaller-viewport variants exist to keep the screen unbroken, not to produce a phone-optimised one.
- Every screen MUST still remain **usable and unbroken down to 768px** (tablet): nothing clipped, no
  control unreachable, and the page body MUST NOT scroll horizontally. Wide content — tables,
  boards, wide forms — scrolls inside its own `overflow-x: auto` container.
- The `ResponsiveList` card-layout fallback is now **OPTIONAL**, not mandatory. Use it where the data
  genuinely reads better as cards; for a dense back-office grid, a horizontally-scrolling table in
  its own container is an acceptable and often better answer. Any earlier requirement in this spec
  that mandates `ResponsiveList` on *every* list is relaxed to this standard.
- **Keyboard operability is unchanged and still applies everywhere** — every interactive control on
  every screen MUST be reachable and operable by keyboard. Nothing in this amendment relaxes that.
- 44×44px touch targets and the "no hover-gated action" rule are no longer mandatory on this
  feature's screens, but remain good practice; hover MUST still not be the *only* way to discover a
  control's existence.

**Review gate:** these screens are verified at desktop, then re-checked at 768px for breakage only.
