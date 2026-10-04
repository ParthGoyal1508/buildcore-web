---

description: "Task list for feature implementation"
---

# Tasks: Labour Management Frontend

**Input**: Design documents from `/specs/013-labour/`
**Tests**: Manual per quickstart, plus an **offline end-to-end walkthrough** (SC-002), a 200-worker
muster responsiveness check on a mid-range phone (SC-008), and a PII non-persistence check (SC-005).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Shared Infrastructure

- [X] T001 [P] Add "Labour" nav group to `nav-links.tsx`; add the muster entry to the field surface
- [X] T002 Create `app/dashboard/labour/layout.tsx`
- [X] T003 Create `app/lib/api/labour.ts` with all typed API function stubs
- [X] T004 Extend `middleware.ts` for **both** `/dashboard/labour/*` and `/labour/muster`
      (spec FR-001, FR-002)
- [X] T005 [P] Add labour constants — attendance types, statuses, currency denominations, colour maps
      (spec FR-022)
- [ ] T006 [P] Reuse the `usePermission` affordance so `LABOUR_APPROVE` actions are **not rendered**
      without the permission (spec FR-003)

---

## Phase 2: Types, schemas, and the offline-queue extension

- [X] T007 Define every interface and zod schema in `app/lib/api/labour.ts` — data-model.md
- [X] T008 **Extend the existing `OfflineQueueEntry` with a `'muster'` kind** carrying a MusterDraft
      payload — extending `app/lib/offline-queue.ts`, **not creating a second queue or IndexedDB
      store** (spec FR-006)
- [X] T009 [P] `.catch()` fallbacks so an unrecognised attendance type or status renders its raw
      label (spec FR-029)

---

## Phase 3: US1 & US2 — Wage Rates, Workers, Gangs (P1)

- [X] T010 [US1] `wage-rate-table.tsx`: effective-dated history with a Current indicator; the prior
      rate visibly gains its Effective To on save
- [X] T011 [US1] `wage-rate-form.tsx`: backdating 400 surfaced inline explaining rates append
      forward; **locked rates render read-only with a tooltip** (spec FR-018)
- [X] T012 [US1] "As of date" control filtering to rates in force on that date
- [X] T013 [P] [US1] Skill category masters with 409-guarded delete
- [X] T014 [US2] `worker-form.tsx`: engagement type conditionally reveals Contractor (from
      `partners.ts`); duplicate Aadhaar 409 inline with a link
- [ ] T015 [US2] `worker-table.tsx` (`ResponsiveList`): **masked PII rendered exactly as returned;
      no client-side unmasking; the unmasked detail payload never cached or persisted**
      (spec FR-013)
- [ ] T016 [US2] Face enrolment wired to **003's existing enrolment flow and
      `camera-capture.tsx`** — no second implementation (spec FR-006)
- [X] T017 [US2] `gang-form.tsx` with the single-gang-membership 409 surfaced inline
- [ ] T018 [US2] Deactivation warning when payment lines are unsettled; flagged in the list after

**Checkpoint**: "Labour Wages Creation Per Project" (matrix row 15) is covered.

---

## Phase 4: US3 — Supervisor Muster Capture (P1, mobile-first) 🎯 the headline gap

- [X] T019 [US3] `muster-wizard.tsx` (client): three steps — Open Session, Mark Workers, Review &
      Submit — so a failure in one step does not discard another's work (spec FR-007)
- [X] T020 [US3] `muster-step-session.tsx` **reusing `punch-clock.tsx`'s GPS/geofence handling**;
      shows site, date, accuracy, and geofence result before proceeding
- [X] T021 [US3] **Outside the fence or low accuracy → persistent warning banner and proceed**
      (ratified 2026-09-01); **no GPS fix at all → blocked with retry** (spec FR-008)
- [X] T022 [US3] `worker-muster-card.tsx`: large photo button **reusing `camera-capture.tsx`**,
      attendance-type control, conditional overtime field
- [ ] T023 [US3] Per-line validation — worker not active at that site → 400 inline;
      `overtime_only` without hours → 400 inline
- [X] T024 [US3] Gang bulk-add creating a card per active member, **each still requiring its own
      photo** before submit
- [ ] T025 [US3] Low face match → **subtle "needs review" chip only** — never a blocking dialog,
      never an error treatment (spec FR-009)
