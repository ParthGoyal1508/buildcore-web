# Feature Specification: Approval Spine (Web)

**Feature Branch**: `016-approval-spine`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Client requirements spreadsheet, Notes 2, 5, 6, 7 and 8. Backend counterpart:
`buildcore-api/specs/016-approval-spine-backend`.

**Scope**: What a reviewer sees and does. The chain itself — its levels, its rules, its enforcement
— belongs to the backend spec and is not restated here. This specification covers the three things
the client asked for that are purely about the screen: a control that is the same everywhere, the
name of whoever last acted shown on the record itself, and somewhere to find what is waiting for you.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One control, everywhere, behaving identically (Priority: P1)

Anything awaiting a decision carries the same Action/Review control, in the same position, offering
the same choices, in every module. Somebody who learns it in Attendance already knows it in
Inventory. The client asked for this twice, in Notes 5 and 6, and the requirement is the sameness
rather than the control.

**Why this priority**: A review control that differs per module is worse than none — it teaches
people that the rules change depending on where they are, which is how approvals get skipped.

**Independent Test**: Open a reviewable item in three different modules and confirm the control is
present, identically placed, and offers identical choices.

**Acceptance Scenarios**:

1. **Given** an item awaiting the current user's decision, **When** it is shown in any list or detail
   view, **Then** the Action/Review control is present and offers approve, reject and return.
2. **Given** an item awaiting somebody else, **When** the current user views it, **Then** the control
   is visible but inert and names who it is waiting on.
3. **Given** a rejection or return, **When** it is submitted without a reason, **Then** it is not sent
   and the reason is requested inline.
4. **Given** a decision is submitted, **When** the request is in flight, **Then** the control shows it
   is working and cannot be submitted twice.
5. **Given** a decision fails on the network, **When** the failure occurs, **Then** the reason the
   user typed is preserved and the action can be retried without retyping.
6. **Given** the user lacks authority on the item, **When** it is displayed, **Then** no actionable
   control is offered.

---

### User Story 2 - The record says who last touched it (Priority: P1)

Every record that can be acted on shows its latest action, who took it and when, on the record
itself. Its full history is one interaction away. The client's words: *"jis user ne jo action kiya
same vo us jagah show kare"* — in that place, not in a log somewhere else.

**Why this priority**: This is what makes the chain visible in daily work. Today a central activity
log exists, which answers "what happened in the system" but never "who approved *this*".

**Independent Test**: Approve any item, view it from another account, and confirm the actor, action
and time are visible without navigating away.

**Acceptance Scenarios**:

1. **Given** a record that has been acted on, **When** it is viewed, **Then** the latest action, the
   person's name and the time are shown on the record.
2. **Given** a record with several past actions, **When** its history is opened, **Then** the full
   sequence appears oldest to newest with actor, action, time and any reason.
3. **Given** a record never acted on, **When** it is viewed, **Then** no action is implied and its
   state reads as awaiting a first decision.
4. **Given** a long history, **When** it is opened, **Then** it is readable without leaving the record.
5. **Given** attribution is shown in a dense table, **When** the table is viewed at 320px, **Then**
   the actor remains discoverable rather than being truncated away entirely.

---

### User Story 3 - A place that shows what is waiting for me (Priority: P2)

A reviewer opens one screen and sees everything across every module that is waiting on them, oldest
first, with how long each has waited. They act from there without hunting through modules.

**Why this priority**: P2 because US1 and US2 make approvals workable; this makes them timely. An
approval chain with no inbox depends on people remembering to look, which is how payroll waits three
days for a signature nobody knew was needed.

**Independent Test**: Create items awaiting the same user in three modules and confirm all three
appear in one queue and can be acted on from it.

**Acceptance Scenarios**:

1. **Given** items awaiting the current user across modules, **When** the queue is opened, **Then**
   all appear with their module, subject, age and requester.
2. **Given** an item in the queue, **When** it is acted on there, **Then** the decision takes effect
   and it leaves the queue without a manual refresh.
3. **Given** an empty queue, **When** it is opened, **Then** it says so plainly rather than showing a
   blank screen.
4. **Given** an item acted on elsewhere, **When** the queue is next viewed, **Then** it is gone.
5. **Given** an item waiting longer than a defined period, **When** the queue is viewed, **Then** its
   age is visually distinguishable.
6. **Given** pending items exist, **When** any screen is shown, **Then** a count is visible in the
   navigation.

### Edge Cases

- A decision is taken by somebody else while the current user has the item open.
- The queue is opened by a user with no approval authority at all.
- An item's subject is long enough to break a dense table layout.
- The same item appears in both a module list and the queue; acting in one must settle the other.
- A user holds several levels of the same chain (unavoidable for Super Admin, which holds every
  permission) and sees the same item return to their queue after they approve it.
