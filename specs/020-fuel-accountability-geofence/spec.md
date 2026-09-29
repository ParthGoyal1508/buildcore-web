# Feature Specification: Fuel Accountability and Per-Employee Geofence (Web)

**Feature Branch**: `020-fuel-accountability-geofence`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Client requirements spreadsheet, Notes 14 and 16. Backend counterpart:
`buildcore-api/specs/020-fuel-accountability-geofence-backend`.

**Scope**: The review screen where a fuel variance becomes a deduction, the assignment of locations
to employees, and what an employee sees when their punch is refused. Detection, calculation and
enforcement belong to the backend spec.

## Clarifications

### Session 2026-09-16

The client restated note 16 as a **block**: *"Block attendance marking if location or photo
verification fails."* The backend's FR-013 now refuses such a punch and records nothing. User Story 3
below was written for the previous behaviour — a refusal that went for review — and every part of it
that assumed a reviewable record is now false.

- Q: US3 says the employee sees the refusal "and that it has gone for review". Under the block, nothing is recorded and nothing is reviewed. What do they see? → A: **The refusal at the moment of punching, and nothing in their attendance afterwards.** There is no record to render, so the day simply has no punch. The punch screen is the only place the refusal exists as far as that employee's attendance is concerned, which makes FR-013 — already written — carry the entire requirement rather than being the early half of it.
- Q: Then how does the worker find out later what happened, if they only see it once? → A: **A list of their own refused attempts, separate from attendance.** Not in the attendance view — putting it there would recreate the "refused day" the backend's FR-013a forbids every reader from seeing. A worker who was refused at 8am and is asking at 5pm needs somewhere to look, and it is a list of attempts, not a list of days.
- Q: The client names *photo* verification alongside location. Does the punch screen treat a face mismatch the same way? → A: **The same refusal, different words.** Both refuse the punch on the same terms, and the advice differs: a location refusal tells the worker where they must be, a photo refusal tells them to retake it. One outcome, two messages.
- Q: How does the screen distinguish "you are not where you should be" from "your phone cannot tell where you are"? → A: **Two different messages, because they call for different actions.** FR-014 already required this; the backend now returns a distinct code for it. Telling a worker standing in the right place to move is the specific failure both requirements exist to prevent.
- Q: The backend needs the device's reported position accuracy to judge a punch fairly. Does the punch screen have it? → A: **It must send it.** The geolocation API already reports it and the punch request has never carried it. Without it every poor fix is judged on its raw point, which under a block means refusing honest workers — so this is a prerequisite of the block being fair, not a refinement of it.
- Q: A worker genuinely worked a day the system refused. What does the interface offer them? → A: **Nothing directly — their supervisor raises a correction.** That correction is feature 016's, and the punch screen's job is to make the worker understand they must ask for one rather than assume the day was captured. Stated here because "nothing" is a deliberate answer and reads like an omission.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deciding what a thirsty machine costs, and who pays (Priority: P1)

A reviewer opens the fuel exceptions and sees each machine that has consumed beyond its benchmark,
with its actual average, its benchmark, and the shortfall in both litres and rupees. They decide:
deduct from the hirer, recover from the operator, both, or dismiss it. Whatever they choose, the
evidence and the reason travel with it.

**Why this priority**: The alerts already exist and nothing consumes them. This screen is what turns
detection into recovery, which is what the client asked for.

**Independent Test**: With fuel entries breaching a benchmark, open the review, raise a hire
deduction, and confirm it reaches the hire bill with its evidence attached.

**Acceptance Scenarios**:

1. **Given** machines breaching their benchmark, **When** the review screen is opened, **Then** each
   appears with actual average, benchmark, and shortfall in fuel and money.
2. **Given** an exception, **When** it is opened, **Then** the fuel entries comprising it are listed.
3. **Given** an exception on a hired machine, **When** a hire deduction is raised, **Then** it is
   confirmed and becomes visible on that hire bill.
4. **Given** an exception on an owned machine, **When** it is reviewed, **Then** no hire deduction is
   offered.
5. **Given** an exception attributed to an operator, **When** a recovery is raised, **Then** the
   operator must be chosen explicitly where several operated the machine.
6. **Given** a dismissal, **When** it is submitted without a reason, **Then** it is refused.
7. **Given** a raised recovery, **When** the screen is viewed again, **Then** its approval state is
   visible — a recovery is not applied until approved.

---

### User Story 2 - Telling an employee where they may punch (Priority: P1)

An administrator assigns an employee the location their attendance is validated against, and can
mark genuinely mobile employees exempt. The assignment history is visible, so a transfer is
explicable months later.

**Why this priority**: Note 16 says geofencing is required *"must"*. Assignment is the part a human
does, and doing it wrong denies people their pay.

**Acceptance Scenarios**:

