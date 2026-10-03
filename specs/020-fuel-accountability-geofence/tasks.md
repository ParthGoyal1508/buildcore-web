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

## Phase 1: Send the accuracy — SHIPPABLE TODAY ✅ implemented 2026-10-01

**Goal**: FR-014a, FR-014b. **Independent test**: quickstart Scenario 1.

**Why first and alone**: the server can already be fair about a poor GPS fix and the web never tells
it there was one. Today that costs nothing because a failing check still records an exception. The
moment the hard refusal lands it costs people their pay — every punch judged on its raw point, and
honest workers on site with a bad fix refused. The spec calls this "a prerequisite of the block being
fair, not a refinement of it".

- [~] T001 [P] [US3] ~~Add `PUNCH_COPY` to `app/lib/constants.ts`~~ — **nothing to add in this
      phase.** Sending accuracy is silent: there is no message, and FR-014b's "still permit the
      attempt" is discharged by omitting a field rather than by saying anything. The offline notice
      this task anticipated belongs to Phase 2. Deferred rather than ticked, because adding unused
      constants to satisfy a task is worse than leaving the task open
- [X] T002 [US3] Added `accuracyMeters?: number` to `PunchInput` in `app/lib/api/my-workspace.ts`
- [X] T003 [US3] The silent-failure note is on the request body in `submitPunch`, where somebody
      tidying spellings would actually be looking — not on the interface
- [X] T004 [US3] `position.coords.accuracy` captured in `app/ui/my/punch-clock.tsx`
- [X] T005 [US3] `?? undefined`, so the field is omitted and never zeroed (FR-014b)
- [X] T005a [US3] **Not in the plan, and necessary**: the offline punch queue stores the accuracy at
      capture time, and the drain in `app/my/layout.tsx` sends it. A queued punch replayed without it
      would be judged on its raw point — the exact unfairness this phase removes, displaced by however
      long the phone was offline. No `DB_VERSION` bump: an object store holds no column list, so
      entries written before this field drain without one
- [X] T005b [US3] The development stand-in position sends **no** accuracy. It is a pair of
      coordinates somebody configured, not a fix any device reported, and inventing one would hand the
      backend a number with nothing behind it
- [ ] T006 [US3] Verification: read the request body in the Network tab and confirm the exact key and
      a plausible value (quickstart Scenario 1). A 201 proves nothing here — that is the point of T003.
      **Needs a browser and a device position; not run**
- [ ] T007 [US3] Verification at 320px (Principle VI). **Not run**

### Two defects this phase deliberately leaves, decided 2026-10-01

The browser has its **own** accuracy gate — `MAX_GPS_ACCURACY_METERS`, 100m, env-overridable — and
`assertAccurate` in `app/lib/location.ts` **throws before the request is sent**. It was kept, because
it genuinely serves the worker: "wait a moment for a better fix" beats a round trip that produces an
exception for an administrator to resolve by hand. Keeping it has two costs, recorded here rather than
discovered later:

- [ ] T007a [US3] **The company setting is capped at 100m by the browser.** The backend made
      `punchAccuracyMaxMetres` a per-company Super Admin setting precisely so the number could differ
      between an open site and a basement slab — and a Super Admin raising it above 100m currently has
      no effect, because the punch never leaves the device. Closing this means the punch screen reading
      the company's own threshold, which needs a backend read that exists in no plan yet
- [ ] T007b [US3] **The refusal-rate figure understates.** Backend Phase 2 measures how often the hard
      block *would* fire, and that measurement is what the client's decision rests on. Punches the
      browser rejects never reach it, so the figure is short by the count of worse-than-100m fixes —
      which are among the most likely to be refused as unlocatable. **State this alongside the figure
      when it is put to the client**, rather than presenting it as a complete count

---

## Phase 2: Punching requires connectivity

**Goal**: implements the decision of 2026-10-01. **Independent test**: quickstart Scenario 2.
Independent of the backend entirely.

A queued punch cannot deliver FR-013's refusal at the moment of punching — the worker sees a success
at 8am and the refusal arrives at 5pm. The exchange is deliberate: a refusal seen immediately, for a
success that was not one.

- [X] T008 [US3] Retire the punch path of `app/lib/offline-queue.ts`: stop enqueuing punches, and
      remove the punch drain from `app/my/layout.tsx`

      Done 2026-10-03. `enqueue` is **deleted**, not left unused — re-introducing offline punching
      should cost a decision and a diff somebody reviews, not an import nobody noticed was still
      there. The punch screen's two queue paths went with it: the `!navigator.onLine` branch and the
      non-`ApiError` catch that queued on any network failure.

      **The drain stays in `app/my/layout.tsx`** — see T010, which decided it must. The task as
      written said to remove it; removing it would strand every punch already on a device.

