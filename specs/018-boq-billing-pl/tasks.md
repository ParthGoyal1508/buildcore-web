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

**Superseded 2026-10-03: the backend is built.** Phases 1-5 and 9-11 of the backend task list have
landed, plus Phase 4 (approval invalidation) and the four cost-source registrations. Phases 6-8 are
deliberately not started there — three unconfirmed client assumptions, each a phase of rework if an
answer differs. See the implementation record at the end of this file for the three endpoints the
backend had to grow before any of these screens could render anything.

**The client's BOQ arrived** (`buildcore-api/docs/BOQ_794578.xls`): ~312 rows, 83 of them headings,
229 measurable. That is **below** NFR-001's 500-line figure, so T017's row virtualization is
deliberately not built — per-row state is enough, and virtualization would have had to keep FR-004's
keyboard navigation working across unmounted rows for no measured benefit.

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

- [x] T001 [P] Add `BILLING_COPY` and `PNL_COPY` to `app/lib/constants.ts`: column headings,
      deduction labels, the over-quantity warning, the drill-down-refused message, export copy
- [x] T002 [P] Add `ROUTES` entries for the bill sheets, the project summary and the P&L board
- [x] T003 Create `app/lib/api/billing.ts` against the contract (Principle V)
- [x] T004 Create `app/lib/api/project-pnl.ts` against the contract
- [x] T005 **One money representation end to end.** Reuse the existing `decimal` / `nullableDecimal`
      zod helpers from `app/lib/api/plant.ts`; do not introduce a second convention. A sheet summing
      hundreds of lines is the worst place in the product for `number` and a decimal string to meet —
      the error is small, silent, and lands in a figure somebody quotes to a client
- [x] T006 Create `app/lib/bill-totals.ts` as **pure functions**, deriving line and bill totals
      (Principle I). Not logic inside the sheet component
- [x] T007 **Define once that a deduction is not a project cost.** Retention is the client's money
      withheld and an advance recovery is money already paid; neither is spend. A reader drilling from
      the summary's cost figure into bills can otherwise land on a deduction line and conclude the
      project spent it. Write the four-way distinction (gross / retention / recovery / net) beside the
      function
- [x] T008 Make over-quantity **a flag, not a refusal** in the derivation (FR-003), and note that any
      consumer summing billed values must know this can happen — a summary that quietly totals a bill
      with an over-quantity line is arithmetically right and materially misleading
- [ ] T009 **NOT RUN (no browser in this environment)** Verification: walk quickstart Scenario 1 by hand, including the over-quantity case and the
      two deductions. No API needed

---

## Phase 2: The client bill sheet (US1) ⚠️ needs backend Phases 1–2

**Goal**: FR-001 – FR-006. **Independent test**: quickstart Scenario 2.

- [x] T010 [US1] Create `app/ui/projects/bill-line-row.tsx` **owning its own value**. This is the
      architecture, not a detail: a single form object holding 500 lines re-renders the whole sheet on
      every keystroke, which is exactly the failure NFR-001 describes
- [x] T011 [US1] Create `app/ui/projects/bill-sheet.tsx` presenting description, unit, contracted
      quantity, rate and quantity to date (FR-001)
- [x] T012 [US1] Line and bill totals update as quantities are entered, with no save and no reload
      (FR-002), reading `bill-totals.ts` rather than recomputing
- [x] T013 [US1] Flag an over-contract quantity **at the line**, and keep the bill submittable (FR-003)
- [x] T014 [US1] Keyboard entry down a column (FR-004)
- [x] T015 [US1] **Do not use `app/ui/settings/responsive-list.tsx` for the grid.** It renders every
      row and gained an always-rendered detail row in 017 — both correct for settings-sized lists and
      both wrong at 500 lines of editable inputs. It stays useful for the deduction and drill-down
      lists
- [x] T016 [US1] Render a submitted bill at **the rates it was billed at** (FR-006), never today's BOQ
      rate. A rate revised after billing would otherwise silently restate history
- [ ] T017 **SKIPPED — 312 lines confirmed, see the record below** [US1] **If the client's template shows several thousand lines**, add row virtualization —
      and make FR-004's keyboard navigation survive it. A virtualized row scrolled out of view is
      unmounted, and the focus target with it. Skip this task if 500 is confirmed
- [ ] T018 **NOT RUN (needs the React Profiler in a browser)** [US1] Verification: quickstart Scenario 2, including the **React Profiler measurement** at
      step 3. If a keystroke re-renders more than its own row, T010 is not actually in place