1. **Given** an employee, **When** their record is opened, **Then** their assigned location and its
   effective date are shown.
2. **Given** an assignment change, **When** it is saved, **Then** an effective date is required, and
   the previous assignment remains visible in history.
3. **Given** an employee whose work is genuinely mobile, **When** they are marked exempt, **Then** the
   exemption, its author and its reason are recorded and visible.
4. **Given** employees in bulk, **When** a site's staff are assigned together, **Then** it can be done
   without opening each employee.
5. **Given** an employee with no assignment, **When** their record is viewed, **Then** the fallback
   behaviour is stated on screen rather than left to be inferred.

---

### User Story 3 - Knowing why a punch was refused (Priority: P1)

An employee whose punch is refused — for location or for the photo — is told **at the moment they
punch**, in words that say what to do about it. Nothing is recorded, so their attendance shows no
punch for that day at all; what they get instead is a list of their own refused attempts, and the
knowledge that a day they genuinely worked has to be corrected by their supervisor.

**Why this priority**: raised from P2 to **P1** on 2026-09-16. Under the previous behaviour a refused
punch still reached a reviewer, so a worker told nothing would eventually be found by the system.
Under the block there is no record and no review, so the message on the punch screen is the *only*
thing standing between a refusal and a worker who believes they were marked present. It is no longer
the difference between a control and a grievance; it is the difference between a refusal and a silently
unpaid day.

**Acceptance Scenarios**:

1. **Given** a punch refused for location, **When** the refusal is returned, **Then** the worker is
   told on the punch screen, at that moment, why it was refused and what to do.
2. **Given** a punch refused because the photo did not match, **When** the refusal is returned,
   **Then** the worker is told to retake the photo — a different message from the location one,
   because the action differs.
3. **Given** a position too imprecise to judge, **When** the punch is attempted, **Then** the worker
   is told their phone cannot establish where they are — **not** that they are in the wrong place.
4. **Given** any refused punch, **When** the employee later opens their attendance, **Then** the day
   shows **no punch** — not a refused one, not a pending one.
5. **Given** the same employee, **When** they open their own list of refused attempts, **Then** the
   refusal appears there with its time and reason.
6. **Given** a day the employee genuinely worked but could not punch for, **When** they look for a way
   to fix it, **Then** the interface tells them to ask their supervisor for a correction rather than
   offering them one.
7. **Given** a punch taken offline and refused on sync, **When** the refusal arrives, **Then** the
   worker is told then — which is later than the moment of punching, and is the known weakening
   offline working makes unavoidable.

### Edge Cases

- GPS accuracy too poor to place the worker either inside or outside the fence — the screen must say
  that, not assert a refusal it cannot justify. Under the block this is the difference between a
  worker retrying from ten metres away and a worker walking off a site they were standing on.
- A worker refused three times in a row, each time told to retake the photo. The screen must not
  simply repeat itself; at some point the honest answer is to ask their supervisor.
- A punch-out refused after an accepted punch-in, leaving the day half-recorded from the worker's
  point of view.
- An employee assigned to a site they have been transferred away from.
- A machine with several operators in the period and no clear attribution.
- A fuel benchmark so wrong that every machine of a category appears as an exception; the reviewer
  needs to recognise that pattern rather than raising fifty deductions.
- An operator recovery raised against an employee who has since exited.
- The punch screen offline, where the refusal cannot be evaluated until the punch syncs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The fuel exception review MUST list machines breaching their benchmark with actual
  average, benchmark, and shortfall in both fuel and money.
- **FR-002**: An exception MUST open to the fuel entries comprising it.
- **FR-003**: The reviewer MUST be able to raise a hire deduction, an operator recovery, both, or
  dismiss — with a reason required in every case.
- **FR-004**: A hire deduction MUST NOT be offered for an owned machine.
- **FR-005**: Where several operators ran a machine in the period, the responsible one MUST be chosen
  explicitly rather than defaulted.
- **FR-006**: A raised recovery MUST show its approval state, and MUST make clear it is not applied
  until approved.
- **FR-007**: An employee's assigned location and its effective date MUST be visible on their record.
- **FR-008**: Changing an assignment MUST require an effective date and MUST preserve prior
  assignments as history.
- **FR-009**: A mobile exemption MUST be settable, and MUST display its author and reason.
- **FR-010**: Assignment MUST be possible in bulk for a site's staff.
- **FR-011**: Where an employee has no assignment, the fallback behaviour MUST be stated on screen.
- **FR-012**: An employee MUST be able to see their own refused attempts — each with its time and
  reason — in a list **separate from their attendance** (Clarifications, 2026-09-16). It MUST NOT
  appear as a day in the attendance view: the backend's FR-013a requires a refused day to read as no
  punch to every reader, and rendering it as a day would be this interface breaking that guarantee.
