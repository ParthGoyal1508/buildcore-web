# Feature Specification: Search, Payout Communication and Exit Closure (Web)

**Feature Branch**: `021-search-payout-and-exit`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Client requirements spreadsheet, Notes 4, 9, 10 and 11. Backend counterpart:
`buildcore-api/specs/021-search-payout-and-exit-backend`.

**Scope**: Four small, independent surfaces. Grouped for economy, not because they share a
mechanism — each ships alone.

## Clarifications

### Session 2026-09-16

The client restated note 4 as *"Add a search bar on the dashboard to quickly find projects."*

- Q: US1 and FR-001 are written around a *code* in hand. The client says "quickly find projects", which people do by name. Widen it? → A: **Yes — code and name, in every register.** Nobody at head office memorises project codes; they know the site by what it is called. The same argument covers a vendor's trading name and an employee's name, so the widening is not projects-only.
- Q: Does a name match look different in the results? → A: **It says which field matched.** A row that appeared because of its name, when the user typed something that looks like a code, otherwise reads as a wrong result. An exact code match also sorts first (backend FR-001b).
- Q: Results appear as the user types. Does that still hold when a two-letter name fragment matches thousands of rows? → A: **No — there is a minimum term length.** Below it the control says to keep typing rather than returning an empty result, because an empty result and "too short to search" mean different things to the person typing and look identical otherwise.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A search box that finds anything by its code or its name (Priority: P1)

Somebody with a code in hand — a vendor code, a vehicle number, an employee ID, a project code — or
with nothing but the name of a site, a vendor or a person, types it into a box on the dashboard and
reaches the record. They do not need to know which module owns it, and they do not need to know its
code. The client asks for this twice: Note 4 for project codes, and the Dashboard row for
*"every Vendor, Vehicle, Employee ID"*.

**Why this priority**: There is no search of any kind in the product today, and this is the most
frequent thing anybody does in a system with this many registers.

**Independent Test**: Search a known code of each supported kind and reach the record; confirm a code
from another company returns nothing.

**Acceptance Scenarios**:

1. **Given** a code, **When** it is typed into dashboard search, **Then** matching records appear
   grouped by what they are, each identifying itself.
1a. **Given** a project's name or part of it, **When** it is typed, **Then** the project appears and
   can be opened, with no knowledge of its code required.
1b. **Given** a result matched by name, **When** it is shown, **Then** the row says it matched on the
   name rather than the code — otherwise, to somebody who typed something code-shaped, it reads as a
   wrong result.
1c. **Given** a term shorter than the minimum, **When** it is typed, **Then** the control says to keep
   typing rather than showing an empty result. "Nothing matched" and "too short to search" mean
   different things and must not look identical.
2. **Given** a result, **When** it is chosen, **Then** the full record opens.
3. **Given** a partial code, **When** typed, **Then** matches appear as the user types, without
   submitting.
4. **Given** a code the user may not see, **When** searched, **Then** nothing is returned and nothing
   suggests it exists.
5. **Given** no match, **When** searched, **Then** the empty state says so plainly.
6. **Given** search is open, **When** the keyboard is used, **Then** results are navigable and
   selectable without a mouse.

---

### User Story 2 - Seeing that everyone was paid, and told (Priority: P2)

After a run is marked paid, a payroll administrator sees which employees received their slip, which
could not be reached, and can retry the failures. They upload the bank's transaction sheet and see
it reconciled against the run, with unmatched lines called out.

**Acceptance Scenarios**:

1. **Given** a paid run, **When** its delivery status is viewed, **Then** delivered, failed and
   undeliverable employees are each listed.
2. **Given** failures, **When** retry is chosen, **Then** only the failures are resent.
3. **Given** an employee with no email address, **When** delivery status is viewed, **Then** they are
   listed as undeliverable with the reason.
4. **Given** a transaction sheet, **When** it is uploaded, **Then** matched lines, unmatched lines and
   amount differences are shown before anything is committed.
5. **Given** a run not fully approved, **When** delivery is attempted, **Then** the control is
   unavailable and says why.

---

### User Story 3 - A bank sheet that reflects what is actually owed (Priority: P2)

When the bank payment sheet is produced, advances taken since approval are recovered and shown as
their own lines, so the person releasing payment can see why a figure differs from the payroll run.

**Acceptance Scenarios**:

1. **Given** an advance taken after approval, **When** the sheet is produced, **Then** the recovery
   appears as a named line against that employee.
2. **Given** a recovery exceeding net payable, **When** the sheet is produced, **Then** the transfer
   is not negative and the carried-forward balance is shown.
3. **Given** the sheet, **When** it is reviewed, **Then** the difference from the payroll run's
   computed figures is explicable line by line.

---

### User Story 4 - A leaver's clearance, on one screen (Priority: P2)

When an employee exits, one screen shows everything outstanding — kit to return, documents to hand
back, advances and loans, reimbursements, access to revoke — and final settlement is unavailable
until each is resolved or deliberately waived.