---

## Phase 2a: Draft recovery (FR-005) ⚠️ needs Phase 2's sheet

**Decision of 2026-10-01**: local draft recovery, not offline-first. Submitting still needs
connectivity.

- [x] T019 [US1] Create `app/lib/bill-drafts.ts` as a **third object store** in
      `app/lib/offline-queue.ts`'s database, reusing its `openDb` and `promisify` rather than growing a
      second IndexedDB implementation — the precedent the muster store already documents
- [x] T020 [US1] Note beside it that this store is **never drained to the server**. It holds a draft
      read back when the sheet reopens, which is a different lifecycle from the punch and muster
      queues, and nobody should wire it into a drain loop
- [x] T021 [US1] **Coordinate the `DB_VERSION` bump with feature 020 Phase 2**, which retires the punch
      store for the same file. Whichever lands second must not treat the other's bump as a conflict to
      resolve by reverting
- [x] T022 [US1] Offer the draft back when the sheet reopens; never restore silently over a server
      state the user has not seen
- [ ] T023 **NOT RUN (needs a browser to kill a tab and drop a network)** [US1] Verification: quickstart Scenario 2 step 6 — kill the tab mid-entry, and drop the
      network mid-entry

---

## Phase 3: The RA bill sheet (US2) ⚠️ needs backend Phase 3

- [x] T024 [US2] Create `app/ui/projects/ra-bill-sheet.tsx` with awarded lines, quantity to date and
      remaining (FR-007)
- [x] T025 [US2] Gross, **each** deduction with its basis, and net payable as **separate figures**
      (FR-008). Never one net with the arithmetic hidden — the basis is what makes a deduction
      arguable rather than merely imposed
- [ ] T026 **NOT RUN (no browser)** [US2] Verification: quickstart Scenario 3

---

## Phase 4: Concurrency and approval invalidation ⚠️ needs backend Phase 4

- [x] T027 Warn that approvals will be invalidated **before** the edit, not after and not as a toast
      once it is done (FR-009). The warning is the requirement
- [x] T028 Do not assert the invalidation has completed the instant the save returns. Expect it to be
      **eventual** — feature 016 established that the chain restarts when a correction is applied, not
      when it is asked for, and the spine's completion event is fire-and-forget
- [x] T029 On a rejected save, make the conflict a **visible, recoverable** state that does not discard
      the user's entry (FR-014). Losing an hour of typing to a conflict dialog would be a worse failure
      than the overwrite this requirement prevents
- [ ] T030 **NOT RUN (needs two signed-in users)** Verification: quickstart Scenario 4 with two users

---

## Phase 5: The project summary (US3) ⚠️ needs backend Phases 5, 10, 11

- [x] T031 [US3] Create `app/ui/projects/project-summary.tsx` — revenue and cost by category, monthly
      and cumulative (FR-010)
- [x] T032 [US3] Every figure opens to the records comprising it (FR-011)
- [x] T033 [US3] A figure whose records the viewer may not open must **say so** — never an empty
      drill-down, which reads as "there is nothing there" (spec edge case)
- [x] T034 [US3] Create `app/ui/projects/monthly-labour.tsx` — per worker, for a **calendar month**
      (FR-010a). Feature 013's wage sheet covers a wage period, so a fortnightly cycle puts two or
      three sheets inside one month and the drill-down lands on sheets rather than on people
- [x] T035 [US3] Keep it **read-only** (FR-010b). Wages are computed and corrected on the payment
      sheet, and a second place to change them would be a second answer to what somebody was paid
- [x] T036 [US3] Handle several hundred daily workers readably, where the category total was one line
- [x] T037 [US3] A month whose labour was entirely through a contractor has no per-worker
      disbursements — **state that**, rather than rendering blank
- [x] T038 [US3] Changing the month updates **every** figure together, with no mixed-period state
      visible at any point (FR-012). One query per month boundary, not a figure-by-figure refresh
- [x] T039 [US3] Export the selected month with the same figures as the screen (FR-010c)
- [x] T040 [US3] Put the **production date** on the export. The spec's edge case is a payment sheet
      reopened after a month was exported, and the date is the only thing that tells the two documents
      apart
- [ ] T041 **NOT RUN (no browser)** [US3] Verification: quickstart Scenario 5, including the NFR-002 measurement

---

