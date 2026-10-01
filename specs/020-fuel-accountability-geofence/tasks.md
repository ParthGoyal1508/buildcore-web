---

description: "Task list for 020 Fuel Accountability and Per-Employee Geofence (web)"
---

# Tasks: Fuel Accountability and Per-Employee Geofence (web)

**Input**: Design documents from `specs/020-fuel-accountability-geofence/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (clarified 2026-10-01),
[contracts/punch-and-fuel.md](./contracts/punch-and-fuel.md), [quickstart.md](./quickstart.md)

**Tests**: **NONE.** No test framework is installed (constitution `TODO(TESTING_STANDARD)`). No task
below creates a test file. Verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus
the manual passes in quickstart.md.

**⚠️ Only Phases 1 and 2 are buildable today.** The backend's Phases 1–2 are committed; its Phases
3–7 are unbuilt, and **its Phase 3 is gated on a client conversation, not on code** — the client has
to see how often the hard block would fire before it is built. Phases 3–6 below inherit that gate.
Starting them early would build the interface for a decision that is deliberately still reversible.

**Mobile is non-negotiable here.** FR-014c names the punch surfaces mobile-critical under
Principle VI. 320px is a gate on every punch task, not a later pass.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Send the accuracy — SHIPPABLE TODAY

**Goal**: FR-014a, FR-014b. **Independent test**: quickstart Scenario 1.

**Why first and alone**: the server can already be fair about a poor GPS fix and the web never tells
it there was one. Today that costs nothing because a failing check still records an exception. The
moment the hard refusal lands it costs people their pay — every punch judged on its raw point, and
honest workers on site with a bad fix refused. The spec calls this "a prerequisite of the block being
fair, not a refinement of it".

- [ ] T001 [P] [US3] Add `PUNCH_COPY` to `app/lib/constants.ts` — the offline notice and the
      accuracy-unavailable wording (Principle III)
- [ ] T002 [US3] Add `accuracyMeters?: number` to the punch request type in
      `app/lib/api/my-workspace.ts`. **`accuracyMeters`, American and singular** — the muster
      endpoint and `offline-queue.ts` both use `accuracyMetres`, and both are correct where they are
- [ ] T003 [US3] Note beside T002 that a misspelt key fails **silently**: `@IsOptional()` on the
      server ignores an unrecognised field, the punch returns 201, and it is judged on its raw point
      exactly as if accuracy had never been sent. Nothing errors and nothing logs. This comment is
      what stops somebody "tidying" the spelling to match the muster endpoint
- [ ] T004 [US3] Capture `GeolocationPosition.coords.accuracy` in `app/ui/my/punch-clock.tsx` and
      send it. The browser already reports it; the screen currently discards it
- [ ] T005 [US3] Where the device reports no accuracy, **omit the field** (FR-014b). Do not send `0`
      — zero asserts a perfect fix, which is the opposite of "unknown", and under the hard refusal it
      would deny the worker the allowance they are entitled to
- [ ] T006 [US3] Verification: read the request body in the Network tab and confirm the exact key and
      a plausible value (quickstart Scenario 1). A 201 proves nothing here — that is the point of T003
- [ ] T007 [US3] Verification at 320px (Principle VI)

---

## Phase 2: Punching requires connectivity

**Goal**: implements the decision of 2026-10-01. **Independent test**: quickstart Scenario 2.
Independent of the backend entirely.

A queued punch cannot deliver FR-013's refusal at the moment of punching — the worker sees a success
at 8am and the refusal arrives at 5pm. The exchange is deliberate: a refusal seen immediately, for a
success that was not one.

- [ ] T008 [US3] Retire the punch path of `app/lib/offline-queue.ts`: stop enqueuing punches, and
      remove the punch drain from `app/my/layout.tsx`
- [ ] T009 [US3] **Keep the muster store.** `drainMusters` and `MusterQueueEntry` are feature 013's,
      serve a different act, and were a separate object store for exactly this reason. Note it beside
      the removal so a later tidy-up does not take both
- [ ] T010 [US3] Decide and record what happens to punches **already queued** on a device when this
      ships. They were captured under the old promise; draining them once on upgrade and then
      retiring the path is the only option that does not silently discard a worker's day
- [ ] T011 [US3] On the punch screen with no connectivity, state that a punch needs a connection and
      offer no punch action. It must read as a **condition, not a malfunction** — a worker who thinks
      the app is broken stops trusting it
- [ ] T012 [US3] Name the recovery in that notice: a day genuinely worked but not punched is fixed by
      a supervisor-raised correction. "Nothing you can do" is what makes people abandon the system;
      this is the wording that prevents it (FR-013b)
- [ ] T013 [US3] Verification: quickstart Scenario 2 in full — **including step 4**, which opens the
      muster offline and confirms it still queues. That step exists to catch retiring too much
- [ ] T014 [US3] Verification at 320px

---

## Phase 3: Refusal messaging ⚠️ GATED

**Goal**: FR-013, FR-013a, FR-013b, FR-014. **Independent test**: quickstart Scenario 3.

**Do not start before the client has seen the refusal-rate figure.** The backend's
`PunchRefusalsService.rateSince` produces it and its T016 is "a client obligation, not a code task".
Its own tasks say: *"Nothing in Phase 3 should be built until that conversation has happened."*

- [ ] T015 [US3] Add the three refusal codes to `app/lib/constants.ts` as a closed union:
      `PUNCH_REFUSED_LOCATION`, `PUNCH_REFUSED_UNLOCATABLE`, `PUNCH_REFUSED_FACE`
- [ ] T016 [US3] Create `app/lib/punch-refusal.ts` mapping code → message, as a pure function
      (Principle I). Not a chain of conditionals inside the punch component
- [ ] T017 [US3] Write the three messages as three **actions**, in `constants.ts` where they can be
      reviewed as a set: where to be / phone cannot place you / retake the photo. **Never render the
      server's prose as the whole message.** `LOCATION` and `UNLOCATABLE` are both "we could not
      accept this for location reasons", and telling a worker standing in the right place to move is
      the exact failure FR-014 exists to prevent
- [ ] T018 [US3] Display the refusal on the punch screen at the moment of the attempt. This is the
      **only** place the refusal exists as far as that employee's attendance is concerned
- [ ] T019 [US3] The repeat case: a worker refused three times running must not be told the same
      thing a third time. The escalation to "ask your supervisor" lives in the screen's state, not in
      the message table — no single message solves it
- [ ] T020 [US3] **Do not offer to show the failed photo.** None is retained on a face refusal
      (backend plan D20): a mismatch means the system could not establish whose face it is, and
      keeping an unattributed biometric against a named employee is worse than the record it replaces
- [ ] T021 [US3] **Now** re-label `app/ui/my/punch-exceptions.tsx` as covering past flagged punches.
      In this phase and not earlier: until the backend's Phase 3 ships, `PunchResultDto` still returns
      201 "because the punch is recorded either way" and new exceptions are still being created, so
      re-labelling it today would be a different lie. Delete nothing — an exception still travelling
      the chain needs the one surface in the product belonging to the person who raised it
- [ ] T022 [US3] Confirm no refusal appears in the attendance view. Putting one there would recreate
      the "refused day" the backend forbids every reader from seeing
- [ ] T023 [US3] Verification: quickstart Scenario 3, **including the inside-the-fence-but-inaccurate
      case**, which is the one that distinguishes the two location codes
- [ ] T024 [US3] Verification at 320px

---

## Phase 4: The worker's refused attempts ⚠️ GATED on backend Phase 3

**Goal**: FR-012. A list of **attempts**, not of days.

- [ ] T025 [US3] Add the refused-attempts read to `app/lib/api/my-workspace.ts`
- [ ] T026 [US3] Create `app/ui/my/refused-attempts.tsx` — each attempt with its time and reason
- [ ] T027 [US3] Keep it **outside** the attendance view. A worker refused at 8am and asking at 5pm
      needs somewhere to look, and that somewhere is not the attendance calendar
- [ ] T028 [US3] Verification: quickstart Scenario 4, including confirming the day shows no punch
- [ ] T029 [US3] Verification at 320px

---

## Phase 5: Location assignment ⚠️ GATED on backend Phase 4 (0 of 12)

**Goal**: FR-007 – FR-011. **Independent test**: quickstart Scenario 5.

- [ ] T030 [US2] Add location assignment, history and exemption reads/writes to
      `app/lib/api/hr-payroll.ts`
- [ ] T031 [US2] Create `app/ui/hr/location-assignment.tsx` showing the assigned location and its
      effective date on the employee record (FR-007)
- [ ] T032 [US2] Require an effective date on change, and keep prior assignments visible (FR-008).
      A transfer has to be explicable months later
- [ ] T033 [US2] Mobility exemption with author and reason displayed (FR-009)
- [ ] T034 [US2] State on the exemption control that it covers **location only, never the face
      check** — mobility says where a person legitimately works; the face check says who is holding
      the phone (backend Clarifications, 2026-09-16)
- [ ] T035 [US2] Bulk assignment for a site's staff (FR-010)
- [ ] T036 [US2] Where an employee has no assignment, **state the fallback on screen** (FR-011):
      they are validated against their site's geofence, as before. Not a warning — no employee carries
      an individual assignment on the day this ships, so this is the normal case, and styling it as a
      problem would mark every employee as misconfigured
- [ ] T037 [US2] Verification: quickstart Scenario 5

---

## Phase 6: Fuel exception review ⚠️ GATED on backend Phases 5–6 (0 of 27)

**Goal**: FR-001 – FR-006. **Independent test**: quickstart Scenario 6.

- [ ] T038 [US1] Add fuel exceptions, hire deductions and operator recoveries to
      `app/lib/api/plant.ts`. `fuelBenchmark` and `fuelVarianceThresholdPercent` are already typed
      on equipment — extend, do not re-declare
- [ ] T039 [US1] Create `app/ui/plant/fuel-exceptions.tsx` listing each breaching machine with actual
      average, benchmark, and shortfall in **litres and rupees** (FR-001)
- [ ] T040 [US1] An exception opens to the fuel entries comprising it (FR-002)
- [ ] T041 [US1] Offer hire deduction, operator recovery, both, or dismiss (FR-003)
- [ ] T042 [US1] **No hire deduction for an owned machine** (FR-004) — there is no hirer to deduct
      from, and offering it invites a figure nobody can collect
- [ ] T043 [US1] Where several operators ran the machine, require the responsible one to be chosen
      explicitly (FR-005). No default — a defaulted attribution is a recovery raised against whoever
      happened to be first in a list
- [ ] T044 [US1] A dismissal without a reason is refused (US1 scenario 6)
- [ ] T045 [US1] A raised recovery shows its approval state and reads as **proposed, not applied**
      (FR-006)
- [ ] T046 [US1] **The recovery cap is an open client question** (backend Phase 7, 0 of 6). Indian
      wage law constrains what may be deducted from wages. Until it is answered, display a raised
      recovery without implying a figure will reach a payslip
- [ ] T047 [US1] Help the reviewer recognise the bad-benchmark pattern: a benchmark so wrong that
      every machine of a category appears as an exception needs to read as *the benchmark is wrong*,
      not as fifty deductions to raise (spec edge case)
- [ ] T048 [US1] Verification: quickstart Scenario 6

---

## Phase 7: Verification

- [ ] T049 SC checks for US1 and US2 once their phases are unblocked
- [ ] T050 Every punch surface at 320px (Principle VI, FR-014c) — a gate, not a polish pass
- [ ] T051 Record each pass in this file beside its task. A verification whose result lives only in
      a closed terminal is not a verification

---

## Dependencies & Execution Order

```
Phase 1 (accuracy)      — no dependency. SHIP NOW
Phase 2 (connectivity)  — no dependency. SHIP NOW
                          ↓
backend T016 (client sees the refusal rate)  ← NOT A CODE TASK
                          ↓
backend Phase 3 ──> Phase 3 (messages) ──> Phase 4 (refused attempts)
backend Phase 4 ──> Phase 5 (location assignment)
backend Phases 5-6 ──> Phase 6 (fuel review)
                          ↓
                       Phase 7
```

### Parallel opportunities

- T001 and T002 together
- Phases 5 and 6 are independent of each other and of Phases 3–4; whichever backend phase lands
  first can proceed

## MVP scope

**Phases 1 and 2, and they are worth shipping alone.** Together they make the punch request honest
about its uncertainty and stop promising a worker a success that has not happened. Neither waits on
anything.

## Notes

- 51 tasks. 14 are buildable today (Phases 1–2); 37 are gated on backend work, and 10 of those on a
  client conversation rather than on code.
- The spec was amended on 2026-10-01: US3 scenario 7, one assumption and one edge case all assumed
  offline punching and were reversed.
