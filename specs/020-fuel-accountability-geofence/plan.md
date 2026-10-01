# Implementation Plan: Fuel Accountability and Per-Employee Geofence (web)

**Branch**: `020-fuel-accountability-geofence` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification at `specs/020-fuel-accountability-geofence/spec.md`

**Backend counterpart**: `buildcore-api/specs/020-fuel-accountability-geofence-backend`.
**Phases 1–2 only are built.** Phases 3–7 are specified and tasked but unimplemented, and Phase 3
is gated on a client conversation that has not happened. This plan is organised around that fact.

## Summary

This feature's three user stories have almost nothing in common except that the client asked for
them together. What they now share is a dependency profile, and it is the thing that most shapes
this plan.

| Story | What the web builds | Backend state | Can it ship? |
| --- | --- | --- | --- |
| US3 (part) — send position accuracy | One field on the punch request | **Phase 1 built**, absent-safe | **Yes, today** |
| US3 (rest) — refusal messaging | Three messages, one per cause | Phase 3: **0 of 13**, and *gated* | No |
| US2 — location assignment | Employee record + bulk screen | Phase 4: 0 of 12 | No |
| US1 — fuel exception review | Review screen + consequences | Phases 5–6: 0 of 27 | No |

So **exactly one thing here is buildable today, and it happens to be the most valuable one.**

### Why sending accuracy comes first and alone

The backend's Phase 1 shipped the accuracy allowance: a punch counts as inside when its distance
falls within `radius + accuracy`, and the company's `punchAccuracyMaxMetres` decides when a fix is
too poor to judge at all. The allowance is **additive and absent-safe** (`?? 0`), so every client
shipped today omits the field and gets exactly today's verdict.

Which is precisely the problem. The server can be fair about a poor GPS fix, and the web never
tells it there was one. Today that costs nothing, because a failing check still records an
exception. The moment Phase 3 lands it costs people their pay: **every punch is judged on its raw
point, and honest workers standing on site with a bad fix are refused.**

The spec's own Clarifications say this is "a prerequisite of the block being fair, not a refinement
of it". Shipping it now, well before Phase 3, means the allowance is already arriving by the time
anything depends on it.

One detail that will otherwise cost an hour: the punch field is **`accuracyMeters`** — American
spelling, singular. `app/lib/offline-queue.ts` and the muster DTO both use `accuracyMetres`. The two
are genuinely different field names on two different endpoints, and nothing fails loudly if the
wrong one is sent: `@IsOptional()` means a misspelt key is simply ignored, and the punch is judged
on its raw point exactly as if the field had never been added.

### Why nothing else should be built yet

The backend's own task list says it plainly: *"Nothing in Phase 3 should be built until that
conversation has happened."*

Phase 2 exists to produce one number — how often the hard block **would** fire — because the client
accepted the block's cost without ever seeing that figure. `PunchRefusalsService.rateSince` produces
it. Its T016 is the one open task in Phase 2 and is "a client obligation, not a code task".

Building the web's refusal messaging ahead of that conversation would mean building the interface
for a decision that is still, deliberately, reversible — and would make it look settled.

## Three places in this spec assumed offline punching, and no longer may

**Decision of 2026-10-01: punching requires connectivity.**

The spec was written when a punch could be queued offline and evaluated on sync. Under the hard
refusal that produces the exact failure FR-013 exists to prevent, displaced in time: a worker punches
at 8am, sees a success, and the refusal arrives at 5pm when their phone reconnects. The spec called
this "the known weakening offline working makes unavoidable" — it is not unavoidable, it is a choice,
and it was chosen against.

| Where | Said | Now |
| --- | --- | --- |
| US3 Acceptance Scenario 7 | a punch refused on sync, worker told then | **Removed.** No punch is taken offline |
| Assumptions | "existing offline queue behaviour is unchanged" | **Reversed.** Punching requires connectivity |
| Edge Cases | "the punch screen offline, where the refusal cannot be evaluated" | **Replaced.** Offline means the screen says so and accepts nothing |

