---

description: "Task list for 018 BOQ, Billing and Project P&L (web)"
---

# Tasks: BOQ, Billing and Project P&L (web)

**Input**: Design documents from `specs/018-boq-billing-pl/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (clarified 2026-10-01),
[contracts/billing-and-pnl.md](./contracts/billing-and-pnl.md), [quickstart.md](./quickstart.md)

**Tests**: **NONE.** No test framework is installed (constitution `TODO(TESTING_STANDARD)`). No task
below creates a test file. Verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus
the manual passes in quickstart.md — several of which are **measurements**, not glances.

**⚠️ The backend is entirely unbuilt: 0 of 74 tasks, and no BOQ, bill or P&L code exists.** Only
Phase 1 below can start, and it can start against the contract. Everything from Phase 2 needs
endpoints that do not exist.

**Awaiting the client**: a real BOQ template, to confirm or raise NFR-001's 500-line figure. It
changes one decision — whether row virtualization is added on top of per-row state — and blocks no
task before Phase 2.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: The typed boundary and pure derivation — startable now

**Goal**: one place that says what gross, net, revenue and cost mean.
**Independent test**: quickstart Scenario 1, which needs no API.

**Why this is worth doing before the backend exists**: `bill-totals.ts` is where FR-002's live
arithmetic and the submitted bill's figures either agree or diverge, and where US3's summary learns
that a deduction is not a cost. Two implementations of "net" is this feature's worst defect, and it
would not announce itself — the figures would simply differ slightly on two screens and each would
look plausible.

- [ ] T001 [P] Add `BILLING_COPY` and `PNL_COPY` to `app/lib/constants.ts`: column headings,
      deduction labels, the over-quantity warning, the drill-down-refused message, export copy
- [ ] T002 [P] Add `ROUTES` entries for the bill sheets, the project summary and the P&L board
- [ ] T003 Create `app/lib/api/billing.ts` against the contract (Principle V)
- [ ] T004 Create `app/lib/api/project-pnl.ts` against the contract
- [ ] T005 **One money representation end to end.** Reuse the existing `decimal` / `nullableDecimal`
      zod helpers from `app/lib/api/plant.ts`; do not introduce a second convention. A sheet summing
      hundreds of lines is the worst place in the product for `number` and a decimal string to meet —
      the error is small, silent, and lands in a figure somebody quotes to a client
- [ ] T006 Create `app/lib/bill-totals.ts` as **pure functions**, deriving line and bill totals
      (Principle I). Not logic inside the sheet component
- [ ] T007 **Define once that a deduction is not a project cost.** Retention is the client's money
      withheld and an advance recovery is money already paid; neither is spend. A reader drilling from
      the summary's cost figure into bills can otherwise land on a deduction line and conclude the
      project spent it. Write the four-way distinction (gross / retention / recovery / net) beside the
      function
- [ ] T008 Make over-quantity **a flag, not a refusal** in the derivation (FR-003), and note that any
      consumer summing billed values must know this can happen — a summary that quietly totals a bill
      with an over-quantity line is arithmetically right and materially misleading
- [ ] T009 Verification: walk quickstart Scenario 1 by hand, including the over-quantity case and the
      two deductions. No API needed

---

## Phase 2: The client bill sheet (US1) ⚠️ needs backend Phases 1–2

**Goal**: FR-001 – FR-006. **Independent test**: quickstart Scenario 2.

- [ ] T010 [US1] Create `app/ui/projects/bill-line-row.tsx` **owning its own value**. This is the
      architecture, not a detail: a single form object holding 500 lines re-renders the whole sheet on
      every keystroke, which is exactly the failure NFR-001 describes
- [ ] T011 [US1] Create `app/ui/projects/bill-sheet.tsx` presenting description, unit, contracted
      quantity, rate and quantity to date (FR-001)
- [ ] T012 [US1] Line and bill totals update as quantities are entered, with no save and no reload
      (FR-002), reading `bill-totals.ts` rather than recomputing
- [ ] T013 [US1] Flag an over-contract quantity **at the line**, and keep the bill submittable (FR-003)
- [ ] T014 [US1] Keyboard entry down a column (FR-004)
- [ ] T015 [US1] **Do not use `app/ui/settings/responsive-list.tsx` for the grid.** It renders every
      row and gained an always-rendered detail row in 017 — both correct for settings-sized lists and
      both wrong at 500 lines of editable inputs. It stays useful for the deduction and drill-down
      lists
- [ ] T016 [US1] Render a submitted bill at **the rates it was billed at** (FR-006), never today's BOQ
      rate. A rate revised after billing would otherwise silently restate history
- [ ] T017 [US1] **If the client's template shows several thousand lines**, add row virtualization —
      and make FR-004's keyboard navigation survive it. A virtualized row scrolled out of view is
      unmounted, and the focus target with it. Skip this task if 500 is confirmed
- [ ] T018 [US1] Verification: quickstart Scenario 2, including the **React Profiler measurement** at
      step 3. If a keystroke re-renders more than its own row, T010 is not actually in place

---

## Phase 2a: Draft recovery (FR-005) ⚠️ needs Phase 2's sheet

**Decision of 2026-10-01**: local draft recovery, not offline-first. Submitting still needs
connectivity.

- [ ] T019 [US1] Create `app/lib/bill-drafts.ts` as a **third object store** in
      `app/lib/offline-queue.ts`'s database, reusing its `openDb` and `promisify` rather than growing a
      second IndexedDB implementation — the precedent the muster store already documents
- [ ] T020 [US1] Note beside it that this store is **never drained to the server**. It holds a draft
      read back when the sheet reopens, which is a different lifecycle from the punch and muster
      queues, and nobody should wire it into a drain loop
- [ ] T021 [US1] **Coordinate the `DB_VERSION` bump with feature 020 Phase 2**, which retires the punch
      store for the same file. Whichever lands second must not treat the other's bump as a conflict to
      resolve by reverting
- [ ] T022 [US1] Offer the draft back when the sheet reopens; never restore silently over a server
      state the user has not seen
- [ ] T023 [US1] Verification: quickstart Scenario 2 step 6 — kill the tab mid-entry, and drop the
      network mid-entry

---

## Phase 3: The RA bill sheet (US2) ⚠️ needs backend Phase 3

- [ ] T024 [US2] Create `app/ui/projects/ra-bill-sheet.tsx` with awarded lines, quantity to date and
      remaining (FR-007)
- [ ] T025 [US2] Gross, **each** deduction with its basis, and net payable as **separate figures**
      (FR-008). Never one net with the arithmetic hidden — the basis is what makes a deduction
      arguable rather than merely imposed
- [ ] T026 [US2] Verification: quickstart Scenario 3

---

## Phase 4: Concurrency and approval invalidation ⚠️ needs backend Phase 4

- [ ] T027 Warn that approvals will be invalidated **before** the edit, not after and not as a toast
      once it is done (FR-009). The warning is the requirement
- [ ] T028 Do not assert the invalidation has completed the instant the save returns. Expect it to be
      **eventual** — feature 016 established that the chain restarts when a correction is applied, not
      when it is asked for, and the spine's completion event is fire-and-forget
- [ ] T029 On a rejected save, make the conflict a **visible, recoverable** state that does not discard
      the user's entry (FR-014). Losing an hour of typing to a conflict dialog would be a worse failure
      than the overwrite this requirement prevents
- [ ] T030 Verification: quickstart Scenario 4 with two users

---

## Phase 5: The project summary (US3) ⚠️ needs backend Phases 5, 10, 11

- [ ] T031 [US3] Create `app/ui/projects/project-summary.tsx` — revenue and cost by category, monthly
      and cumulative (FR-010)
- [ ] T032 [US3] Every figure opens to the records comprising it (FR-011)
- [ ] T033 [US3] A figure whose records the viewer may not open must **say so** — never an empty
      drill-down, which reads as "there is nothing there" (spec edge case)
- [ ] T034 [US3] Create `app/ui/projects/monthly-labour.tsx` — per worker, for a **calendar month**
      (FR-010a). Feature 013's wage sheet covers a wage period, so a fortnightly cycle puts two or
      three sheets inside one month and the drill-down lands on sheets rather than on people
- [ ] T035 [US3] Keep it **read-only** (FR-010b). Wages are computed and corrected on the payment
      sheet, and a second place to change them would be a second answer to what somebody was paid
- [ ] T036 [US3] Handle several hundred daily workers readably, where the category total was one line
- [ ] T037 [US3] A month whose labour was entirely through a contractor has no per-worker
      disbursements — **state that**, rather than rendering blank
- [ ] T038 [US3] Changing the month updates **every** figure together, with no mixed-period state
      visible at any point (FR-012). One query per month boundary, not a figure-by-figure refresh
- [ ] T039 [US3] Export the selected month with the same figures as the screen (FR-010c)
- [ ] T040 [US3] Put the **production date** on the export. The spec's edge case is a payment sheet
      reopened after a month was exported, and the date is the only thing that tells the two documents
      apart
- [ ] T041 [US3] Verification: quickstart Scenario 5, including the NFR-002 measurement

---

## Phase 6: The group board (US4) ⚠️ needs backend Phase 9

- [ ] T042 [US4] Create `app/ui/dashboard/pnl-board.tsx` — per-project revenue, cost and margin with a
      company total (FR-013)
- [ ] T043 [US4] Selecting a project opens its own summary
- [ ] T044 [US4] Projects the viewer may not see appear in **neither the rows nor the total**. A total
      that silently includes them leaks their existence — the same disclosure rule 021's search works
      under
- [ ] T045 [US4] Build the board to be **pleasant** on a phone, not merely unbroken. NFR-003 names it
      the one screen here a director might genuinely read on one
- [ ] T046 [US4] Verification: quickstart Scenario 6

---

## Phase 7: Verification

- [ ] T047 NFR-001 **measured**: 500 lines interactive in under 3s, and lag-free typing down a column
      with the Profiler. Record the figures and the BOQ size used
- [ ] T048 NFR-002 measured: summary under 3s for 12 months
- [ ] T049 NFR-003: both billing sheets unbroken at 320px — grid scrolling in its own container with
      totals reachable. **Not** a claim that billing from a phone is sensible; the spec is explicit
- [ ] T050 SC-001 and SC-002: a client bill and an RA bill are entered down a real BOQ and submitted,
      each showing the rates it was billed at
- [ ] T051 SC-003 and SC-004: the project summary reconciles to its underlying records, and every figure
      opens to them
- [ ] T052 SC-005: the monthly labour view answers "what did we pay this worker in September" without
      opening several wage sheets and adding up — the question the 2026-09-29 clarification was raised
      for
- [ ] T053 SC-006 and SC-007: the group board totals only projects the viewer may see, and the monthly
      export carries the same figures as the screen plus its production date
- [ ] T054 FR-015: every read through a typed API module, no component calling `fetch`, all copy in
      `constants.ts`. A recorded sweep — the requirement that decays silently
- [ ] T055 Record every measurement in this file beside its task

---

## Dependencies & Execution Order

```
Phase 1 (derivation) ──> startable NOW, against the contract
      ↓
backend Phases 1-2 ──> Phase 2 (client bill sheet) ──> Phase 2a (drafts)
backend Phase 3 ─────> Phase 3 (RA bill)
backend Phase 4 ─────> Phase 4 (concurrency, invalidation)
backend 5, 10, 11 ───> Phase 5 (summary)
backend Phase 9 ─────> Phase 6 (group board)
                       ↓
                    Phase 7
```

Phase 2a depends on feature 020's Phase 2 only for the `DB_VERSION` coordination in T021, not for its
behaviour.

### Parallel opportunities

- T001–T004 together
- Phases 3, 5 and 6 are independent of one another once their backend phases land

## MVP scope

**Phase 1.** It is the only phase that can start, and it is where this feature's worst defect is
either prevented or built in. Beyond that the MVP is Phase 2 — the client bill sheet is US1 and the
client's item 11.

## Notes

- 55 tasks. **9 are buildable today** (Phase 1); 46 wait on a backend that is 0 of 74.
- T017 is conditional on the client's BOQ template and is the only task that answer touches.
- Both [NEEDS CLARIFICATION] markers were addressed on 2026-10-01: draft recovery was decided, and
  the sizing question was reduced from a blocker to one conditional task.