- **FR-013**: A refusal MUST be shown at the moment of punching, on the punch screen. This requirement
  now carries the whole of the employee's knowledge of the refusal rather than being its early half,
  because nothing is recorded for them to find later.
- **FR-013a**: The refusal message MUST state what the worker should do, and MUST differ by cause: a
  location refusal names where they must be, a photo refusal asks them to retake it. One outcome, two
  messages.
- **FR-013b**: Where a day was genuinely worked but no punch was accepted, the interface MUST direct
  the employee to request a supervisor's correction, and MUST NOT offer them a way to mark the day
  themselves.
- **FR-014**: Where position accuracy is too poor to decide, the screen MUST say so rather than
  present a confident refusal, and MUST NOT tell a worker standing inside their fence that they are
  outside it.
- **FR-014a**: The punch request MUST include the device's reported position accuracy. Without it the
  server judges every fix on its raw point, which under a hard refusal means refusing workers whose
  phone could not do better — so this is a precondition of the block being fair rather than an
  enhancement.
- **FR-014b**: Where the device reports no accuracy at all, the screen MUST still permit the attempt.
  Refusing to submit would turn a missing browser capability into a lost day.
- **FR-014c**: The punch refusal surfaces are **mobile-critical** under Principle VI — punch in/out is
  on the closed list — and MUST therefore meet the one-handed, 44px and 320px requirements rather than
  the desktop breakage floor. A refusal message a worker cannot read on the phone they punched with is
  not a refusal message.
- **FR-015**: All access MUST go through the typed API modules (Principle V); copy MUST live in the
  constants module (Principle III); no inline styling (Principle II).

### Non-Functional Requirements

- **NFR-001** *(Note 25)*: The punch screen and the employee's own attendance view are already
  mobile-critical under Principle VI. FR-012 to FR-014 MUST work at 320px, one-handed, on Android and
  iOS. This is a regression guard on an existing obligation, not new scope.
- **NFR-002**: The fuel exception review is a desktop surface and is not claimed as mobile.
- **NFR-003**: A punch refusal MUST be communicated within 2 seconds of the punch attempt, so the
  worker learns of it while still standing where they punched.

### Key Entities

- **Fuel Exception (view)**: A machine's overconsumption in a period — averages, shortfall, the
  entries behind it, and its review outcome.
- **Employee Location Assignment (view)**: The location an employee punches against, its effective
  date, its history, and any mobile exemption.
- **Punch Refusal (view)**: What the employee is told — that it was refused, why, and its review
  state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every fuel variance alert reaches a recorded review outcome; none sit unreviewed.
- **SC-002**: A reviewer can go from opening an exception to raising a deduction with evidence in
  under 60 seconds.
- **SC-003**: No recovery is raised against an operator without one being explicitly named.
- **SC-004**: Every employee has either an assigned location or an explicit exemption, verified
  across the register.
- **SC-005**: 100% of refused punches — location and photo alike — are reported to the employee at
  the moment of the attempt, with a cause-specific message, and appear in their own list of refused
  attempts afterwards.
- **SC-005a**: No refused punch appears as a day in any attendance view, verified for the employee's
  own screens as well as the administrative ones.
- **SC-005b**: Every punch request carries the device's reported accuracy where the browser supplies
  one, verified on a real device rather than asserted.
- **SC-006**: A worker learns of a refusal within 2 seconds of punching, measured on a mid-range
  Android phone on a mobile network.

## Assumptions

- Fuel exceptions are reviewed at head office by somebody with commercial authority, not at site.
- Location assignment is done by HR or an administrator, not by the employee.
- The punch screen's existing offline queue behaviour is unchanged; a punch taken offline is
  evaluated when it syncs, and the worker is told then rather than at the moment of punching. This is
  a known weakening of FR-013 that offline working makes unavoidable, and it should be stated to
  workers rather than hidden.
- Fuel review outcomes route into feature 016's approval chain where approval is required, rather
  than introducing a second review mechanism. **Punch refusals no longer route anywhere** — there is
  nothing to review (backend FR-013, Clarifications 2026-09-16). What reaches 016 is the supervisor's
  manual attendance correction, which belongs to that feature's screens and not to these.
- No test framework is installed (constitution `TODO(TESTING_STANDARD)`); verification is lint,
  type-check, build and manual passes. **No test-file tasks may be generated.**

### Needing the client's decision

- **[NEEDS CLARIFICATION: what does an employee with no assigned location see?]** Carried from the
  backend spec, because the screen must say something. If the fallback is the site geofence, that is
  what FR-011 states; if the client's *"must"* means refusal, every existing employee is affected the
  day this ships.
- **[NEEDS CLARIFICATION: should a worker be able to appeal a refusal from the punch screen?]** Being
  told "refused, and there is nothing you can do here" invites people to stop using the system. An
  appeal path costs little and may prevent that, but it is the client's call whether site workers
  may raise one directly.