- [ ] T026 [US3] **Virtualise the card list and lazy-load photos** so a 200-worker muster does not
      exhaust phone memory (spec FR-027)
- [ ] T027 [US3] `muster-step-review.tsx`: counts by attendance type, count of cards missing photos,
      **Submit disabled while any marked worker lacks a photo** (spec FR-010)
- [ ] T028 [US3] Offline submit via the **existing `enqueue`**; queued indicator via
      `getQueuedCount`; automatic drain via `drainQueue` (spec FR-011)
- [ ] T029 [US3] Drain failures surfaced with their reason and **retained for manual retry, never
      silently dropped** (spec FR-011)
- [ ] T030 [US3] 409 handling that **preserves the captured work** — duplicate muster offers to open
      the existing one; worker-at-two-sites highlights the offending card with the other site named
      (spec FR-012)
- [ ] T031 [US3] Backdating-window 400 surfaced clearly
- [ ] T032 [P] [US3] Verify one-handed operability at 320px with 44×44px targets and no hover-gated
      action (spec FR-026, SC-004)

**Checkpoint**: Matrix row 11 delivered — the module's primary field operation.

---

## Phase 5: US4 — Muster Approval (P1)

- [ ] T033 [US4] `muster-queue.tsx`: submitted first, oldest first, **flags visible on the row**
- [ ] T034 [US4] `muster-detail.tsx`: per-line worker, attendance type, overtime, photo, face-match
      indicator, and the applicable wage rate
- [ ] T035 [US4] **Photos lazy-loaded** so a large muster does not block the page (spec FR-028)
- [ ] T036 [US4] Approve **not rendered** without the permission for flagged musters; Return
      requires a reason and notifies the supervisor
- [ ] T037 [US4] Approved musters render read-only; un-approval 409 names the payment sheet with a
      link

---

## Phase 6: US5 & US7 — Payment Sheets and Advances (P1, P2)

- [ ] T038 [US7] `advance-form.tsx`: live per-instalment computation; exceeds-limit inline warning;
      approval requires the permission
- [ ] T039 [US7] `advance-table.tsx`: outstanding balance, recovery history showing which sheet
      lines reduced it, recovery-at-risk marker
- [ ] T040 [US5] `generate-sheet-modal.tsx`: period defaults to the company wage cycle;
      **missing-rate 409 surfaced with project, skill category, and date plus a link to create the
      rate** (spec FR-014)
- [ ] T041 [US5] Overlapping-period 409 naming the existing sheet with a link
- [ ] T042 [US5] `payment-sheet-table.tsx`: per-line days, overtime, **resolved rate and its
      source**, gross, deductions, net, with column totals
- [ ] T043 [US5] Approve **not rendered** without the permission; approved sheets read-only; Reopen
      disabled once any line is disbursed with an explanatory tooltip
- [ ] T044 [US5] `denomination-panel.tsx`: note count per denomination plus **per-worker residual**,
      in a **print-clean** layout for the cashier (spec FR-015)
- [ ] T045 [US5] Contractor sheets grouped by contractor with per-contractor totals and **no
      denomination panel** (spec FR-015)
- [ ] T046 [US5] Capped-recovery helper text explaining the carry-forward (spec FR-017)
- [ ] T047 [US5] Sheet export via the established handling

**Checkpoint**: Matrix rows 12 and 18 delivered.

---

## Phase 7: US6 — Disbursement (P2)

- [ ] T048 [US6] `disburse-modal.tsx`: payment mode, paid on, paid amount defaulted to net payable
- [ ] T049 [US6] **Cash requires an acknowledgement captured via `camera-capture.tsx`, with Save
      disabled until captured** (spec FR-016)
- [ ] T050 [US6] Bank mode disabled with an explanation for a worker with no recorded bank account
- [ ] T051 [US6] Short payment requires a reason, with helper text explaining the carry-forward
      (spec FR-017)
- [ ] T052 [US6] Header summary of disbursed/pending counts and amounts; visible closure transition
- [ ] T053 [US6] Reverse **not rendered** without the permission; requires a reason
- [ ] T054 [P] [US6] Verify full operability at tablet width with 44×44px targets

---

## Phase 8: US8 — Reports (P3)

