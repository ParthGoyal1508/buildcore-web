# Feature Specification: Partners Frontend (Vendors, Contractor Vault, Compliance, RAG Matrix, BOCW Cess)

**Feature Branch**: `007-partners`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Partners Module (Vendors, Vendor Categories, Contractor Vault,
Monthly Compliance, RAG Matrix, BOCW Cess) for the BuildCore ERP frontend (buildcore-web), per
the PRD at /Users/p0g02o7/Personal/ERP-Demo/docs/prd/06-partners.prd.md. Nested under
/dashboard/partners/*. Consumes the backend contract in
buildcore-api/specs/007-partners-backend/contracts/partners-api.md. Reuses this app's established
patterns: ResponsiveList (Settings), multi-tab modal (Settings Company), status badges (Projects),
and Indian currency formatting (Projects)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Vendor Categories (Priority: P1)

An admin views, creates, edits, and deletes vendor category tags from a simple table.

**Why this priority**: Required before any vendor can be created with category tags. No dependencies.

**Independent Test**: Open `/dashboard/partners/vendors/categories`, create a category, edit it,
delete it (if no linked vendors), confirm `409` message when deleting a linked one.

**Acceptance Scenarios**:

1. **Given** the Vendor Categories page, **When** loaded, **Then** it shows a table with: #,
   Category Name, Description, Vendors (count), Actions (Edit/Delete).
2. **Given** the Add/Edit Category modal, **When** submitted, **Then** the table refreshes with
   the new or updated row.
3. **Given** a category linked to vendors, **When** Delete is clicked, **Then** a `409` error
   message is shown inline ("Category has linked vendors — cannot delete").

---

### User Story 2 - Manage Vendors (Priority: P1)

An admin views the Vendor list (search, type/active filters), and creates/edits vendors using a
four-tab modal (Details, Address, Contacts, Work Detail for subcontractors).

**Why this priority**: Core master data; vendor dropdown feeds Inventory, Machinery, Projects.

**Independent Test**: Create a vendor with 2 contacts and 3 Deals In tags, confirm it appears in
the list, edit its TDS Rate, toggle it inactive — without any inventory/machinery data needed.

**Acceptance Scenarios**:

1. **Given** the Vendor list, **When** loaded, **Then** it shows: Vendor (name+city), Deals In
   tags, Contact (person+phone), Type badge, GSTIN, TDS (section+rate), Active toggle, Actions.
2. **Given** the Add/Edit Vendor modal, **When** the Details tab is open, **Then** it shows:
   Name, Type dropdown (Material/Fuel/Hire/Service/Subcontractor/Labour Contractor), Deals In
   multi-select (from categories), GSTIN, PAN, TDS Section, TDS Rate, Active toggle.
3. **Given** the Contacts tab, **When** opened, **Then** it shows a list of contact rows
   (Name, Phone, Email) with an "+ Add Contact" button; each row has a Delete icon.
4. **Given** the Work Detail tab, **When** the vendor type is Subcontractor or Labour Contractor,
   **Then** the tab is enabled and shows hire/contract/machine/charges fields; for other types
   the tab is visible but disabled.
5. **Given** multi-tab form, **When** the user switches tabs, **Then** data entered on any tab
   is retained (single `react-hook-form` instance — FR-011).
6. **Given** the Active toggle in the vendor list row, **When** clicked directly, **Then** a
   confirmation dialog appears before toggling (to prevent accidental deactivation).

---

### User Story 3 - Contractor Vault (Priority: P2)

An admin views the Contractor list (with compliance status badges), opens a contractor detail
view showing document checklist with expiry warnings, compliance history, and work order summary.

**Why this priority**: Document management and compliance status visibility before compliance
recording is built.

**Independent Test**: Open `/dashboard/partners/contractors`, create a contractor profile for an
existing subcontractor vendor, upload a Labour License with an expiry date 20 days out (→ expiry
warning badge), confirm compliance status = Non-compliant.

**Acceptance Scenarios**:

1. **Given** the Contractor list, **When** loaded, **Then** it shows: Contractor Name, Contact
   Person, Licence Number, PF Registration, ESIC Registration, Insurance, BOCW Registration,
   Compliance Status badge (Compliant=green, Non-compliant=red, Partially compliant=yellow).
2. **Given** the Add Contractor modal, **When** opened, **Then** it shows a Vendor dropdown
   (filtered to subcontractor/labour_contractor type) and registration number fields.
3. **Given** the Contractor detail page, **When** opened, **Then** it shows a document checklist
   with upload controls per document type; each uploaded document shows file name, upload date,
   expiry date (if set), and an expiry warning badge if within 30 days or past.
4. **Given** a contractor, **When** the Compliance History section is viewed, **Then** it links
   to the Monthly Compliance list filtered to that contractor.

---

### User Story 4 - Monthly Compliance Recording (Priority: P2)

An admin records PF and ESIC challan details for a contractor and month; status auto-derives;
a Verify action marks the record as verified with the admin's identity.

**Why this priority**: Core compliance data capture; feeds RAG Matrix.

**Independent Test**: Open `/dashboard/partners/contractors/compliance`, record a compliance
entry with PF only (→ Partial badge), add ESIC (→ Submitted), click Verify (→ Verified green);
confirm the contractor's status badge updates in the Contractor list.

**Acceptance Scenarios**:

1. **Given** the Compliance table, **When** loaded, **Then** it shows: Contractor, Month, PF
   Challan #, PF Amount, PF Date, ESIC Challan #, ESIC Amount, ESIC Date, Status badge, Actions
   (Edit/Verify); filterable by Contractor, Month, Status.
2. **Given** the Record Submission modal, **When** opened, **Then** it shows Contractor
   dropdown, Month picker, PF fields, ESIC fields; PF and ESIC sections are independent (either
   can be submitted without the other).
3. **Given** a compliance record with PF only, **When** displayed, **Then** Status badge =
   "Partial" (yellow).
4. **Given** a Submitted compliance record, **When** the Verify action is clicked, **Then** a
   confirmation dialog appears ("Verify this compliance record? This records your identity.");
   on confirm, the status badge updates to "Verified" (green) with verifier name + timestamp.
5. **Given** a Verified record, **When** displayed, **Then** the Verify action is hidden and
   a "Verified by [name] on [date]" label is shown.

---

### User Story 5 - RAG Matrix (Priority: P2)

An admin views the compliance RAG matrix — a grid of contractors × months for a selected
financial year, with colour-coded status dots that navigate to compliance detail on click.

**Why this priority**: The primary compliance oversight tool; depends on compliance data existing.

**Independent Test**: Seed 3 contractors with varied compliance history; open
`/dashboard/partners/contractors/rag?fy=2025-26`; verify dot colours match the seeded statuses,
future months are gray, FY selector changes the columns.

**Acceptance Scenarios**:

1. **Given** the RAG Matrix page, **When** loaded, **Then** it shows a table: rows = contractors,
   columns = 12 months (Apr → Mar for the selected FY), each cell = a coloured dot.
2. **Given** the dot colours, **When** displayed, **Then**: Verified=green, Submitted/Partial=
   yellow, Missing=red, Future/Gray=gray — consistent with the StatusBadge convention (Projects).
3. **Given** the FY selector dropdown, **When** a different year is selected, **Then** the
   columns shift to that year's Apr → Mar range and dots refresh.
4. **Given** a non-gray dot, **When** clicked, **Then** the user navigates to the Monthly
   Compliance detail for that contractor and month (or opens a quick-view panel).
5. **Given** a gray dot (future month), **When** displayed, **Then** it is not clickable (no
   navigation on click).

---

### User Story 6 - BOCW Cess (Priority: P3)

An admin views BOCW cess liability per project (derived from contract values), records payments,
and monitors balance and status (Pending/Partial/Paid).

**Why this priority**: Financial compliance; depends on Projects data. Lower urgency.

**Independent Test**: Open `/dashboard/partners/bocw`, verify project cess liabilities are
computed at 1% of contract value, record a partial payment, confirm balance and status update.

**Acceptance Scenarios**:

1. **Given** the BOCW table, **When** loaded, **Then** it shows: Project Name, Contract Value,
   Cess Rate (1%), Cess Liability (auto-calc), Paid (₹), Balance (₹), Last Payment Date,
   Status badge (Pending=red, Partial=orange, Paid=green), Actions (Record Payment).
2. **Given** the Record Payment modal, **When** opened, **Then** it shows: Project (pre-filled),
   Amount Paid, Payment Date, Reference Number, Remarks.
3. **Given** a project with balance = 0, **When** displayed, **Then** Status = Paid (green) and
   the Record Payment button is disabled.
4. **Given** all monetary amounts, **When** displayed, **Then** they use Indian number formatting
   via `formatCurrency` (₹ with lakhs/crores grouping — same utility as Projects feature).

---

### Edge Cases

- What if a vendor has no Deals In categories? → Allowed — the multi-select is optional; the
  vendor appears in the list with an empty Deals In column.
- What if the Work Detail tab is opened for a non-subcontractor vendor type? → Fields are shown
  but disabled with a tooltip ("Available for Subcontractor and Labour Contractor types only").
- What if the RAG Matrix has no contractors? → Shows an empty state "No active contractors found".
- What if BOCW data is unavailable (Projects module error)? → Table shows an error state row per
  project with "Data unavailable" in the liability/balance columns — no full-page error.
- What if a compliance record's month is in the future? → The Month picker restricts to current
  month and past; future months are not selectable in the form.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All routes MUST be nested under `/dashboard/partners/*` protected by JWT auth.
- **FR-002**: The Vendor Add/Edit modal MUST be a four-tab `react-hook-form` form where all
  tabs share one form instance, preserving data across tab switches — consistent with Projects
  (008) and Settings (002) multi-tab patterns.
- **FR-003**: The Contacts tab MUST support dynamic add/remove of contact rows using
  `react-hook-form` field arrays (`useFieldArray`); minimum 0 contacts required.
- **FR-004**: The Deals In field MUST be a multi-select component populated from the Vendor
  Categories API; selected categories displayed as removable tags.
- **FR-005**: The Work Detail tab MUST be conditionally enabled only when vendor `type` is
  `subcontractor` or `labour_contractor`; visible but disabled for other types.
- **FR-006**: The RAG Matrix MUST render as a CSS grid or HTML table with sticky contractor
  column (left) and sticky month header row (top) for horizontal scrollability on narrow screens.
- **FR-007**: RAG dot click MUST navigate to the Monthly Compliance list pre-filtered to that
  contractor and month (URL params), or open a quick-detail panel — not a full page reload.
- **FR-008**: The FY selector on the RAG Matrix MUST update the URL query parameter `?fy=` so
  the selected year is shareable and survives browser refresh.
- **FR-009**: All monetary columns (BOCW Cess, compliance amounts) MUST use `formatCurrency`
  from `app/lib/utils.ts` — same utility as Projects.
- **FR-010**: The Active vendor toggle in the list MUST trigger a confirmation dialog before
  making the API call — accidental toggle prevention.
- **FR-011**: Vendor form tab data MUST be preserved across tab switches (single `react-hook-form`
  instance spanning all tabs, consistent with Projects/Settings precedent).
- **FR-012**: All API calls MUST go through `app/lib/api/partners.ts`.

### Key Entities

- **VendorCategory**: Name, Description, Vendors count (read-only).
- **Vendor**: Name+city, Type badge, Deals In tags, GSTIN, PAN, TDS section/rate, Active toggle.
- **VendorContact**: Name, Phone, Email (dynamic rows in Contacts tab).
- **ContractorProfile**: Vendor ref, registration numbers, Compliance Status badge.
- **ContractorDocument**: Type, file ref, upload date, expiry date, expiry warning badge.
- **MonthlyCompliance**: Contractor, Month, PF/ESIC challan fields, Status badge, Verify action.
- **BOCWCessRow**: Project Name, Contract Value, Cess Liability, Paid, Balance, Status badge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A compliance admin can record a full month's PF + ESIC entry for a contractor in
  under 2 minutes from the Compliance table page.
- **SC-002**: The RAG Matrix renders all contractors × 12 months in under 3 seconds for a
  company with up to 50 active contractors.
- **SC-003**: Status badges are consistent in colour and label across Contractor list, Monthly
  Compliance table, and RAG Matrix dots.
- **SC-004**: The Vendor form's tab data is never lost on tab switch — any entered field remains
  in its input when the user returns to a previously visited tab.
- **SC-005**: BOCW payment recording completes (form submit → table refresh) in under 5 seconds.

## Assumptions

- The `/dashboard/` shell layout and `nav-links.tsx` already exist (001–008); this feature adds
  a "Partners" nav group with sub-items: Vendors, Contractors, Compliance, RAG Matrix, BOCW Cess.
- `formatCurrency` is already in `app/lib/utils.ts` (added by Projects feature 008); if not, it
  is created there as part of this feature.
- `StatusBadge` component is already created by Projects (008); this feature extends its colour
  map with compliance statuses (Compliant=green, Non-compliant=red, Partially compliant=yellow,
  Verified=green, Submitted=blue, Partial=yellow, Missing=red).
- No map or geolocation features are needed in this module.
- The RAG Matrix grid is implemented with a plain HTML table (sticky header/column via CSS) —
  no third-party grid library required.
- The month picker for compliance recording restricts to current month and all past months;
  implemented with a `<select>` or native `<input type="month">` with `max` set to today.