**Acceptance Scenarios**:

1. **Given** an exit in progress, **When** the clearance screen is opened, **Then** every outstanding
   item is listed with its owner.
2. **Given** an outstanding item, **When** final settlement is attempted, **Then** it is unavailable
   and the blocking items are named.
3. **Given** an item waived, **When** the waiver is recorded, **Then** a reason is required and the
   waiver's author is shown.
4. **Given** a completed clearance, **When** settlement is produced, **Then** pending salary, notice
   recovery, advances, reimbursements and deductions appear with the final payable.

### Edge Cases

- A search term matching records of several kinds at once.
- A search returning thousands of matches.
- Slip delivery partially complete when the administrator opens the screen.
- A transaction sheet whose columns do not match what is expected.
- An exit for an employee with no outstanding anything — the screen must not look broken when empty.
- A waiver attempted by somebody without authority.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A search control MUST be present on the dashboard and MUST search employees, vendors,
  equipment and projects by code and name.
- **FR-001a**: Search MUST match on **name** as well as code, across every register FR-001 names
  (Clarifications, 2026-09-16). Finding a project by the site's name is the client's stated need, and
  no register is exempt from it.
- **FR-001b**: Each result MUST indicate whether it matched on code or on name, and an exact code
  match MUST appear before results matched only by name.
- **FR-001c**: Below a minimum term length the control MUST say so rather than render an empty result,
  and MUST NOT issue a request.
- **FR-002**: Results MUST be grouped by kind and MUST identify each record sufficiently to choose
  between them.
- **FR-003**: Results MUST appear as the user types, without submitting.
- **FR-004**: Results MUST be fully navigable by keyboard.
- **FR-005**: An empty result MUST say so plainly and MUST NOT reveal that a matching record — by
  code or by name — exists in a company or register the user cannot see.
- **FR-006**: Payroll delivery status MUST list delivered, failed and undeliverable employees.
- **FR-007**: Retry MUST resend only failures.
- **FR-008**: Transaction sheet upload MUST show matched lines, unmatched lines and differences
  before committing.
- **FR-009**: Delivery MUST be unavailable, with a stated reason, for a run that is not fully
  approved.
- **FR-010**: The bank payment sheet MUST show advance recoveries as named lines.
- **FR-011**: Differences between the sheet and the payroll run MUST be explicable line by line.
- **FR-012**: The exit clearance screen MUST list every outstanding item with its owner.
- **FR-013**: Final settlement MUST be unavailable while items are outstanding, naming them.
- **FR-014**: A waiver MUST require a reason and MUST display its author.
- **FR-015**: All access MUST go through the typed API modules (Principle V); copy MUST live in the
  constants module (Principle III); no inline styling (Principle II).

### Non-Functional Requirements

- **NFR-001**: Search results MUST appear within 1 second of typing stopping. **Not verified today** —
  nothing comparable exists to measure.
- **NFR-002** *(Note 25)*: Dashboard search MUST be usable at 320px. Search is part of the
  application shell rather than an admin screen, so it sat within Principle VI's scope before
  v2.1.0 and remains so. **Not verified today.**
- **NFR-003**: Search MUST NOT issue a request per keystroke.

### Key Entities

- **Search Result (view)**: A record's code, identifying summary, kind, and where it lives.
- **Delivery Status (view)**: Per employee, whether their slip was sent, when, and why not.
- **Clearance Item (view)**: One outstanding obligation, its owner, its state, and its waiver.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any employee, vendor, equipment or project is reachable from the dashboard by code in
  under 10 seconds, without module navigation.
- **SC-002**: Search never surfaces a record outside the user's company or permissions.
- **SC-003**: A payroll administrator can identify every employee who did not receive a slip, and
  retry them, from one screen.
- **SC-004**: Every difference between the bank sheet and the payroll run is explicable from the
  sheet itself.
- **SC-005**: No final settlement is reachable while an unwaived item is outstanding.

## Assumptions

- Search covers codes and names, not full text across every field.
- Search is debounced and cancels superseded requests, so typing does not generate a request per
  keystroke (NFR-003).
- Slip delivery is triggered from the payroll run screen, and this specification assumes it is
  visible there rather than being a background process nobody can observe.
- Exit clearance reuses the existing exit record screens rather than adding a parallel flow.
- No test framework is installed (constitution `TODO(TESTING_STANDARD)`); verification is lint,
  type-check, build and manual passes. **No test-file tasks may be generated.**

### Needing the client's decision

- **[NEEDS CLARIFICATION: should salary slips send automatically or on an explicit action?]** Carried
  from the backend spec. It decides whether this screen has a send control or only a status view.
- **[NEEDS CLARIFICATION: who may waive a clearance item?]** A waiver writes off company money. It
  most likely belongs with the final approval authority — Super Admin, per the client's answer on
  Director — but the client should confirm rather than have it assumed.