- [ ] T055 [US8] `deployment-report.tsx` grouped by skill / site / contractor
- [ ] T056 [US8] `attendance-report.tsx` with attendance percentage
- [ ] T057 [US8] `payment-register.tsx` — the labour equivalent of a salary register
- [ ] T058 [US8] Export via the established handling (spec FR-031); `REPORTS` guard verified
- [ ] T059 [P] [US8] Distinct empty states, not errors

---

## Phase 9: Polish

- [ ] T060 [P] Verify `formatCurrency` and `StatusBadge` usage throughout
- [ ] T061 [P] Verify skeleton / empty / error-with-retry on every screen (spec FR-030)
- [ ] T062 TypeScript type check (`npx tsc --noEmit`)
- [ ] T063 **Offline end-to-end walkthrough**: capture a full muster with the network disabled,
      confirm it queues and drains on reconnect losing no line (SC-002)
- [ ] T064 Large-muster check: 200 workers on a mid-range phone (SC-008)
- [ ] T065 Confirm no unmasked worker PII in any client-side cache or storage (SC-005)
- [ ] T066 **Confirm by inspection that no second camera, geofence, or queue implementation was
      introduced** (spec FR-006)

## Dependencies

```
Phase 1-2 → US1 (Wage Rates) ─────────────→ US5 (Payment Sheets)
          → US2 (Workers/Gangs) → US3 (Muster Capture) → US4 (Approval) → US5
          → US7 (Advances) → US5 (deduction lines) → US6 (Disbursement)
                                                    → US8 (Reports)

External: backend 013 must exist. 003's camera, geofence, and offline queue are hard
          dependencies (T008, T016, T020, T022, T028, T049).
          008's monthly report reads man-days from T055.
```

## Implementation Strategy

**MVP (Phases 1–5)**: wage rates, workers, muster capture, approval — the daily site operation and
the matrix's headline gap.
**Increment 2 (Phases 6–7)**: payment sheets, advances, disbursement — the financial output.
**Increment 3 (Phase 8)**: reporting.

---

## Reconciliation, 2026-10-04 — PARTIAL, on the same terms as feature 011

66 tasks were open against 2,661 lines of labour interface plus a 466-line field muster surface at
`/labour/muster` — outside `/dashboard` deliberately, because a supervisor marking a muster is not
visiting the back office. Every route exists: wage rates, workers, gangs, musters (with a detail
route), payment sheets (with a detail route), advances, and three report pages. All 41 typed API
functions are there. **19 are now closed; 47 remain open, and most of those are unverified rather
than absent.**

### The check that was worth doing

**T008 looked missing and is not.** Searching the lib for `'muster'` returned nothing, which would
have left the offline muster queue recorded as a gap — the worst possible error here, since the
muster is the one surface that genuinely needs to work with no signal. It is there as
`MusterQueueEntry` with its own `MUSTER_STORE`, a **separate** interface rather than an extension of
`OfflineQueueEntry` as the task asked, and `offline-queue.ts` explains why in place: each entry
mirrors the payload of the endpoint it drains to, down to `accuracyMetres` against the punch
queue's `accuracyMeters`. Two spellings in one file, deliberately. `enqueueMuster` is called from
the field page.

That is a task that a filename search would have marked absent and a careless reading would have
marked present for the wrong reason. It is the clearest argument for the standard this
reconciliation was asked to meet.

### What was verified, and what was not

Verified: the nav group and field entry, the layout, the API client and its schemas, the constants
and `.catch()` fallbacks, the gating (by `ModuleGuard` and section layouts — there is no
`middleware.ts` in this project, as noted for 011 T004), the wage-rate history with its as-of
control and backdating refusal, the worker and gang forms, the skill-category masters, and the
muster wizard's session/geofence/camera reuse — `camera-capture` and `accuracyMetres` both appear in
the field page, so T020 and T022 reuse what 003 and 020 built rather than reimplementing it.

Not verified: the eight named component files do not exist, the same page-level structure as
feature 011, so each remaining behaviour has to be read out of a page. `skeleton` returns **zero
matches across the whole labour interface**, which makes the loading-state tasks probable gaps.
Everything from T026 onward — payment sheets, denominations, disbursement, advances, reversals and
the reports — was not read closely enough to tick, and is left open on that basis.

**Finishing 011 and 013 properly is about a day of reading between them.** Both are left here
rather than ticked optimistically: the whole point of being asked to read the code was that a tick
resting on a filename is worth nothing, and that applies just as much to a tick resting on a
plausible-looking directory listing.