- [X] T009 [US3] **Keep the muster store.** `drainMusters` and `MusterQueueEntry` are feature 013's,
      serve a different act, and were a separate object store for exactly this reason. Note it beside
      the removal so a later tidy-up does not take both

      Done. The module docblock now states it in the same paragraph as the retirement, so the next
      reader sees both facts at once: a muster is a supervisor recording other people's attendance
      somewhere with no signal, and nothing about it is refused at capture time. The two acts look
      alike and are not.

- [X] T009a [US3] **Coordinate the `DB_VERSION` change with feature 018's Phase 2a**

      Resolved 2026-10-03: **020 landed second and bumped nothing.** The coordination assumed this
      phase would remove an object store, which needs a bump. It does not — the store must survive
      so `drainQueue` can read what is in it (T010). `DB_VERSION` stays at 3, 018's number, and the
      comment in `offline-queue.ts` now records the resolution rather than the open question.

- [X] T010 [US3] Decide and record what happens to punches **already queued** on a device

      Decided: **flush once, never enqueue again.** They were captured under the promise that an
      offline punch would sync, and that promise was made to a worker who then went home. The three
      alternatives all discard somebody's day — dropping the store silently, dropping it with a
      notice they will not understand, or leaving them queued forever behind a drain nobody calls.

      The flush is the existing `online` listener, unchanged in mechanism and re-described in intent.
      A device that never queued a punch drains nothing and shows nothing, so this is invisible to
      everybody except the people it exists for, and it disappears on its own as devices empty.

- [X] T011 [US3] On the punch screen with no connectivity, state that a punch needs a connection and
      offer no punch action

      Done. Stated **before** the capture, not after: a worker who photographs themselves, waits
      through the locate, and only then learns there is no signal has been made to do work for
      nothing. Amber — the colour of "punched in since" — rather than red, because the application
      is not broken and must not look it.

      Connectivity is tracked in state and corrected by an effect, never read during render: this
      component is server-rendered, and seeding from `navigator.onLine` during render makes the
      markup disagree with the browser's. It starts `true`, so the wrong guess for one frame offers
      a punch rather than telling a worker with full signal they have none.

- [X] T012 [US3] Name the recovery in that notice (FR-013b)

      Done, as a second line under the first: a supervisor can raise a correction for the day, which
      is reviewed and then shows in the worker's attendance. Named rather than implied — "nothing
      you can do" is what makes people abandon a system.

- [ ] T013 [US3] **NOT RUN (no browser in this environment)** Verification: quickstart Scenario 2 in
      full — **including step 4**, which opens the muster offline and confirms it still queues. That
      step exists to catch retiring too much.

      Asserted in code rather than in a browser: `enqueueMuster`, `listQueuedMusters`,
      `drainMusters` and `MUSTER_STORE` are untouched, and `app/labour/muster/page.tsx` still calls
      them. That is not the same as having watched it queue, which is why this stays unticked.

- [ ] T014 [US3] **NOT RUN (no browser)** Verification at 320px

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

- [ ] T049 **SC-005b, verifiable today**: every punch request carries the device's reported accuracy
      where the browser supplies it, and omits it where the browser does not. This is Phase 1, and the
      one success criterion in this feature that waits on nothing
- [ ] T050 **NFR-003, measured**: a refusal reaches the worker within 2 seconds of the attempt. A
      figure, not an impression — a worker who thinks nothing happened punches again, and under the
      block every retry is another refusal
- [ ] T051 SC-001 and SC-002: a reviewer raises a hire deduction and an operator recovery, and each
      reaches its destination with its evidence (gated on Phases 5–6)
- [ ] T052 SC-003 and SC-004: an employee's assigned location and its history are visible, and a site's
      staff can be assigned in bulk without opening each employee (gated on Phase 5)
- [ ] T053 **SC-005 and SC-005a**: a refused punch appears nowhere as a day — checked in the employee's
      own attendance view, the administrator's attendance screen, and any absence or leave-balance
      figure derived from them. The backend's guarantee is structural; this verifies the interface did
      not reintroduce what the storage prevents
- [ ] T054 SC-006: a worker refused at 8am can find that refusal at 5pm, in a list of attempts
- [ ] T055 NFR-001: every punch surface at 320px (Principle VI, FR-014c) — a gate, not a polish pass.
      NFR-002 records the opposite, and is worth stating: the fuel review is a desktop surface and is
      not claimed as mobile
- [ ] T056 FR-015: every read through a typed API module, no component calling `fetch`, all copy in
      `constants.ts`. A recorded sweep — this is the requirement that decays silently
- [ ] T057 Record each pass in this file beside its task. A verification whose result lives only in a
      closed terminal is not a verification

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

- 58 tasks. 17 are buildable today (Phases 1–2 plus the two checks that cover them); 41 are gated on
  backend work, and 10 of those on a client conversation rather than on code.
- The spec was amended on 2026-10-01: US3 scenario 7, one assumption and one edge case all assumed
  offline punching and were reversed.
