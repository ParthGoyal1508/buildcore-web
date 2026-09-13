# Feature Specification: Fuel Accountability and Per-Employee Geofence (Web)

**Feature Branch**: `020-fuel-accountability-geofence`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Client requirements spreadsheet, Notes 14 and 16. Backend counterpart:
`buildcore-api/specs/020-fuel-accountability-geofence-backend`.

**Scope**: The review screen where a fuel variance becomes a deduction, the assignment of locations
to employees, and what an employee sees when their punch is refused. Detection, calculation and
enforcement belong to the backend spec.

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

### User Story 3 - Knowing why a punch was refused (Priority: P2)

An employee whose punch was refused for location sees that it was refused, why, and that it has gone
for review — rather than a day that silently does not exist.

**Why this priority**: P2 in build order, but it is the difference between a control and a
grievance. A worker who punched, was refused, and was told nothing will assume the system ate their
attendance, and they will be right.

**Acceptance Scenarios**:

1. **Given** a punch refused for location, **When** the employee opens their attendance, **Then** the
   refusal and its reason are visible.
2. **Given** such a refusal, **When** it is under review, **Then** the employee can see it is pending.
3. **Given** a refusal later approved, **When** the employee views the day, **Then** it shows as
   present.
4. **Given** a refusal at the moment of punching, **When** it happens, **Then** the worker is told on
   the spot, on the punch screen, not only later.

### Edge Cases

- GPS accuracy too poor to place the worker either inside or outside the fence — the screen must say
  that, not assert a refusal it cannot justify.
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
- **FR-012**: An employee MUST be able to see that their own punch was refused, why, and whether it
  is under review.
- **FR-013**: A refusal MUST be shown at the moment of punching, on the punch screen.
- **FR-014**: Where position accuracy is too poor to decide, the screen MUST say so rather than
  present a confident refusal.
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
- **SC-005**: 100% of location-refused punches are visible to the employee they belong to, with a
  reason.
- **SC-006**: A worker learns of a refusal within 2 seconds of punching, measured on a mid-range
  Android phone on a mobile network.

## Assumptions

- Fuel exceptions are reviewed at head office by somebody with commercial authority, not at site.
- Location assignment is done by HR or an administrator, not by the employee.
- The punch screen's existing offline queue behaviour is unchanged; a punch taken offline is
  evaluated when it syncs, and the worker is told then rather than at the moment of punching. This is
  a known weakening of FR-013 that offline working makes unavoidable, and it should be stated to
  workers rather than hidden.
- Review outcomes route into feature 016's approval chain where approval is required, rather than
  introducing a second review mechanism.
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