The recovery route is unchanged and already decided: a day that could not be punched is fixed by a
**supervisor-raised correction**, which is feature 016's chain. That was the backend's answer on
2026-09-16 to the same underlying question, so "require connectivity" and "correct it afterwards"
are one coherent story rather than two patches.

What this costs is real and should be stated to the client rather than buried: a worker at a site
with no signal cannot punch at all, where previously they could punch and sync later. The exchange
is a refusal they see immediately for a success that was not one.

**`app/lib/offline-queue.ts` keeps its muster store.** Only the punch path is retired. The muster
queue is feature 013's, serves a different act, and nothing in this decision touches it — which is
why the two were separate object stores in the first place.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 15 App Router
**Primary Dependencies**: TanStack Query, zod, react-hook-form, Tailwind
**Storage**: IndexedDB via `app/lib/offline-queue.ts` — **punch store retired**, muster store kept
**Testing**: No test framework is installed (constitution `TODO(TESTING_STANDARD)`). Verification is
lint, type-check, build and recorded manual passes. **No test-file tasks may be generated.**
**Target Platform**: The punch surfaces are **mobile-critical** under Principle VI (FR-014c) — a
worker punches on a phone at a gate, and this is the one surface where that is the primary case
**Project Type**: Web frontend consuming `buildcore-api`
**Performance Goals**: None specified beyond the punch feeling immediate
**Constraints**: Principle VI applies to every punch surface; copy to `constants.ts` (Principle III)

### What exists already

| Thing | Where | State |
| --- | --- | --- |
| Punch screen | `app/ui/my/punch-clock.tsx` | Sends lat/lng, **no accuracy** |
| Offline punch queue | `app/lib/offline-queue.ts`, drained by `app/my/layout.tsx` | To be retired (punch store only) |
| Worker's flagged punches | `app/ui/my/punch-exceptions.tsx` | **Still correct today** — see below |
| Fuel entry | `app/ui/plant/fuel-modal.tsx` | Entry only; no review surface |
| `fuelBenchmark`, `fuelVarianceThresholdPercent` | `app/lib/api/plant.ts` | Already typed on equipment |
| Employee record | `app/ui/hr/employee-detail-tabs.tsx` | No location assignment tab |

## Constitution Check

| Principle | How this plan complies |
| --- | --- |
| I Component-Based Architecture | Refusal-message selection is a pure function in `lib`, keyed by the server's code — not a chain of conditionals in the punch component |
| II No Inline Styling | Tailwind only |
| III Centralized Constants | Every refusal message in `constants.ts`, keyed by `PUNCH_REFUSED_*`. A message assembled in a component is a message nobody can review as a set |
| IV Type Safety | The three refusal codes as a closed union; `accuracyMeters` typed as optional `number` |
| V API Access Boundary | Fuel review, location assignment and refused-attempts all get typed clients |
| VI Responsive Design | **NON-NEGOTIABLE here.** FR-014c names the punch refusal surfaces mobile-critical. 320px is a gate, not a polish pass |

No violations. No Complexity Tracking entries.

## Project Structure

```
specs/020-fuel-accountability-geofence/
├── spec.md          # amended 2026-10-01 — see above
├── plan.md          # this file
├── contracts/punch-and-fuel.md
├── quickstart.md
├── tasks.md
└── checklists/requirements.md
```

```
app/lib/api/my-workspace.ts    # CHANGED — send accuracyMeters; refused-attempts list
app/lib/api/plant.ts           # CHANGED — fuel exceptions, deductions, recoveries
app/lib/api/hr-payroll.ts      # CHANGED — location assignment, exemptions
app/lib/offline-queue.ts       # CHANGED — punch store retired, muster store kept
app/lib/punch-refusal.ts       # NEW — code → message, a pure function
app/ui/my/punch-clock.tsx      # CHANGED — accuracy, refusal display, offline notice
app/ui/my/refused-attempts.tsx # NEW — the worker's own refused attempts (FR-012)
app/ui/plant/fuel-exceptions.tsx     # NEW — US1
app/ui/hr/location-assignment.tsx    # NEW — US2
```

