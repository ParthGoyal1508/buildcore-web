# Feature Specification: Settings Module Frontend (Companies, Users, Roles & Employee Setup)

**Feature Branch**: `002-settings`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Settings Module (Companies, Users, Roles & Permissions, Employee
Setup reference data) for the BuildCore ERP frontend (buildcore-web), per the PRD at
/Users/parthgoyal/Projects/ERP-Demo/docs/prd/08-settings.prd.md. This is the frontend/UI surface
only: the /settings/companies list + multi-tab Add/Edit Company modal, /settings/users list,
/settings/roles list + Add/Edit Role modal, and the Employee Setup screen (Code Series,
Departments, Designations, Document Types, Shifts tabs, reached from the Employees page's 'Setup'
button). This frontend consumes the backend contract already specified in the buildcore-api repo's
own spec (specs/002-settings-backend/contracts/settings-api.md) — Companies/Roles/Users-admin/
reference-data CRUD, role-permission enforcement, employee-code generation."

## Clarifications

### Session 2026-08-27

- Q: Should the Users screen show a "Create User" entry point even though account creation belongs
  to a separate feature? → A: Yes — an "Add User" entry point that deep-links to the separate
  Account Creation flow, even though this feature doesn't implement that flow itself.
- Q: The Employees page (the PRD's stated entry point to Employee Setup) doesn't exist yet — should
  Employee Setup be its own route now? → A: Yes — build it at a standalone route now; a future
  Employees feature adds its own "Setup" button linking here.
- Q: How should the multi-column list screens adapt on mobile viewports, per the constitution's
  mobile-first requirement? → A: Card layout — below a breakpoint, each row renders as a stacked
  card (label: value pairs) instead of a table row.
- Q: Should any role besides Super Admin/HO User get read-only access to the Users screen? → A:
  No — strictly Super Admin/HO User only, matching the backend's single USER_MANAGEMENT permission
  gate; any other role gets the same access-denied state as any other `/settings/*` screen.
- Q: Should this feature target a formal accessibility conformance level? → A: Basic practices only
  (semantic HTML, keyboard-navigable forms/modals, sufficient color contrast) — no formal WCAG
  conformance target, consistent with the constitution not mandating one for this internal ops
  tool.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure a company and its statutory/payroll settings (Priority: P1)

A Super Admin opens the Companies screen, adds a new company by filling in its basic info,
registration numbers, address, statutory codes, and payroll settings across a multi-tab modal, and
sees it appear in the company list; they can reopen any existing company to edit its details later.

**Why this priority**: Every other screen in this feature (and the rest of the app) depends on at
least one company existing and being selectable — this is the entry point to a usable
multi-company system.

**Independent Test**: Can be fully tested by opening the Add Company modal, filling in required
fields across all five tabs, saving, and confirming the new row appears in the Company List with
the correct Short Code, GSTIN, PAN, and Status; then reopening it, editing a payroll rate, and
confirming the updated value shows on next reopen.

**Acceptance Scenarios**:

1. **Given** the Companies screen, **When** a Super Admin clicks "Add Company" and completes the
   Basic Info, Registration, Address, Statutory, and Payroll Settings tabs before saving, **Then**
   the modal closes and the new company appears in the Company List with its Status shown as
   Active.
2. **Given** the Add/Edit Company modal, **When** a required field on any tab is left empty or a
   GSTIN/PAN is entered in an invalid format, **Then** an inline validation error appears next to
   that field on its own tab and the save action is blocked until it's corrected.
3. **Given** an existing company, **When** a Super Admin edits its PF/ESIC/Gratuity/Bonus rates or
   Payroll Lock Day and saves, **Then** the Company List and a reopened modal both reflect the new
   values immediately.
4. **Given** an existing company, **When** its Short Code is changed to one already used by another
   company, **Then** the save is rejected with an inline error identifying the conflict, and the
   modal remains open with the entered data intact.
5. **Given** an existing company, **When** a Super Admin toggles its Status to Inactive, **Then**
   its row in the Company List shows Inactive and it no longer appears in company-selector
   dropdowns used elsewhere in the app, while its own row and data remain visible/editable in this
   screen.
6. **Given** a signed-in user without company-settings access, **When** they navigate to
   `/settings/companies`, **Then** they see an access-denied state instead of the screen's content.

---

### User Story 2 - Manage roles and their permissions (Priority: P1)

A Super Admin views the Roles screen listing every role (the shipped defaults and any custom ones)
with its permissions and assigned-user count, creates a new custom role by choosing permissions
from the available set, and edits or removes a non-protected role.

**Why this priority**: Depended on by User Story 3 (assigning a role to a user) and is this
feature's core access-control surface; equally foundational as Companies.

**Independent Test**: Can be fully tested by viewing the nine default roles with their permissions
and user counts, creating a custom role with a chosen permission subset, and confirming it appears
in the list ready to be assigned to a user.

**Acceptance Scenarios**:

1. **Given** the Roles screen, **When** it loads, **Then** all default roles are listed with their
   permissions and a count of users currently assigned to each.
2. **Given** the Add/Edit Role modal, **When** a Super Admin selects permissions, **Then** they
   choose from the system's fixed list of permission options (checkboxes/multi-select) — there is
   no free-text permission entry.
3. **Given** the Super Admin role's row, **When** a Super Admin attempts to edit its name or
   permissions or clicks Delete, **Then** the edit/delete controls are disabled or the action is
   rejected with a message explaining this role is protected.
4. **Given** a non-protected role currently assigned to one or more users, **When** it is deleted
   and the action is confirmed, **Then** it's removed from the list and a follow-up warning notes
   that affected users have lost their role assignment.
5. **Given** the Roles screen viewed on a mobile-width viewport, **When** the list renders,
   **Then** each role appears as a stacked card (name, permission summary, user count, actions)
   rather than a wide table row.

---

### User Story 3 - Administer existing user accounts (Priority: P2)

A Super Admin or HO User views the Users screen, changes an existing user's role or active/inactive
status, removes an account that should no longer have access, and can reach the separate Account
Creation flow to add a new one.

**Why this priority**: Depends on Story 2 (roles must exist to assign); day-to-day access
management that matters once the system is live, but not required for the system to be initially
usable by its bootstrap Super Admin.

**Independent Test**: Can be fully tested by viewing the user list with role/status/last-login
columns, changing one user's role, deactivating another, deleting a third, and confirming an "Add
User" control is present and navigates to the Account Creation entry point.

**Acceptance Scenarios**:

1. **Given** the Users screen, **When** it loads, **Then** each row shows Name, Email, Role, Status,
   and Last Login (or "Never" if the account hasn't signed in yet).
2. **Given** an existing user row, **When** an admin changes its assigned Role via an edit action
   and saves, **Then** the row updates to show the new role immediately.
3. **Given** an existing user row, **When** an admin toggles its Status to Inactive, **Then** the
   row reflects the change and a confirmation indicates the user can no longer sign in.
4. **Given** an existing user row, **When** an admin clicks Delete and confirms, **Then** the row is
   removed from the list.
5. **Given** the Users screen, **When** viewed by a Super Admin or HO User, **Then** an "Add User"
   control is visible and navigates to `/dashboard/account-creation/new` (`010-account-creation`);
   **When** any other role attempts to navigate to `/settings/users`, **Then** they see the same
   access-denied state as any other `/settings/*` screen — there is no read-only tier for this
   screen.
6. **Given** the last remaining active Super Admin account's row, **When** an admin attempts to
   deactivate it, delete it, or reassign its role, **Then** the action is rejected with a message
   explaining this account cannot lose Super Admin access while it's the only one.

---

### User Story 4 - Maintain Departments and Designations masters (Priority: P2)

An admin opens the Employee Setup screen's Departments and Designations tabs and adds, renames, or
removes entries scoped to the currently selected company.

**Why this priority**: Simple, independent CRUD screens that unblock Employee-form dropdowns
elsewhere; useful once a company exists, but not required for Stories 1–3.

**Independent Test**: Can be fully tested by adding a department under one company, switching the
active company context, confirming it does not appear under the other company, then renaming and
deleting it.

**Acceptance Scenarios**:

1. **Given** the Departments (or Designations) tab, **When** an admin adds a new entry with a name,
   **Then** it appears in that tab's list immediately, scoped to the currently selected company.
2. **Given** an existing entry, **When** it's renamed, **Then** the list reflects the new name.
3. **Given** an entry currently in use by at least one employee record, **When** deletion is
   attempted, **Then** the action is rejected with a message explaining it's still in use.
4. **Given** the same tab, **When** the admin switches the active company context (e.g., via a
   company selector), **Then** the list reloads to show only that company's entries.

---

### User Story 5 - Maintain Document Types with mandatory/expiry/number flags (Priority: P3)

An admin opens the Employee Setup screen's Document Types tab, sees the system's default document
types already listed for the selected company, and adds or edits entries by toggling Mandatory, Has
Expiry Date, and Needs Document Number, seeing the derived flag update live.

**Why this priority**: More involved than Story 4's plain masters due to the derived-flag display
and its downstream effect on attendance elsewhere, but not required before Stories 1–4 are usable.

**Independent Test**: Can be fully tested by opening the Add/Edit Document Type modal, toggling
Mandatory and Needs Document Number on, and confirming the row displays "MandatoryNumber" without a
page reload.

**Acceptance Scenarios**:

1. **Given** the Add/Edit Document Type modal, **When** any combination of the Mandatory/Has Expiry
   Date/Needs Document Number toggles changes, **Then** a live preview of the resulting flag
   (MandatoryNumber, Mandatory, ExpiryNumber, Expiry, Number, or Optional) updates immediately,
   before saving.
2. **Given** a newly created company, **When** its Document Types tab is opened for the first time,
   **Then** it already lists the system's default document types with their default flags.
3. **Given** the Document Types list, **When** an entry's Active toggle is turned off, **Then** its
   row shows an inactive indicator and it's excluded from anywhere this data feeds a "select a
   document type" control for new uploads elsewhere in the app.
4. **Given** the Document Types tab, **When** sort order values are changed, **Then** the list
   re-orders to match.

---

### User Story 6 - Maintain Shifts (Priority: P3)

An admin opens the Employee Setup screen's Shifts tab and adds, edits, or removes shift definitions
(name, in-time, out-time, grace period) scoped to the selected company.

**Why this priority**: A straightforward per-company master, independent of Stories 1–5.

**Independent Test**: Can be fully tested by adding a shift with a name, in-time, out-time, and
grace period, confirming it appears in the list, and confirming deletion is blocked while an
employee record references it.

**Acceptance Scenarios**:

1. **Given** the Shifts tab, **When** an admin adds a shift with a name, in-time, out-time, and
   grace period (minutes), **Then** it appears in the list.
2. **Given** a shift currently referenced by at least one employee record, **When** deletion is
   attempted, **Then** the action is rejected with a message explaining it's still in use.

---

### User Story 7 - View a company's employee code series (Priority: P3)

An admin opens the Employee Setup screen's Code Series tab and sees, for the selected company, its
short code and the next employee code that would be generated, without being able to edit the
sequence number directly.

**Why this priority**: The smallest, most read-only piece of Employee Setup; useful for visibility
but has no independent editing behavior of its own.

**Independent Test**: Can be fully tested by opening the Code Series tab for a company and
confirming it displays the company's Short Code and the next code in the `{ShortCode}-{Sequential}`
format, with no editable sequence-number field present.

**Acceptance Scenarios**:

1. **Given** the Code Series tab, **When** it's opened for a company, **Then** it displays that
   company's Short Code and the next employee code that would be generated (e.g., "DC-0001"), as
   read-only information.
2. **Given** the Code Series tab, **When** the company's Short Code is changed on the Companies
   screen (Story 1) and the tab is reopened, **Then** the displayed prefix reflects the new Short
   Code while the sequence portion is unaffected.

---

### Edge Cases

- What happens when a user without any Settings-area permission attempts to navigate directly to
  any `/settings/*` URL? They see an access-denied state rather than the screen's content or a
  broken/partial render, consistent across all screens in this feature.
- What happens when two admins edit the same company/role/reference-data entry at nearly the same
  time? The later save succeeds and overwrites the earlier one; this feature does not implement
  optimistic-lock conflict detection beyond showing the latest server-confirmed data on next load.
- What happens when the Employee Setup screen is opened for a newly created company that has no
  Departments/Designations/Shifts configured yet? Each tab shows an empty state with a clear
  "Add" call to action rather than an error.
- What happens on a narrow/mobile viewport when a list is empty? The empty state renders as a
  single centered message/action, not a zero-row table artifact.
- What happens if a save request to the backend fails (network error, validation rejected
  server-side, permission denied)? The modal/form stays open with the entered data intact and shows
  the specific error, rather than silently closing or losing the user's input.
- What happens when the last active Super Admin account is the one currently signed in and viewing
  the Users screen? The same protection (Story 3, Acceptance Scenario 6) applies regardless of
  whether the acting admin is viewing their own row or another's.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Companies screen at `/settings/companies` listing Company
  Name, Short Code, Address, GSTIN, PAN, PF Establishment Code, ESIC Code, and Status, with Edit and
  Delete-equivalent (deactivate) actions per row.
- **FR-002**: The system MUST provide an Add/Edit Company modal with five tabs (Basic Info,
  Registration, Address, Statutory, Payroll Settings) covering every field in the PRD's Company
  spec, validated inline per field before allowing save.
- **FR-003**: The system MUST show a live-updating default for the Payroll Settings tab's
  contribution rate fields (PF 12%, ESIC 3.25%, Gratuity 4.81%, Bonus 8.33%) when creating a new
  company, editable before or after save.
- **FR-004**: The system MUST reject an attempted save when the Short Code, GSTIN, or PAN fails
  its expected format/uniqueness check, surfacing the specific error inline on the relevant tab
  without losing the user's entered data on any other tab.
- **FR-005**: The system MUST reflect a company's Status (Active/Inactive) in the Company List and
  MUST exclude Inactive companies from any company-selector control used elsewhere in the app,
  while still showing them (clearly marked Inactive) in this screen's own list.
- **FR-006**: The system MUST provide a Roles screen at `/settings/roles` listing Role Name,
  Permissions, Users Count, and Edit/Delete actions per row.
- **FR-007**: The system MUST provide an Add/Edit Role modal whose Permissions field is a
  multi-select drawn from the system's fixed permission list — never a free-text input.
- **FR-008**: The system MUST disable or block editing the Super Admin role's name/permissions and
  MUST disable or block deleting it, showing an explanatory message if attempted.
- **FR-009**: The system MUST warn the admin, on deleting a role still assigned to one or more
  users, that those users will lose their role assignment as a result.
- **FR-010**: The system MUST provide a Users screen at `/settings/users` listing Name, Email,
  Role, Status, and Last Login, with Edit and Delete actions, accessible only to a Super Admin or
  HO User; any other role navigating to this route MUST see the same access-denied state as any
  other `/settings/*` screen (FR-020) — there is no read-only tier for this screen.
- **FR-011**: The system MUST provide an "Add User" entry point on the Users screen that navigates
  to `/dashboard/account-creation/new` (`010-account-creation`), without this feature implementing
  that flow itself.
- **FR-012**: The system MUST allow editing an existing user's Role and Status from the Users
  screen and reflect the change in the list immediately upon a successful save.
- **FR-013**: The system MUST reject (with an explanatory message) any attempt to deactivate,
  delete, or reassign the role of the last remaining active Super Admin account.
- **FR-014**: The system MUST provide an Employee Setup screen at a standalone route (e.g.
  `/settings/employee-setup`) with Code Series, Departments, Designations, Document Types, and
  Shifts tabs, scoped to a selectable company context.
- **FR-015**: The system MUST provide CRUD (create, rename/edit, delete) for Departments and
  Designations within their respective tabs, rejecting deletion of an entry still referenced by an
  employee record with an explanatory message.
- **FR-016**: The system MUST provide CRUD for Document Types with Mandatory, Has Expiry Date, and
  Needs Document Number toggles, a Sort Order field, and an Active toggle, computing and displaying
  the derived flag (MandatoryNumber/Mandatory/ExpiryNumber/Expiry/Number/Optional) live as the
  toggles change, before save.
- **FR-017**: The system MUST display a newly created company's Document Types tab pre-populated
  with the system's default document types and their default flags.
- **FR-018**: The system MUST provide CRUD for Shifts (name, in-time, out-time, grace period),
  rejecting deletion of an entry still referenced by an employee record with an explanatory
  message.
- **FR-019**: The system MUST display, on the Code Series tab, the selected company's Short Code
  and the next employee code that would be generated, as read-only information with no editable
  sequence field.
- **FR-020**: The system MUST show an access-denied state (not the screen's content) when a signed-
  in user without the required permission navigates directly to any `/settings/*` URL.
- **FR-021**: Every list screen in this feature (Companies, Users, Roles, and each Employee Setup
  tab's list) MUST render as a stacked card layout per row below the mobile breakpoint, instead of
  a wide table, per the constitution's mobile-first requirement.
- **FR-022**: Every create/edit form in this feature MUST show field-level validation errors
  inline, keep the modal/form open with entered data intact on a failed save (client or
  server-rejected), and surface the specific error returned by the backend rather than a generic
  failure message.
- **FR-023**: All requests to `buildcore-api`'s Settings endpoints MUST go through the typed
  `app/lib/api/` fetch wrapper, per the constitution's API Access Boundary principle — no ad-hoc
  `fetch()` calls inside a component.
- **FR-024**: Every form, modal, and interactive control in this feature MUST be operable via
  keyboard alone (tab order, focus visible, Enter/Space/Escape behave as expected) and MUST use
  semantic HTML elements (`<button>`, `<label>`, `<table>`/list semantics) rather than non-semantic
  `<div>`-based equivalents, per the basic-accessibility clarification above — no formal WCAG
  conformance target is required.

### Key Entities

- **Company**: A group entity with identity, registration, address, statutory, and payroll-setting
  fields, plus an Active/Inactive status; the root context every other screen in this feature (and
  most of the app) is scoped by.
- **Role**: A named permission set; nine defaults are shipped (Super Admin protected/undeletable),
  admins may add/edit/delete others; tracks how many users currently hold it.
- **User (administration view)**: An existing account this feature lists/edits/deletes; creation is
  out of this feature's scope (`010-account-creation`).
- **Department / Designation**: Simple per-company named reference entries feeding Employee-form
  dropdowns elsewhere.
- **Document Type**: A per-company reference entry with three independent toggles and a
  derived-flag display, gating attendance-marking elsewhere in the app for employees missing a
  mandatory one.
- **Shift**: A per-company reference entry (name, in/out time, grace period) feeding Employee-form
  dropdowns and downstream overtime calculation.
- **Employee Code Series (view)**: A read-only, per-company display of the current short code and
  next employee code; no direct editing surface in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Super Admin can create a fully configured company (all five tabs) in under 5
  minutes on first attempt.
- **SC-002**: An admin can change a user's role or status and see it reflected in the Users list in
  under 10 seconds of the save completing.
- **SC-003**: 100% of attempted edits/deletes of the Super Admin role, and 100% of attempted
  deactivate/delete/reassign actions on the last active Super Admin account, are blocked with a
  clear explanatory message in testing.
- **SC-004**: 100% of newly created companies show their default Document Types pre-populated on
  first opening that tab.
- **SC-005**: Across all list screens in this feature, 100% of rows render as stacked cards (not a
  horizontally overflowing table) when viewed at a mobile viewport width (≤428px), in testing.
- **SC-006**: Zero users without the required Settings permission can reach a `/settings/*`
  screen's content (as opposed to an access-denied state) in testing, including via direct URL
  navigation.
- **SC-007**: 100% of failed save attempts (client validation or server rejection) leave the
  form/modal open with the user's entered data intact and a specific, readable error message, in
  testing.
- **SC-008**: Every interactive control across this feature's screens can be reached and operated
  using only a keyboard, in testing.

## Assumptions

- Multi-tab modal fields are held in local form state across tab switches and persisted to the
  backend only on a single explicit Save action per the whole modal, not per-tab — consistent with
  how the PRD describes one "Add/Edit Company Modal (multi-tab)," not five separate forms.
- The backend contract this feature consumes (buildcore-api's `specs/002-settings-backend/
  contracts/settings-api.md`) is the authority on exact request/response shapes, validation rules
  (GSTIN/PAN format, short-code/department/shift uniqueness), and the fixed permission enumeration;
  this frontend spec describes observable UI behavior, not wire formats.
- Per the clarifications above: the Users screen includes an "Add User" entry point that deep-links
  to `010-account-creation` (`/dashboard/account-creation/new`); Employee Setup is built at its own standalone route now
  rather than waiting on a not-yet-built Employees page; and every list in this feature adopts a
  card layout below the mobile breakpoint, per the buildcore-web constitution's newly added
  Responsive & Mobile-First Design principle.
- "Site Supervisor" (mentioned in the PRD as a functional responsibility, not a distinct role) needs
  no dedicated UI in this feature — it's fully expressed by whichever role holds the Daily Worker
  Registry permission in the Roles screen's fixed permission list.
- A "currently selected company" context (used by Employee Setup's per-company scoping and by
  cross-module company-selector dropdowns) is assumed to already exist as shared app state/UI by the
  time this feature ships, or is trivial company-selector UI this feature can introduce locally if
  not; it is not this feature's job to design the app-wide company-switching mechanism itself.
- No automated test framework exists yet in this repo (per its own constitution's known gap);
  verification of this feature's screens is manual (including the mobile-viewport check FR-021/
  SC-005 require) until one is adopted.

---

## Amendment 2026-09-01 — Company Documents Screen

**Reason**: A gap audit against the module/submodule matrix found row 42 ("Settings: **Companies
Documents**") names a screen this spec does not have. This feature manages Document *Types* and
005 stores documents against *employees*, but there is nowhere to keep the company's own statutory
documents — GST and PF/ESIC registration certificates, incorporation, labour licences, insurance —
whose expiry stops the company operating. Everything above is unchanged.

### User Story 8 - Company document types and repository (Priority: P3)

A Super Admin configures the kinds of document the company holds and maintains those documents with
versioning and expiry visibility.

**Why this priority**: Reference data plus a repository screen; no other screen depends on it.

**Independent Test**: Create a "GST Registration Certificate" type with a 60-day alert window, upload
a certificate expiring in 30 days, confirm it appears in the expiring list, then upload a renewal and
confirm v2 is current with v1 still downloadable.

**Acceptance Scenarios**:

1. **Given** the Company Documents screen under Settings, **When** loaded, **Then** two tabs are shown
   — Documents and Document Types — following the established multi-tab pattern.
2. **Given** the Document Types tab, **When** a type is added, **Then** it collects Name, Statutory
   flag, Requires Number, Requires Issuing Authority, Requires Expiry, and Alert Days; Requires Expiry
   without Alert Days shows a field-level error.
3. **Given** a type with uploaded documents, **When** Delete is attempted, **Then** the `409` is
   surfaced as a toast.
4. **Given** the Upload Document form, **When** a type is selected, **Then** only the fields that type
   marks required are shown and enforced before submit.
5. **Given** an expiry date earlier than the issue date, **When** submitted, **Then** a field-level
   error appears before any request is sent.
6. **Given** the Documents tab, **When** loaded, **Then** current versions are listed with Type,
   Document Number, Issuing Authority, Issue Date, Expiry Date, Days to Expiry, and a status badge
   (Valid=green, Expiring Soon=amber, Expired=red).
7. **Given** a document with prior versions, **When** its row is expanded, **Then** every version is
   listed with its issue date and remains downloadable.
8. **Given** an "Expiring soon" filter, **When** applied, **Then** documents within their alert window
   or already expired are shown, expired first.
9. **Given** a Super Admin with cross-company access, **When** the screen is opened, **Then** a company
   selector is shown; a single-company admin sees their own company without a selector.
10. **Given** a document, **When** Download is clicked, **Then** the file downloads through the typed
    API client.
11. **Given** a current document, **When** Delete is confirmed with a reason, **Then** the prior
    version visibly becomes current in the same list update.

### Additional Edge Cases

- A statutory document expires with no renewal → it stays at the top of the expiring list
  indefinitely; the UI raises visibility but blocks nothing, and says so.
- The same type exists per state (multiple GST registrations) → multiple documents of one type with
  distinct numbers coexist, and versioning applies per number rather than per type.
- A document is backfilled with a past expiry → accepted and immediately shown as expired.

### Additional Functional Requirements

- **FR-025**: The Company Documents screen MUST live under `/dashboard/settings/*` and be guarded by
  the existing `COMPANY_SETTINGS` permission — no new permission is introduced.
- **FR-026**: The upload form MUST show and enforce only the fields the selected document type marks
  required, so a user is never asked for a value the type does not need.
- **FR-027**: Document status (Valid / Expiring Soon / Expired) MUST be rendered from the API's
  computed status via `StatusBadge`, never recomputed client-side from dates.
- **FR-028**: Prior versions MUST remain visible and downloadable from an expandable row; a renewal
  MUST NOT visually replace history.
- **FR-029**: The screen MUST state that document expiry blocks no business operation, so its purpose
  as a visibility surface is unambiguous.
- **FR-030**: Company document expiry reminders MUST be rendered from the global Reminders centre
  built by the 004 amendment, not evaluated independently on this screen.
- **FR-031**: A company selector MUST appear only for callers holding cross-company access.
- **FR-032**: All new API calls MUST go through the existing typed `app/lib/api/settings.ts` module
  with `zod` validation at the boundary (Principles IV, V).
- **FR-033**: Uploads MUST restrict accepted types via the `accept` attribute and show progress; the
  screen MUST use `ResponsiveList`, meet 44×44px touch targets, and render without horizontal page
  scroll at 320px (Principle VI).
- **FR-034**: Labels, status names, and colour mappings MUST come from a constants module
  (Principle III).

### Additional Success Criteria

- **SC-A01**: Every company document has a retrievable current version and full version history on
  screen, with no version ever visually lost on renewal.
- **SC-A02**: Every document within its alert window or past expiry is discoverable from one filter.

## Amendment 2026-09-02 — Desktop-First Responsiveness (constitution v2.0.0)

Constitution Principle VI was redefined from blanket mobile-first to **desktop-first with a closed
list of mobile-critical surfaces** (punch in/out, attendance including supervisor muster, leave,
and sign-in). Settings is a **desktop surface**: company/site/department masters, designations, shifts and leave policy are configured by an administrator at a desk, not on site.

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