- The record is restored from the back/forward cache after a decision was taken.
- Attribution for an action taken by a user who has since been deactivated — the name must still
  resolve.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Action/Review control MUST be a single shared component used by every module, so
  that its placement and behaviour cannot diverge between them.
- **FR-002**: The control MUST offer approve, reject and return when the item awaits the current user.
- **FR-003**: The control MUST render inert, naming the awaited approver, when the item awaits
  somebody else.
- **FR-004**: The control MUST require a reason for reject and return before submitting.
- **FR-005**: The control MUST prevent double submission and MUST indicate work in progress.
- **FR-006**: The control MUST preserve user-entered text when a submission fails, and MUST allow
  retry without retyping.
- **FR-007**: A failed decision MUST NOT sign the user out or discard the screen they were on.
- **FR-008**: Every reviewable record MUST display its latest action, actor and time without
  navigation.
- **FR-009**: Users MUST be able to open a record's full decision history from the record.
- **FR-010**: The application MUST present one cross-module queue of items awaiting the current user.
- **FR-011**: The queue MUST show module, subject, age and requester per item, and MUST allow the
  decision to be taken from it.
- **FR-012**: A count of items awaiting the current user MUST be visible in the navigation on every
  screen.
- **FR-013**: The queue and the count MUST reflect decisions taken elsewhere without a manual reload.
- **FR-014**: All approval surfaces MUST obtain data through the typed API modules in `app/lib/api`
  (Principle V), with no direct calls.
- **FR-015**: All copy introduced by this feature MUST live in the central constants module
  (Principle III).
- **FR-016**: The control and the attribution display MUST use no inline styling (Principle II).

### Non-Functional Requirements

- **NFR-001** *(Note 25)*: The Action/Review control and the approval queue MUST be operable on
  Android and iOS phones at 320px width, with every decision reachable, targets no smaller than 44px,
  and no horizontal scrolling of the page body.

  **Resolved by constitution v2.1.0 (2026-09-13).** Principle VI's responsive floor for desktop
  surfaces moved from 768px to 320px. Approval surfaces remain *designed* desktop-first and are not
  added to the mobile-critical list — so the one-handed and 44px rules do not apply to them — but
  they MUST be usable and unbroken at 320px, which is what this requirement now means.

  The 44px minimum stated above therefore applies only where an approval surface is reached from a
  mobile-critical screen; elsewhere the obligation is reachability, not comfort.

  **Not verified today**: no admin surface has ever been checked at 320px, because the previous gate
  did not ask. The amendment describes an obligation the codebase has not been measured against.

### Key Entities

- **Reviewable Item (view)**: What the screen needs in order to render a decision — its current
  level, whether it awaits the current user, who it awaits otherwise, and its latest action.
- **Decision History (view)**: The ordered list of actions on a record, each with actor, action, time
  and reason.
- **Approval Queue Entry**: One item awaiting the current user, with enough context to decide without
  opening it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Action/Review control appears in the same position with the same options across at
  least 5 modules, verified by inspection of each.
- **SC-002**: For any record acted on, a reviewer can name who acted and when within 5 seconds of
  opening it, without navigating away.
- **SC-003**: A reviewer can find and action everything awaiting them from one screen, with no module
  navigation.
- **SC-004**: A failed approval submission never loses the reason the user typed, across 10 induced
  failures.
- **SC-005**: The pending count matches the queue contents at all times, verified after decisions
  taken in another session.

## Assumptions

- The backend supplies, with each reviewable record, its current level, whether it awaits the caller,
  and its latest action — so the web application never infers authority for itself. Enforcement is
  the backend's (Principle V and the backend spec's FR-003).
- The control is one component with per-module configuration, not a pattern each module reimplements.
  Sameness is the requirement, and a pattern will drift.
- The pending count reuses the existing navigation badge mechanism introduced by the reminders
  feature rather than adding a second one.
- Attribution shows the person's display name; a deactivated user's name still resolves.
- **Note 25 was settled by constitution v2.1.0**, which lowered the responsive floor for desktop
  surfaces from 768px to 320px rather than making the admin application mobile-first. The client's
  "worked on Mobile Phone" is read as reachability, not optimisation. Approval surfaces are
  therefore designed for a desk and must not break on a phone — a distinction that costs a
  responsive pass rather than a redesign.
- No test framework is installed in this repository (constitution `TODO(TESTING_STANDARD)`), so
  verification is lint, type-check, build and manual passes. **No test-file tasks may be generated
  from this specification.**

### Needing the client's decision

- **[NEEDS CLARIFICATION: which modules gain the control first?]** FR-001 makes it shared, but each
  module must be migrated onto it. The order should follow the client's priority, not ours.