## Phases

Ordered by what the backend can honestly support, not by story priority.

- **Phase 1 — Send the accuracy (FR-014a, FR-014b).** Buildable and shippable today. Absent-safe on
  the server, so it changes no verdict until Phase 3 exists.
- **Phase 2 — Punching requires connectivity.** Retire the punch queue; the screen states plainly
  that a punch needs a connection, and names the correction route. Independent of the backend.
- **Phase 3 — Refusal messaging (FR-013, FR-013a, FR-013b, FR-014).** ⚠️ **Gated.** Built against
  the contract; cannot be verified or shipped until backend Phase 3 lands, which is itself gated on
  the client seeing the refusal-rate figure.
- **Phase 4 — The worker's refused attempts (FR-012).** ⚠️ Needs backend Phase 3's refusal records.
- **Phase 5 — Location assignment (FR-007 – FR-011).** ⚠️ Needs backend Phase 4.
- **Phase 6 — Fuel exception review (FR-001 – FR-006).** ⚠️ Needs backend Phases 5–6.
- **Phase 7 — Verification.** Including the 320px passes Principle VI makes non-negotiable.

Phases 1 and 2 are the whole of what can ship now, and they are worth shipping alone: together they
make the punch request honest about its uncertainty and stop promising a worker a success that has
not happened.

## `punch-exceptions.tsx` is correct today, and must not be re-labelled yet

**Decision of 2026-10-01: keep the screen for history, and re-label it.** The timing matters more
than the decision.

The screen reads recorded punches carrying `geofenceResult: 'exception'`. Under the hard refusal
nothing is recorded, so no new row can ever appear — which is why re-labelling it is right. But
backend Phase 3 **is not built**: `PunchResultDto` still returns 201 "because the punch is recorded
either way", and exceptions are still being created today.

So re-labelling it now would be a lie in the other direction, telling workers a surface covers only
the past while it is actively filling. The re-label belongs **in Phase 3, beside the change that
makes it true** — not now, and not as a tidy-up afterwards.

Nothing is deleted either way: an exception already travelling the approval chain needs the one
surface where its originator can act on it, and this is the only one in the product that belongs to
the person who raised the item rather than to a reviewer.

## The one thing most likely to go wrong

**A refusal message that is accurate and useless.**

The server returns three codes, and the temptation is to render the server's `message` and be done.
That fails in the specific way this feature exists to prevent: `PUNCH_REFUSED_LOCATION` and
`PUNCH_REFUSED_UNLOCATABLE` are both "we could not accept this for location reasons", and a worker
told to move when they are standing in the right place walks off a site they were correctly on.
The spec's edge case names exactly this — "the difference between a worker retrying from ten metres
away and a worker walking off a site they were standing on".

So the three codes must map to three *actions*, held in `constants.ts` where they can be reviewed as
a set:

| Code | What the worker is told to do |
| --- | --- |
| `PUNCH_REFUSED_LOCATION` | where they must be |
| `PUNCH_REFUSED_UNLOCATABLE` | their phone cannot place them — wait or move to open sky |
| `PUNCH_REFUSED_FACE` | retake the photo |

And the repeat case, which no single message solves: a worker refused three times running must not
be told the same thing a third time. At some point the honest answer is to ask their supervisor for
a correction, and that escalation is in the screen's state, not in the message table.

## Complexity Tracking

No entries.

## Phase status

- [x] Plan written (2026-10-01)
- [ ] Phase 1 — Send the accuracy
- [ ] Phase 2 — Punching requires connectivity
- [ ] Phase 3 — Refusal messaging ⚠️ gated on backend Phase 3
- [ ] Phase 4 — Refused attempts ⚠️ gated
- [ ] Phase 5 — Location assignment ⚠️ gated
- [ ] Phase 6 — Fuel exception review ⚠️ gated
- [ ] Phase 7 — Verification