## Phase 6: The group board (US4) ⚠️ needs backend Phase 9

- [x] T042 [US4] Create `app/ui/dashboard/pnl-board.tsx` — per-project revenue, cost and margin with a
      company total (FR-013)
- [x] T043 [US4] Selecting a project opens its own summary
- [x] T044 [US4] Projects the viewer may not see appear in **neither the rows nor the total**. A total
      that silently includes them leaks their existence — the same disclosure rule 021's search works
      under
- [x] T045 [US4] Build the board to be **pleasant** on a phone, not merely unbroken. NFR-003 names it
      the one screen here a director might genuinely read on one
- [ ] T046 **NOT RUN (no browser)** [US4] Verification: quickstart Scenario 6

---

## Phase 7: Verification

- [ ] T047 **NOT RUN (a measurement)** NFR-001 **measured**: 500 lines interactive in under 3s, and lag-free typing down a column
      with the Profiler. Record the figures and the BOQ size used
- [ ] T048 **NOT RUN (a measurement)** NFR-002 measured: summary under 3s for 12 months
- [ ] T049 **NOT RUN (a measurement)** NFR-003: both billing sheets unbroken at 320px — grid scrolling in its own container with
      totals reachable. **Not** a claim that billing from a phone is sensible; the spec is explicit
- [ ] T050 **NOT RUN (needs a seeded project with a real BOQ)** SC-001 and SC-002: a client bill and an RA bill are entered down a real BOQ and submitted,
      each showing the rates it was billed at
- [ ] T051 **NOT RUN (needs seeded data)** SC-003 and SC-004: the project summary reconciles to its underlying records, and every figure
      opens to them
- [ ] T052 **NOT RUN (needs seeded payment sheets)** SC-005: the monthly labour view answers "what did we pay this worker in September" without
      opening several wage sheets and adding up — the question the 2026-09-29 clarification was raised
      for
- [ ] T053 **NOT RUN (needs seeded data and two viewers)** SC-006 and SC-007: the group board totals only projects the viewer may see, and the monthly
      export carries the same figures as the screen plus its production date
- [x] T054 FR-015: every read through a typed API module, no component calling `fetch`, all copy in
      `constants.ts`. A recorded sweep — the requirement that decays silently
- [ ] T055 **NOT RUN — nothing was measured, so there is nothing to record** Record every measurement in this file beside its task

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

---

## Phase 7: What the real BOQ changed (added 2026-10-02, file received)

`buildcore-api/docs/BOQ_794578.xls` — a government e-tender BOQ, ~312 items. See the plan for the five
findings. These tasks exist because the sheet contradicted the plan, not merely to confirm it.

- [x] T056 **CRITICAL** [US1] Model a BOQ line as a **two-level hierarchy**: a heading row with no
      quantity, and sub-items numbered `12.01`, `12.02`. 83 of the sample's 312 rows are headings. The
      flat list this feature was planned around cannot represent the file it has to import.
- [x] T057 [US1] Render a heading row as a heading — no quantity, no rate, no line total — and never as
      a line with zeros. A zero quantity on a heading reads as a real measured quantity of nothing.
- [x] T058 **CRITICAL** [US1] Hold the **estimated total and the quoted total separately**, with the
      bidder's percentage applied once to the estimated total. The sample: 29,961,506.78 at 2.46% excess
      gives 30,698,559.85. Applying the percentage per line gives a figure close enough to pass a glance
      and wrong by rounding, which is the worst available outcome for a tender document.
- [X] T059 **DONE on the api side 2026-10-03** — the arithmetic is asserted against the file's own two figures in `boq-import.service.spec.ts`. [P] [US1] Unit test the grand-total arithmetic against the sample's own two figures. The file
      is the test fixture: it carries both numbers, so this is checkable rather than assumed.
- [X] T060 **UNBLOCKED AND DONE 2026-10-03** — the importer exists: `buildcore-api` `src/projects/boq/unit-normalise.ts`, with 008 T072. Measured on the client's file: 25 spellings → 12 units, the source string kept verbatim on the line. **CRITICAL** [US1] Normalise units on import. `Sqm`/`Sqm.`/`Sqm `/`sqm` are one unit; the
      running-metre family has seven spellings. Keep the original string against the line for audit and
      match on the normalised form — discarding what the client typed would make a disagreement
      unarguable.
