---

description: "Task list for 021 Search, Payout Communication and Exit Closure (web)"
---

# Tasks: Search, Payout Communication and Exit Closure (web)

**Input**: Design documents from `specs/021-search-payout-and-exit/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (clarified 2026-10-01),
[contracts/search-and-clearance.md](./contracts/search-and-clearance.md),
[quickstart.md](./quickstart.md)

**Tests**: **NONE.** No test framework is installed (constitution `TODO(TESTING_STANDARD)`). No task
below creates a test file. Verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus
the manual passes in quickstart.md.

**Backend state**: search (Phases 1–3) and exit clearance (Phase 7) are **built and committed**, so
Phases 1 and 2 below are unblocked. Slips and the bank sheet are not built; Phases 3 and 4 are gated.

**⚠️ Cross-feature dependency**: Phase 2's waiver gating requires **feature 019's web Phase 1**
(T001–T011 there), which stops `currentUserSchema` discarding the `grants` field. Without it the web
cannot tell `EMPLOYEES` at read from `EMPLOYEES` at write.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Search

**Goal**: FR-001 – FR-005. **Independent test**: quickstart Scenarios 1 and 1b.

**This replaces a stub, it does not extend one.** `app/ui/search.tsx` is 18 lines of dead
presentational input from the Next.js dashboard template — no state, no query, no results, and no
importer anywhere in the app.

- [ ] T001 [P] [US1] Add `SEARCH_COPY` to `app/lib/constants.ts`: the four register labels, the
      minimum-term message, the single empty state, and the matched-on-name indicator. **Register
      labels are copy here** — unlike document kinds, the four are fixed by the backend's union rather
      than being company configuration
- [ ] T002 [US1] Create `app/lib/api/search.ts` with `search(term)` (Principle V). `register` as a
      closed union of the backend's four values and `matchedOn` as `'code' | 'name'` (Principle IV)
- [ ] T003 [US1] Create `app/ui/dashboard-search.tsx`: results as the user types, no submit (FR-003)
- [ ] T004 [US1] Group results by register, and **render only groups that returned rows** (FR-005).
      A group header for a register the caller cannot see is itself the disclosure — see T007
- [ ] T004a [US1] Each row must **identify its record sufficiently to choose between similar ones**
      (FR-002) — two projects called "Phase 2" or two vendors with the same trading name are the case
      this exists for. Code alone is not enough when the user searched by name, and name alone is not
      enough when two match
- [ ] T005 [US1] Show `matchedOn` on each row (FR-001b). To somebody who typed something code-shaped,
      an unexplained name match reads as a wrong result
- [ ] T006 [US1] **Do not sort results.** The backend puts an exact code match first and deliberately
      specifies nothing beyond that; a client-side sort would silently defeat the one rule there is
- [ ] T007 [US1] **One empty state for every case** (FR-005). Write down the four tempting variants
      that are each a disclosure: a per-register group header, a "searched 4 of 5 registers" count, a
      "some results are hidden from you" notice, and per-register empty messages that let a user infer
      what exists by watching which one appears. A user with one register and a user with four must see
      an identical screen when nothing matches
- [ ] T008 [US1] Hold T007's guarantee **mid-keystroke**: a term that briefly matches a forbidden
      record must not flicker a group header in and out. The requirement is about what the screen can
      ever show, not about its resting state
- [ ] T009 [US1] Minimum term length: say **keep typing**, never "nothing matched" (FR-001c). The two
      mean different things to the person typing and look identical if you let them
- [ ] T010 [US1] Full keyboard navigation — tab in, arrow through, Enter to open (FR-004)
- [ ] T011 [US1] Debounce and cancel superseded requests (NFR-003). TanStack Query's own cancellation,
      not a hand-rolled timer
- [ ] T012 [US1] Mount in the dashboard shell
- [ ] T013 [US1] Delete `app/ui/search.tsx`. Confirm first that nothing imports it — nothing does
      today, and `employee-search.tsx` on the group dashboard is a different component
- [ ] T014 [US1] Verification: quickstart Scenario 1
- [ ] T015 [US1] Verification: quickstart Scenario 1b in full — **the disclosure test**, including the
      side-by-side comparison of the two users and the character-by-character pass
- [ ] T016 [US1] Verification at 320px, including keyboard selection (Principle VI — search is shell
      furniture)

---

## Phase 2: Exit clearance

**Goal**: FR-012 – FR-014. **Independent test**: quickstart Scenario 2.
**⚠️ Requires feature 019 web Phase 1 for T022.**

- [ ] T017 [P] [US4] Add `CLEARANCE_COPY` to `app/lib/constants.ts`
- [ ] T018 [US4] Create `app/lib/api/exit-clearance.ts` — the clearance read and the waiver write
- [ ] T019 [US4] Create `app/ui/hr/exit-clearance.tsx` listing every outstanding item with its owner
      (FR-012), mounted from `app/ui/hr/offboarding-panel.tsx` rather than as a parallel flow
- [ ] T020 [US4] Assets in custody as **their own group** within that list (FR-012a), each with its
      site, expected return date and condition expectation. An asset is a different kind of obligation
      from an advance, and grouping it with money obscures that
- [ ] T021 [US4] Each asset links to its allocation in the asset register (FR-012b). **No return
      control here** — the asset module owns returning, with its condition grade and consequences, and
      a second control would be a second way to close an allocation
- [ ] T022 [US4] Gate the waiver control on `EMPLOYEES` at **write** level, using 019's `hasWrite`.
      The backend's controller derives the same split from the verb because waiving writes off company
      money. **This is the task that depends on 019 Phase 1** — without `grants`, `EMPLOYEES` means
      only "holds the area at some level" and the waiver would be offered to every reader
- [ ] T023 [US4] A waiver requires a reason and displays its author (FR-014)
- [ ] T024 [US4] A waived item reads as **waived, not returned**. A waiver records that the company is
      not chasing this; it does not discharge the obligation, and an asset waived is still an asset the
      employee has
- [ ] T025 [US4] Final settlement unavailable while items are outstanding, **naming them** (FR-013).
      Naming is the requirement — "cannot settle yet" with no list is an instruction nobody can act on
- [ ] T025a [US4] **FR-013a — the settlement summary lists every asset the employee held at exit,
      with its outcome.** Distinct from T020's outstanding list and previously uncovered: the
      clearance screen shows what is *still* outstanding, while the settlement summary is the record of
      how each asset ended — returned, waived, or still held. An asset returned last week vanishes from
      the first and must still appear in the second, which is the whole point of the client's
      "any assets assigned to the employee should appear in the F&F summary"
- [ ] T026 [US4] **Show no recovery value for an unreturned asset.** The backend deliberately computes
      none: that needs a valuation rule the client has not chosen. Note it here so nobody adds one
      from the asset's purchase cost, which would be a guess presented as a figure
- [ ] T027 [US4] Verification: quickstart Scenario 2, **including step 4's read-only pass**

---

## Phase 3: Slip delivery ⚠️ GATED on backend Phase 4 (0 of 13)

**Goal**: FR-006 – FR-009. Sending is an **explicit action** (decision of 2026-10-01).

- [ ] T028 [US2] Add slip-delivery reads and the retry to `app/lib/api/hr-payroll.ts`
- [ ] T029 [US2] Create `app/ui/hr/slip-delivery.tsx` listing delivered, failed and undeliverable
      (FR-006), mounted on `app/ui/hr/payroll-run-detail.tsx`
- [ ] T030 [US2] An explicit **send** control. Not automatic: an explicit send can be automated later,
      whereas an automatic send that was wrong has already emailed 500 people their salary slips
- [ ] T031 [US2] A **retry that resends only failures** (FR-007), presented so it cannot be mistaken
      for "send all" — the difference is 12 emails or 500
- [ ] T032 [US2] Show the **address as sent** on each row. An employee whose email is corrected after
      a failure must not have the old failure read as though it went to the new address
- [ ] T033 [US2] A run that is not fully approved refuses delivery; **show the reason** rather than a
      disabled control with no explanation (FR-009)
- [ ] T034 [US2] Present a run with some failures as **partial, not failed**. Failures are isolated by
      design — one bad address does not stop the other 499 — and a screen that reads as a failed run
      invites somebody to re-send everything
- [ ] T035 [US2] Verification: quickstart Scenario 3

---

## Phase 4: Bank sheet and reconciliation ⚠️ GATED on backend Phases 5–6 (0 of 18)

**Goal**: FR-010, FR-011. The transaction-sheet format rests on a file the client has not supplied;
the backend builds against one seeded mapping profile so theirs becomes a second profile.

- [ ] T036 [US3] Add the bank sheet and reconciliation reads to `app/lib/api/hr-payroll.ts`
- [ ] T036a [US3] **FR-008 — the transaction sheet upload itself**, showing matched lines, unmatched
      lines and differences. Previously implied by the display tasks below without anything actually
      uploading a file. A validated multipart upload (Principle II on the backend's side; a typed
      client on this one)
- [ ] T037 [US3] Show advance recoveries as **named lines** (FR-010), not a netted figure
- [ ] T038 [US3] Explain differences between the sheet and the run **line by line** (FR-011)
- [ ] T039 [US3] An unparseable row **uploads and is reported**; the file does not fail. A parser that
      refuses on the first unrecognised row reports nothing, which is the opposite of what is wanted
- [ ] T040 [US3] Verification: quickstart Scenario 4, once a real file exists

---

## Phase 5: Verification

- [ ] T041 SC-001: a code of each supported kind reaches its record
- [ ] T042 SC-002 and FR-001a: a name fragment reaches a project with no code known, and name matching
      works in **all four** registers — employee, vendor, equipment, project. The backend widened every
      register rather than projects only, and verifying one would leave three untested
- [ ] SC-003 covered by T015's disclosure pass — a record the viewer may not see is never revealed,
      by result, by group header, by count or by empty state. Cross-reference rather than repeat
- [ ] T043 SC-004 and SC-005: the clearance names outstanding items and refuses settlement while any
      remain
- [ ] T044 SC-005a and SC-005b: every asset held at exit appears on the clearance **and** on the
      settlement summary with its outcome (T020, T025a)
- [ ] T045 NFR-001: search responds as the user types without a request per keystroke (measured, T011)
- [ ] T046 NFR-002: dashboard search usable at 320px including keyboard selection (Principle VI)
- [ ] T047 FR-015: every read goes through a typed API module and no component calls `fetch`; all copy
      in `constants.ts`. A sweep, recorded — this is the requirement that decays silently
- [ ] T048 Record each pass in this file beside its task

---

## Dependencies & Execution Order

```
Phase 1 (search) ──────────────> no dependency. SHIP NOW
019 web Phase 1 (grants) ──> Phase 2 (clearance, T022)
backend Phase 4 ───────────> Phase 3 (slips)
backend Phases 5-6 ────────> Phase 4 (bank sheet)
all ───────────────────────> Phase 5
```

### Parallel opportunities

- T001 and T002 together; T017 alongside Phase 1
- Phases 1 and 2 are independent of each other once 019 Phase 1 has landed

## MVP scope

**Phase 1.** Search is P1, the client asked for it twice, there is nothing like it in the product
today, and it is the most frequent thing anybody does in a system with this many registers. It
depends on nothing.

## Notes

- 51 tasks. 30 are buildable now (Phases 1–2, with T022 waiting on 019 Phase 1); 14 are gated on
  backend Phases 4–6; 7 are verification.
- Both [NEEDS CLARIFICATION] markers were closed on 2026-10-01 — slips send on an explicit action,
  and waiver authority has a working default.
