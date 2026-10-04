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

## Clarifications

### Session 2026-09-13

- Q: Which module gains the shared Action/Review control first? → A: **Attendance exceptions.**
- Q: May one person decide at more than one level of the same chain? → A: No — forbidden once they
  have decided on that item. *(Backend rule; this interface must show why a control is inert.)*
- Q: Which actions require final Super Admin approval? → A: Payment release, payroll run approval,
  money-committing letters (WO, LOI, PO), and final settlement on exit.
- Q: How are the chain's roles defined? → A: Levels reference configurable **role slots** that each
  company maps to its own roles. *(This interface names people and slots, never hardcoded roles.)*

**What these mean for the interface.** Two of them change what the control must say. Because a
person may not decide twice on the same item (backend FR-021a), a reviewer will meet items whose
control is inert *for a reason that is not lack of permission* — they already decided earlier in the
chain. "You do not have permission" would be untrue and would send them to an administrator for
nothing. And because levels resolve through slots rather than roles, the waiting-on text must name
the person or the slot as configured, never a role name this interface assumed.

### Session 2026-09-16

The client restated note 2 in two halves: block a punch that fails location or photo verification,
and log every manual attendance modification so it reaches the affected employee. The first half is
feature 020's; it changes what this feature's chain reviews.

- Q: Feature 020 now refuses a failed punch and records nothing. This feature's approval chain was built to review those refusals. What does it review instead? → A: **The supervisor's manual attendance correction.** The screens are unchanged in shape — the same Action/Review control, the same queue, the same attribution — and what flows through them changes. The backend records this as its own FR-012.
- Q: `POST /attendance` used to apply a correction immediately. It now returns a pending approval. What must the administrative screen do differently? → A: **Show it as awaiting approval, and not show the day as corrected.** This is the one behavioural change on an existing screen. An interface that reports success on submission is telling the administrator a decision has been taken that has not, and the day they were trying to fix still reads wrong to everyone else.
- Q: "It should also reflect in the attendance of the affected employee" — a notification, or something on the record? → A: **On the record, permanently.** The employee's own attendance shows the modified day carrying who changed it, when, from what to what, and why. Not a notification: a notification is read once and cleared, and this is a property of the day for as long as the day exists.
- Q: Is the employee-facing version held to the mobile standard? → A: **Yes — attendance viewing is on Principle VI's closed mobile-critical list.** It is not a desktop screen that must merely survive 320px; the person whose pay is affected by a change is the one most likely to be reading it on a phone.
- Q: Does the employee see the reason the change was made? → A: **Yes, where one was stated.** Showing that something happened to their attendance while withholding why is worse than not showing it at all.

### Session 2026-09-29

Raised against the client's re-stated requirement list, item 7: *"Every critical action across the
system requires Director-level approval before execution."* The backend answer (016 backend FR-018,
FR-018a–c) is a named, configurable set rather than a literal every-action gate, decided on
2026-09-29. That answer only works if somebody can see the set, and nothing on this side showed it.

- Q: Where does the director-final set live in the interface? → A: **A settings surface of its own, listing every action type the system knows of.** The client asked for "every critical action" and is getting a list instead. They are entitled to read that list and say what is missing from it, and an answer they cannot see is indistinguishable from no answer.
- Q: Should editing the set behave like any other setting? → A: **No — it is itself an approval.** Backend FR-018b makes changing the set director-final, because whoever can remove payment release from the list can then release a payment. The screen must present the edit as submitted for approval, not as saved.

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
   control is offered and the reason given is insufficient authority.
7. **Given** the user already decided on this item at an earlier level, **When** it reaches a level
   they also hold, **Then** the control is inert and says they have already decided — not that they
   lack permission.

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
6. **Given** a day of the employee's attendance that was modified by an administrator, **When** that
   **employee** opens their own attendance, **Then** the day shows that it was modified, by whom,
   when, from what to what, and why where a reason was given.
7. **Given** an employee's own attendance on a phone at 320px, **When** a modified day is viewed,
   **Then** the modification is reachable rather than truncated away — attendance viewing is
   mobile-critical under Principle VI.
8. **Given** an administrator submits an attendance correction, **When** the response returns,
   **Then** the screen shows it as **awaiting approval** rather than as applied, and the day does not
   yet read as corrected.

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

---

### User Story 4 - Seeing which actions the director must sign (Priority: P3)

An administrator opens a settings screen and reads every action type the system knows of, each marked
as needing the director's final approval or not. Changing a mark is submitted for the director's
approval rather than saved, and the screen says so before anything is submitted.

**Why this priority**: P3, matching the backend's US5. The set is buildable and configurable without
this screen; what the screen adds is the client being able to answer item 7 for themselves rather than
being told what the answer is. It depends on US1's control, since an edit here enters a chain.

**Independent Test**: Open the screen, change one action type's mark, and confirm the change is shown
as awaiting the director rather than applied, with the previous state still in force.

**Acceptance Scenarios**:

1. **Given** the settings screen, **When** it is opened, **Then** every action type the system knows of
   is listed, each showing whether it needs the director's final approval.
2. **Given** an action type, **When** its mark is changed, **Then** the change is presented as
   submitted for the director's approval, and the list still shows the mark currently in force.
3. **Given** a submitted change, **When** the director approves it, **Then** the list shows the new
   mark and who approved it.
4. **Given** a user who may not configure approvals, **When** the screen is opened, **Then** the list
   is readable and no control to change a mark is rendered (Principle-consistent with hiding rather
   than disabling).
