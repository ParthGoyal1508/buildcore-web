# Feature Specification: BOQ, Billing and Project P&L (Web)

**Feature Branch**: `018-boq-billing-pl`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Client requirements spreadsheet, Notes 12, 13 and 15. Backend counterpart:
`buildcore-api/specs/018-boq-billing-pl-backend`.

**Scope**: The data-entry sheets and the reporting screens. The reconciliation itself, and every
figure it produces, belongs to the backend spec.

The client asked for *"a Separate wing for generate of vendor bill and Client Bill"* (Note 12) and
*"a separate Data Entry Sheet according the BOQ"* (Note 13). Those are screens, and they are the
hardest screens in this product: a billing engineer works down hundreds of BOQ lines entering
quantities, and the interface has to make that fast and hard to get wrong.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entering a client bill down the BOQ (Priority: P1)

A billing engineer opens the bill for a period and works down the BOQ. For each line they see the
description, unit, contracted quantity, rate, what has been billed to date, and a field for this
period. The line total and the bill total update as they type. A line that would exceed its
contracted quantity is flagged where they are typing, not at the end.

**Why this priority**: This is the screen Note 12 asks for and the entry point for everything else in
this feature.

**Independent Test**: Enter quantities against a real BOQ, confirm totals are correct, and confirm
over-billing is flagged at the line.

**Acceptance Scenarios**:

1. **Given** a project BOQ, **When** the client bill sheet is opened, **Then** every BOQ line appears
   with description, unit, contracted quantity, rate and quantity billed to date.
2. **Given** a quantity entered against a line, **When** it is entered, **Then** the line value and
   the bill total update without a save or reload.
3. **Given** a quantity that would exceed the contracted quantity, **When** it is entered, **Then**
   the line is flagged immediately and the bill cannot be submitted without a stated reason.
4. **Given** a BOQ with hundreds of lines, **When** the sheet is opened, **Then** it remains usable —
   scrolling, keyboard entry down a column, and totals visible without returning to the top.
5. **Given** entry in progress, **When** the browser or connection fails, **Then** the work is not
   silently lost.
6. **Given** a submitted bill, **When** it is reopened, **Then** it shows the rates it was billed at,
   not current BOQ rates.

---

### User Story 2 - Entering a subcontractor's measurement (Priority: P1)

The same working pattern for a subcontractor's RA bill: the awarded BOQ lines, quantity to date,
quantity this period, and the deductions — retention, advance recovery, others — shown as their own
lines so the net payable is never a number nobody can explain.

**Why this priority**: Note 13, and it is the other half of the reconciliation.

**Acceptance Scenarios**:

1. **Given** a subcontractor work order, **When** the RA bill sheet is opened, **Then** its awarded
   BOQ lines appear with quantity to date and remaining.
2. **Given** measured quantities entered, **When** the bill is totalled, **Then** gross, each
   deduction and net payable are shown separately.
3. **Given** quantity exceeding the awarded amount, **When** entered, **Then** it is flagged at the
   line and requires a reason.
4. **Given** a bill under approval, **When** a quantity is edited, **Then** the user is warned that
   approvals will be invalidated before the edit is saved.

---

### User Story 3 - What this project earned and what it cost (Priority: P1)

A project manager opens the project and sees, for a month and cumulatively: billed to client,
subcontractor cost, labour, material, plant, and the margin — against budget, with variance. Any
figure opens to the records behind it.

**Why this priority**: Notes 12 and 15 both end here. It is the answer the client is asking for.

**Acceptance Scenarios**:

1. **Given** a project with activity, **When** its summary is opened, **Then** revenue and each cost
   category appear for the chosen month and cumulatively, with budget and variance.
2. **Given** a figure on the summary, **When** it is opened, **Then** the source records comprising it
   are listed.
3. **Given** a category with no activity, **When** the summary is viewed, **Then** it reads zero
   rather than being absent.
4. **Given** a project over budget, **When** the summary is viewed, **Then** the overrun is apparent
   without the reader calculating anything.
5. **Given** a month is changed, **When** the selection changes, **Then** every figure updates
   together, with no mixed-period state visible.

---

### User Story 4 - Every project on one board (Priority: P2)

A director sees each project's billed, spent and margin position, and the company total, on one
screen — the *"P&L Summary of total Project"* the sheet's Group Dashboard row asks for.

**Acceptance Scenarios**:

1. **Given** several projects, **When** the group board is opened, **Then** each appears with revenue,
   cost and margin, with a company total.
2. **Given** a project on the board, **When** it is selected, **Then** its own summary opens.
3. **Given** projects the user may not see, **When** the board is opened, **Then** they appear in
   neither the rows nor the total.

### Edge Cases