- [X] T061 **DONE on the api side 2026-10-03** — asserted in `boq-import.service.spec.ts` against the real file (12 normalised units, `Excess (+)` resolving to none) and against the synthetic fixture (the running-metre family unifying). Still not possible *here*: this repository has no test framework. [P] [US1] Unit test: the sample's 26 unit spellings resolve to the expected ~12 units, and
      `Excess (+)` — which appears in the units column on the quoted-rate row — resolves to none.
- [X] T062 **UNBLOCKED AND DONE 2026-10-03** — `schedule-block.ts` identifies the block by header text and clips every row to its span, so the far block is excluded for being outside it rather than for sitting at a known position. Verified: 231 lines, not 462. [US1] Ignore columns beyond the known schedule on import. The sample holds 216 rows of
      leftover test data in columns 238–242 shaped exactly like line items, and an importer scanning for
      populated columns finds them.
- [X] T063 **DONE on the api side 2026-10-03** — asserted as a range (231 ± 3) rather than "about", because a tolerance admitting the doubled figure admits the failure. [P] [US1] Unit test: importing the sample yields ~312 lines, not ~528. The failure this
      guards is silent and doubles a tender.
- [X] T064 **UNBLOCKED AND DONE 2026-10-03** — read, found blank, dropped (008 T073). [US1] Tolerate the blank pre-GST tax columns (Excise Duty, VAT, Cenvat, DGS&D/RITES) on
      import without carrying them into the product. The template predates GST.
- [x] T065 [US1] Store quantities and rates as decimals and compute totals ourselves. The source carries
      float noise (`178.09326499999995`, `29961506.782150004`); line totals are quantity × rate exactly,
      so recomputing is both possible and more trustworthy than importing the file's figures.
- [X] T066 **UNBLOCKED AND DONE 2026-10-03** — run end to end against a real instance (008 T096): derived 29,961,506.79 against the file's stated 29,961,506.78, and 30,698,559.86 against 30,698,559.85, both inside the ₹2.31 tolerance. [P] [US1] Import the sample end to end and compare the computed grand total against its
      stated one. One assertion that exercises the hierarchy, the units, the junk columns and the
      arithmetic at once.
- [ ] T067 **NOT RUN (a measurement)** [US1] Measure against NFR-001 using this file rather than a synthetic one: 312 lines
      interactive within 3 seconds, typing without perceptible lag thereafter.

---

## Implementation record, 2026-10-03

### Three endpoints had to be built before any of this could render

Each was found the same way — by starting a screen and discovering it had nothing to read — and each
is recorded in `buildcore-api`'s own task file:

1. **`GET projects/client-bills/boq`.** The backend had the rate, the quoted percentage and the
   compose path that reads them, and **no way to read a project's BOQ**. The bill sheet had nothing
   to render.
2. **`GET projects/ra-bills` and `GET projects/ra-bills/awards/:workOrderId`.** Same gap on the
   subcontractor side. The award read gives FR-007's three quantities before anybody types.
3. **`projects/work-orders` (list, create, read, edit).** This one is larger than a gap. The
   `WorkOrder` table has existed since feature 008 and **nothing had ever written to it** — 008's
   User Story 6 was never built. Every one of 018's FR-006 to FR-009 measures against a work order's
   award, so without it the RA bill sheet, the award capture and the approval invalidation were a
   screen nobody could reach: half of `bugs.md` item 12, built and unreachable. A minimal surface
   was added with its scope boundary written into the service's own docblock, so 008 can take it
   over rather than find a second one beside it.

### Per-row state, and the lint rule that improved it

T010 is the architecture: a single form object over 300 lines re-renders every input on every
keystroke, and the symptom is a biller whose typing lags down a column until they go back to the
spreadsheet.

The first implementation kept the measured values in a **ref** so a settled line could update the
totals without touching the rows. `react-hooks/refs` refused it — reading a ref during render is
unsafe under the React compiler — and the rule was right. The values now live in state and change
**once per settled line** (blur or Enter), not per keystroke; the memoized rows skip that render
because their props are primitives that did not change. Two mirror refs remain for the draft writer,
written and read only in event handlers.

The same rule killed a `useEffect` that synced a restored draft into row state. Restoring now changes
the rows' `key` so they remount with their new starting values — which is also the only way to
replace row state without being able to clobber what somebody is already typing.

### What the real BOQ changed (T056–T058, T065)

- **Two levels, not one.** `BOQTaskGroup` → `BOQTaskItem` already modelled it; the sheet renders a
  heading as a heading with `colSpan`, so there are no empty quantity and rate cells inviting
  somebody to type a zero into a heading.