5. **Given** a pending change, **When** the screen is opened by anybody, **Then** the pending change is
   visible alongside the mark in force, so two people do not submit the same edit.

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
- The director-final list is long enough that the action types a reader cares about are hard to find.
- A change to the list is pending while a second person opens the same screen.
- An action type the system knows of that no chain is configured for at all — it must not read as
  "not director-final" when the truth is that nothing approves it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Action/Review control MUST be a single shared component used by every module, so
  that its placement and behaviour cannot diverge between them.
- **FR-002**: The control MUST offer approve, reject and return when the item awaits the current user.
- **FR-003**: The control MUST render inert, naming the awaited approver, when the item awaits
  somebody else.
- **FR-003a**: The control MUST distinguish *why* it is inert. At minimum: awaiting another person,
  already decided by this user at an earlier level, and insufficient authority are three different
  states with three different remedies, and conflating them into "no permission" sends people to an
  administrator who cannot help them.
- **FR-003b**: Where a level's authority is described to the user, it MUST use the person's name or
  the configured slot label supplied by the backend, and MUST NOT hardcode a role name.
- **FR-004**: The control MUST require a reason for reject and return before submitting.
- **FR-005**: The control MUST prevent double submission and MUST indicate work in progress.
- **FR-006**: The control MUST preserve user-entered text when a submission fails, and MUST allow
  retry without retyping.
- **FR-007**: A failed decision MUST NOT sign the user out or discard the screen they were on.
- **FR-008**: Every reviewable record MUST display its latest action, actor and time without
  navigation.
- **FR-009**: Users MUST be able to open a record's full decision history from the record.
- **FR-009a**: An employee's own attendance MUST show, for every modified day, that it was modified,
  by whom, when, from what to what, and the stated reason where one was given
  (Clarifications, 2026-09-16). This is the client's *"it should also reflect in the attendance of the
  affected employee"*, and it is a property of the day rather than a notification — it MUST NOT be
  dismissable or clearable.
- **FR-009b**: The employee-facing modification display is **mobile-critical** under Principle VI —
  attendance viewing is on the closed list — and MUST therefore be reachable at 320px rather than
  merely not breaking there. The person most affected by a change to their attendance is the one most
  likely to be looking at it on a phone.
- **FR-009c**: An attendance correction submitted by an administrator MUST be presented as **awaiting
  approval**, not as applied, and the corrected day MUST NOT read as corrected until the chain
  completes. The correction now enters the approval chain (backend FR-012), and a screen that shows it
  as done is telling the administrator a decision has been taken that has not.
- **FR-009d**: The administrative attendance modifications view MUST allow filtering by the person who
  made the change, not only by employee and date. An audit that cannot ask "what did this person
  change" answers the wrong half of the question.
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
- **FR-017**: A settings surface MUST list every action type the system reports, each showing whether
  it requires the director's final approval, and MUST show an action type that has no chain configured
  as such rather than as not-final.
- **FR-018**: A change to an action type's mark MUST be presented as submitted for the director's
  approval, never as saved, and the mark currently in force MUST remain displayed until the change is
  approved.
- **FR-019**: A pending change to the set MUST be visible to every reader of the surface, alongside the
  mark in force.
- **FR-020**: For a user who may not configure approvals, the surface MUST render the list without any
  control to change a mark, hidden rather than disabled.

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
- **SC-006**: An administrator can state, from one screen and without asking a developer, exactly which
  action types require the director's final approval and which do not.
- **SC-007**: No change to the director-final set takes effect from this interface without the
  director's approval, verified by attempting one and confirming the previous mark still governs.

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

Both markers raised when this specification was written are answered and recorded under
Clarifications above. The client's re-stated requirement list re-opened two, reviewed on 2026-09-29:

- **RESOLVED 2026-10-02: the four are confirmed.** Payment release, payroll run approval,
  money-committing letters (work order, LOI, purchase order), and final settlement on exit. User Story
  4's screen still exists for exactly the reason it was written — the set is configurable and the
  client can read and amend it — but it now renders a confirmed list rather than a proposal.
- **RESOLVED 2026-10-02: Principle VI stands; two screens join the mobile-critical list.** The client
  chose to keep desktop-first rather than widen the principle, and named **the approvals queue** and
  **site attendance review and corrections** as the screens that must work properly on a phone.

  That is a **MINOR constitution amendment** — two additions to a closed list — not the MAJOR bump that
  widening the rule would have been. It still cannot be made by this specification: Principle VI is
  NON-NEGOTIABLE, so the constitution has to be amended on its own terms before the two screens are
  built to that standard. **This is now the gating step for item 22**, and it is a document change
  rather than development.

  The approvals queue earns it twice over: items 7 and 21 put a Director in the path of payment
  releases and payroll runs, and a Director who can only approve at a desk is why approvals sit for
  days. Attendance review pairs with the punch refusal — the person who fixes a wrongly refused day is
  standing on a site. Plant logbook, fuel entry, material indents and inventory issue were offered and
  not chosen, so they keep the 320px floor and nothing stronger.

**Migration order**, settled: attendance exceptions first. It is the client's first note, the
exceptions are already detected and already have a resolution path to replace, and each one is a
paid or unpaid day — so the control earns its place immediately. It is also the smallest surface,
which is the point: the shared component's shape gets settled on one screen before five more modules
depend on it.

The remaining modules follow in whatever order planning finds cheapest, except that **payroll runs
should not be second**. It is the most complex chain and the one where a flaw in the shared component
costs most; it should be migrated once the component has survived a simpler module.