- A BOQ long enough that rendering every line at once is slow. The sheet must stay responsive.
- Entry on a laptop with an intermittent site connection.
- Two engineers open the same bill; the second must not silently overwrite the first.
- A figure on the summary whose source records the viewer lacks permission to open.
- A month with revenue but no cost, or the reverse.
- Negative material cost from returns to store.
- A project whose currency formatting makes large numbers ambiguous in a dense table.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The client bill sheet MUST present BOQ lines with description, unit, contracted
  quantity, rate and quantity billed to date.
- **FR-002**: Line and bill totals MUST update as quantities are entered, without save or reload.
- **FR-003**: A quantity exceeding the contracted quantity MUST be flagged at the line on entry, and
  submission MUST require a stated reason.
- **FR-004**: The sheet MUST remain usable with several hundred lines: keyboard entry down a column,
  totals reachable, and scrolling that does not lose the header.
- **FR-005**: In-progress entry MUST NOT be lost silently on connection failure.
- **FR-006**: A submitted bill MUST display the rates at which it was billed.
- **FR-007**: The RA bill sheet MUST present awarded BOQ lines with quantity to date and remaining.
- **FR-008**: The RA bill MUST show gross, each deduction and net payable as separate figures.
- **FR-009**: Editing a bill under approval MUST warn that approvals will be invalidated, before
  saving.
- **FR-010**: The project summary MUST present revenue and cost by category, monthly and cumulative,
  with budget and variance.
- **FR-011**: Every figure on the summary MUST open to the records comprising it.
- **FR-012**: Changing the selected month MUST update every figure together, with no mixed-period
  state.
- **FR-013**: The group board MUST present per-project and total position, scoped to what the viewer
  may see.
- **FR-014**: Concurrent editing of the same bill MUST NOT allow silent overwriting.
- **FR-015**: All access MUST go through the typed API modules (Principle V); copy MUST live in the
  constants module (Principle III); no inline styling (Principle II).

### Non-Functional Requirements

- **NFR-001**: A BOQ sheet of 500 lines MUST become interactive within 3 seconds and MUST accept
  typing without perceptible lag thereafter. **Not verified today** — no comparable sheet exists in
  the product to measure against, and this is the single biggest interaction risk in this feature.
- **NFR-002**: The project summary MUST render within 3 seconds for a project with 12 months of
  activity.
- **NFR-003** *(Note 25)*: These are desktop surfaces under Principle VI and are **deliberately not**
  claimed as mobile. Billing entry against hundreds of BOQ lines on a phone is not a reasonable
  target, and pretending otherwise would produce a screen that is bad on both. The group board is a
  candidate for mobile if the client wants a director to read it away from a desk — see the
  clarification in `016-approval-spine`.

### Key Entities

- **Bill Entry Sheet (view)**: The BOQ lines being billed, each with its contracted, to-date and
  current-period quantities and derived values.
- **Deduction Line (view)**: A named subtraction on an RA bill — retention, advance recovery, other —
  shown with its basis.
- **Project Position (view)**: Revenue and cost by category for a period, with budget and variance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A billing engineer can enter quantities against 100 BOQ lines using the keyboard alone,
  without the mouse.
- **SC-002**: Over-billing a line is impossible to submit without a recorded reason, via any entry
  path.
- **SC-003**: Every figure on a project summary opens to records that sum to it exactly.
- **SC-004**: A project manager can state a project's month margin within 30 seconds of opening it.
- **SC-005**: No bill entry session loses data on a dropped connection, across 10 induced failures.

## Assumptions

- Bills are entered by trained staff at a desk, so keyboard efficiency matters more than touch
  affordance on these two sheets.
- The sheet loads the BOQ for the project rather than paginating it; a billing engineer works down
  the whole schedule, and pagination would break that. If BOQs prove larger than this assumption
  supports, virtualisation is an implementation answer, not a specification change.
- Totals shown while typing are computed client-side for responsiveness, and the backend's totals are
  authoritative on submit. Any disagreement is shown rather than silently reconciled.
- No test framework is installed (constitution `TODO(TESTING_STANDARD)`); verification is lint,
  type-check, build and manual passes. **No test-file tasks may be generated.**

### Needing the client's decision

- **[NEEDS CLARIFICATION: how large is a real BOQ?]** The interaction design depends on it. A
  200-line schedule and a 5,000-line schedule need different screens, and the difference cannot be
  discovered after the screen is built. A real BOQ file from a live project would settle it.
- **[NEEDS CLARIFICATION: do bills need offline or intermittent-connection entry?]** Site offices
  often have poor connectivity. If billing is done at site rather than head office, FR-005 becomes a
  much larger requirement than an unsaved-changes warning.