- **Two totals.** The schedule total and the quoted total, with the percentage applied **once to the
  total** — the server computes both, so the screen and the document cannot disagree. The arithmetic
  is asserted in the backend's spec against the client file's own two figures.
- **Decimals, computed here.** The zod `decimal` convention from `app/lib/api/plant.ts` is reused
  (T005) and `bill-totals.ts` computes every total, so the source file's float noise
  (`29961506.782150004`) never reaches a screen.
- **T017 skipped deliberately**: 312 rows is below the 500 the NFR was written around.

### Unit-test tasks (T059, T061, T063, T066) — not possible in this repository

These four ask for unit tests. **This repository has no test framework** — the constitution's
`TODO(TESTING_STANDARD)` is still open — so there is nowhere to put them, which is what the Tests
note at the top of this file already says. Two of the four were answerable on the backend and are:
the grand-total arithmetic is asserted against the client file's own figures in
`client-bills.service.spec.ts`.

### The importer tasks (T060, T062, T064, T066) are blocked, not skipped

T060's unit normalisation, T062's junk columns, T064's pre-GST tax columns and T066's end-to-end
import all describe behaviour **at import time**, and there is no importer — neither repository
parses an `.xls` BOQ. The BOQ is entered through the existing project screens.

Saying this plainly rather than ticking the tasks: an importer is a real piece of work with real
decisions in it (which sheet, which header row, what to do with a row that normalises to an existing
unit but spells it differently), and the four findings these tasks record are the specification for
it when somebody builds it. They are not satisfied by anything shipped today.

### Verification run

`npx tsc --noEmit` clean, `npx eslint app` clean (0 errors; 11 pre-existing warnings, none in these
files), `npm run build` compiles with the four new routes present:

```
○ /dashboard/projects/pnl
ƒ /dashboard/projects/portfolio/[id]/billing
ƒ /dashboard/projects/portfolio/[id]/ra-bills
ƒ /dashboard/projects/portfolio/[id]/summary
```

**T054's sweep, actually run** rather than asserted: no component in `app/ui` or `app/dashboard`
calls `fetch` for an API read (the one hit is `punch-clock.tsx`'s connectivity probe, which reads no
endpoint), every read goes through `app/lib/api/billing.ts` or `app/lib/api/project-pnl.ts`, and the
sweep found literal copy still in two of the new components — now moved into `BILLING_COPY`,
`PNL_COPY` and `WORK_ORDER_COPY`. The requirement decays silently, so it was checked rather than
claimed.

**Every measurement is NOT RUN**, and each is marked above with why. There is no browser in this
environment, so NFR-001's 3-second interactive figure, the Profiler check that T010 is really in
place, NFR-002's summary timing and the 320px pass are all unverified. The architecture they test is
in place and commented; the figures are not.

### The seven importer tasks, closed 2026-10-03

The note above said these were "blocked, not skipped" and that "an importer is a real piece of work
with real decisions in it (which sheet, which header row, what to do with a row that normalises to
an existing unit but spells it differently)". That turned out to be exactly right about the
decisions, and all of them were taken: 008's 2026-10-03 amendment built the importer, and each of
these seven tasks is now satisfied — four by code and three by tests on the api side, where this
repository has no test framework to hold them.

What the record did not anticipate is that **the BOQ could not be entered by hand either**. The
note said "the BOQ is entered through the existing project screens". There were no such screens: no
endpoint, no page, no seed row, nothing in either repository wrote `BOQTaskGroup` or `BOQTaskItem`.
Every screen in this feature was measuring against a table nothing could fill. That is corrected in
`008-projects-backend/spec.md`, Amendment 2026-10-03, and the entry path is built with the import.

Two of the amendment's findings came from reading the client's file through the new parser rather
than from the estimates recorded here on 2 October, and both change figures this file states:

- **231 item rows under 80 heading rows**, not "~312 lines" — 311 is the count of *candidate* rows,
  which includes the headings. The guard is stated as a range, because a tolerance loose enough to
  admit the doubled figure admits the failure it exists to catch.
- **25 unit spellings, not 26**, resolving to 12 — and normalisation has to strip whitespace as
  well as full stops, or `R.Mtr.` and `R. Mtr.` do not unify. T060's own phrasing ("the running-metre
  family has seven spellings") was the thing that caught it.
