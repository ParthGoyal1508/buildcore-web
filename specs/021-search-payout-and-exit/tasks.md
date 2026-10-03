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

## Phase 1: Search ✅ implemented 2026-10-01

**Goal**: FR-001 – FR-005. **Independent test**: quickstart Scenarios 1 and 1b.

**This replaces a stub, it does not extend one.** `app/ui/search.tsx` is 18 lines of dead
presentational input from the Next.js dashboard template — no state, no query, no results, and no
importer anywhere in the app.

- [X] T001 [P] [US1] Added `SEARCH_COPY` to `app/lib/constants.ts`: the four register labels, the
      minimum-term message, the single empty state, and the matched-on-name indicator. **Register
      labels are copy here** — unlike document kinds, the four are fixed by the backend's union rather
      than being company configuration
- [X] T002 [US1] Created `app/lib/api/search.ts` with `search(term)` (Principle V). `register` as a
      closed union of the backend's four values and `matchedOn` as `'code' | 'name'` (Principle IV)
- [X] T003 [US1] Created `app/ui/dashboard-search.tsx`: results as the user types, no submit (FR-003)
- [X] T004 [US1] Grouped by register, and **render only groups that returned rows** (FR-005).
      A group header for a register the caller cannot see is itself the disclosure — see T007
- [X] T004a [US1] Satisfied by rendering the server's `sublabel`, which is exactly this: "one disambiguating fact, for the case of two records sharing a name". The backend had already answered it — each row must **identify its record sufficiently to choose between similar ones**
      (FR-002) — two projects called "Phase 2" or two vendors with the same trading name are the case
      this exists for. Code alone is not enough when the user searched by name, and name alone is not
      enough when two match
- [X] T005 [US1] Shows `matchedOn` on each row (FR-001b). To somebody who typed something code-shaped,
      an unexplained name match reads as a wrong result
- [X] T006 [US1] **Results are not sorted.** The backend puts an exact code match first and deliberately
      specifies nothing beyond that; a client-side sort would silently defeat the one rule there is
- [X] T007 [US1] **One empty state for every case** (FR-005). Write down the four tempting variants
      that are each a disclosure: a per-register group header, a "searched 4 of 5 registers" count, a
      "some results are hidden from you" notice, and per-register empty messages that let a user infer
      what exists by watching which one appears. A user with one register and a user with four must see
      an identical screen when nothing matches
- [X] T008 [US1] Holds **mid-keystroke** by construction: groups are derived from the rows actually returned, so there is no code path that emits a header for a register with no rows. T008's guarantee **mid-keystroke**: a term that briefly matches a forbidden
      record must not flicker a group header in and out. The requirement is about what the screen can
      ever show, not about its resting state
- [X] T009 [US1] Minimum term length: say **keep typing**, never "nothing matched" (FR-001c). The two
      mean different things to the person typing and look identical if you let them
- [X] T010 [US1] Full keyboard navigation — tab in, arrow through, Enter to open (FR-004)
- [X] T011 [US1] Debounced 250ms, and the term is in the query key so a superseded answer cannot
      overwrite a later one — TanStack caches per key rather than racing a single slot
- [X] T012 [US1] Mounted via a new optional slot on `ShellHeader` rather than inside it. That header
      is shared by three shells, and mounting search in it would put it on `/my`, where a site employee
      has no register to search, and on the muster screen
- [X] T013 [US1] Deleted `app/ui/search.tsx`. Confirmed nothing imported it; `employee-search.tsx` on
      the group dashboard is a different component and is untouched
- [X] T013a [US1] `npx tsc --noEmit`, `npm run lint` and `npm run build` all clean. One real lint error
      was found and fixed rather than suppressed: resetting the highlighted row in an effect on the
      debounced term triggers a cascading render (`react-hooks/set-state-in-effect`). The highlight is
      now reset on keystroke and **clamped on render** — which also fixes a bug the effect had, where a
      longer term shrinking the result set left the index past the end, highlighting nothing and making
      Enter do nothing
- [X] T013b [US1] `truncated` and `unavailableSources` are both rendered, and that is not in tension
      with T007. Neither can name a register the caller may not see — the backend omits those entirely —
      so the only thing either discloses is something the reader may already search. Suppressing them
      would be its own dishonesty: a capped result read as "everything", and a register that threw read
      as a register with no matches
- [X] T013c [US1] **Defect found in use and fixed: every result led to a 404.** Rows navigated to the
      server's `href`, which is an **API resource path** (`/hr/employees/:id`) and not a route in this
      app. My own comment had argued for using it — that composing a route here would be "a second
      place that knows where a vendor lives" — and that was backwards: the server was never in a
      position to know this app's routing. Navigation now goes through `resultHref` in
      `app/lib/api/search.ts`, reading `ROUTES`, which is the single source of truth for these URLs.
      `href` is kept on the type, since it does identify the resource, with the reasoning recorded
      beside it
- [X] T013d [US1] Two registers have **no detail screen**, and the fix sends each to the closest thing
      that loads rather than a URL that does not resolve: a vendor to the vendors list, because
      vendors are edited in a modal there and no per-vendor route exists; a project to its edit screen,
      because `/dashboard/projects/portfolio/[id]` has no page of its own — only `edit` and `documents`
      beneath it. A vendor row **says** it opens the list, since arriving at a list after picking a
      named record is otherwise just confusing
- [ ] T013e [US1] Both of those deserve real detail screens, and neither is this feature's work. Until
      they exist a search result reaches something that loads but not always the record itself
- [ ] T014 [US1] Verification: quickstart Scenario 1. **Needs a browser and a running API; partially
      done — the navigation path is now confirmed against a running server, the rest is not run**
- [ ] T015 [US1] Verification: quickstart Scenario 1b in full — **the disclosure test**, including the
      side-by-side comparison of the two users and the character-by-character pass. **Not run, and the
      most important outstanding check in this phase**: the code path is built so a group cannot exist
      without rows, but only two users side by side prove the screens are identical
- [ ] T016 [US1] Verification at 320px, including keyboard selection (Principle VI — search is shell
      furniture). **Not run**

---

## Phase 2: Exit clearance ✅ implemented 2026-10-01

**Goal**: FR-012 – FR-014. **Independent test**: quickstart Scenario 2.
**⚠️ Requires feature 019 web Phase 1 for T022.**

- [X] T017 [P] [US4] Added `CLEARANCE_COPY` to `app/lib/constants.ts`
- [X] T018 [US4] Created `app/lib/api/exit-clearance.ts` — the clearance read and the waiver write
- [X] T019 [US4] Created `app/ui/hr/exit-clearance.tsx`, mounted **above** the settlement in
      `offboarding-panel.tsx` rather than beside it: FR-013 blocks settlement while anything is
      outstanding, so a clearance below the Process button would be read after the decision it exists
      to inform. Originally: listing every outstanding item with its owner
      (FR-012), mounted from `app/ui/hr/offboarding-panel.tsx` rather than as a parallel flow
- [X] T020 [US4] Assets in custody as **their own group** within that list (FR-012a), each with its
      site, expected return date and condition expectation. An asset is a different kind of obligation
      from an advance, and grouping it with money obscures that
- [X] T021 [US4] Each asset links to `ROUTES.assetsAllocations` (FR-012b), and the row says so in
      words as well — "Returned in the asset register, not here" — because an absent control explains
      nothing on its own. **No return control here** — the asset module owns returning, with its condition grade and consequences, and
      a second control would be a second way to close an allocation
- [X] T022 [US4] Waiver control gated on `EMPLOYEES` at **write**, via 019's `hasWrite` — the first
      real consumer of that feature's Phase 1. Absent, not disabled: a disabled button still advertises
      an authority the reader has not got. The 019 dependency was real and is now discharged
- [X] T023 [US4] A waiver requires a reason and displays its author (FR-014)
- [X] T024 [US4] A waived item reads as **waived, not returned**, said in a line of its own rather
      than implied by a badge — "waived" reads as "dealt with" to anybody skimming. A waiver records that the company is
      not chasing this; it does not discharge the obligation, and an asset waived is still an asset the
      employee has
- [X] T025 [US4] Final settlement unavailable while items are outstanding, **naming them** (FR-013).
      Naming is the requirement — "cannot settle yet" with no list is an instruction nobody can act on
- [X] T025a [US4] FR-013a — the settlement summary lists every asset the employee held at exit,
      with its outcome. Distinct from T020's outstanding list: the clearance screen shows what is
      *still* outstanding, while the settlement summary is the record of how each asset ended —
      returned, waived, or still held. An asset returned last week vanishes from the first and must
      still appear in the second, which is the whole point of the client's "any assets assigned to
      the employee should appear in the F&F summary".

      **DONE 2026-10-03**, and the note above turned out to describe a live defect rather than only
      a missing screen.

      The api's settlement summary derived its asset list by **filtering the clearance's items**, and
      the clearance can only ever contain open custody — so an asset returned a week before the last
      working day was absent from the summary entirely. The summary said the employee had never been
      given it. `FnfService`'s own docblock claimed every asset appeared "whether or not it blocked
      the settlement", which was the intent and not the behaviour. Fixed by a second registry
      question, `custodyHistoryFor`, returning open **and** closed allocations; seven service tests
      cover it, including the returned-asset case.

      And this client's `fnfSchema` **dropped the field**. The api had served `assets` since 021
      shipped; zod strips unknown keys, so it arrived on every response and never reached a screen.
      That is the eighth instance in this review of a schema quietly discarding or coercing something
      the server sent.

      The summary now lists every asset with one word for its outcome — returned with the date,
      written off with the author's name and reason, or still held — warns when anything is still
      held and unwaived, and states FR-018b in words rather than leaving it to be inferred from the
      absence of a deduction line. A null asset list is rendered as "the register could not be
      asked", never as "nothing was held": a settlement is signed off on that difference.
- [X] T026 [US4] **No recovery value shown**, and said once in words where somebody would otherwise
      look for a figure, rather than left as a silent absence. The backend deliberately computes
      none: that needs a valuation rule the client has not chosen. Note it here so nobody adds one
      from the asset's purchase cost, which would be a guess presented as a figure
- [X] T026a [US4] **Not in the plan, and the screen could not meet FR-014 without it**: the backend
      returned only `waivedByUserId`, and this app has no user-name resolver at all — so the author
      would have been a cuid. Added `waivedByName` to the backend, resolved through the shared
      `actorNameOf` chain so the same person cannot appear under two names on two screens, with two
      unit assertions. Committed separately
- [X] T026b [US4] `settleable` is **read, never recomputed** from `items`. The backend holds it false
      while any source could not be asked, because the safe answer to "is anything outstanding?" when
      part of the question went unanswered is "assume yes". Deriving it here would offer settlement on
      an incomplete picture — the one failure that lets somebody leave with a laptop
- [X] T026c [US4] `unavailableSources` rendered **above** the list as a warning, because it changes how
      everything below should be read. "Could not ask" is not "nothing held", and unlike an ordinary
      outstanding item this one means the clearance may be incomplete
- [X] T026d [US4] A 404 renders as "no exit has been initiated" rather than as a load failure, and
      `retry: false` — for most employees that is a normal state, not an error worth retrying
- [ ] T027 [US4] Verification: quickstart Scenario 2, **including step 4's read-only pass**. **Needs a
      browser, a running API and two roles; not run.** Step 4 is the one that actually proves T022

---

## Phase 3: Slip delivery ⚠️ GATED on backend Phase 4 (0 of 13)

**Goal**: FR-006 – FR-009. Sending is an **explicit action** (decision of 2026-10-01).

- [x] T028 [US2] Add slip-delivery reads and the retry to `app/lib/api/hr-payroll.ts`
- [x] T029 [US2] Create `app/ui/hr/slip-delivery.tsx` listing delivered, failed and undeliverable
      (FR-006), mounted on `app/ui/hr/payroll-run-detail.tsx`
- [x] T030 [US2] An explicit **send** control. Not automatic: an explicit send can be automated later,
      whereas an automatic send that was wrong has already emailed 500 people their salary slips
- [x] T031 [US2] A **retry that resends only failures** (FR-007), presented so it cannot be mistaken
      for "send all" — the difference is 12 emails or 500
- [x] T032 [US2] Show the **address as sent** on each row. An employee whose email is corrected after
      a failure must not have the old failure read as though it went to the new address
- [x] T033 [US2] A run that is not fully approved refuses delivery; **show the reason** rather than a
      disabled control with no explanation (FR-009)
- [x] T034 [US2] Present a run with some failures as **partial, not failed**. Failures are isolated by
      design — one bad address does not stop the other 499 — and a screen that reads as a failed run
      invites somebody to re-send everything
- [ ] T035 **NOT RUN** [US2] Verification: quickstart Scenario 3

---

## Phase 4: Bank sheet and reconciliation ⚠️ GATED on backend Phases 5–6 (0 of 18)

**Goal**: FR-010, FR-011. The transaction-sheet format rests on a file the client has not supplied;
the backend builds against one seeded mapping profile so theirs becomes a second profile.

- [x] T036 [US3] Add the bank sheet and reconciliation reads to `app/lib/api/hr-payroll.ts`
- [x] T036a [US3] **FR-008 — the transaction sheet upload itself**, showing matched lines, unmatched
      lines and differences. Previously implied by the display tasks below without anything actually
      uploading a file. A validated multipart upload (Principle II on the backend's side; a typed
      client on this one)
- [x] T037 [US3] Show advance recoveries as **named lines** (FR-010), not a netted figure
- [x] T038 [US3] Explain differences between the sheet and the run **line by line** (FR-011)
- [x] T039 [US3] An unparseable row **uploads and is reported**; the file does not fail. A parser that
      refuses on the first unrecognised row reports nothing, which is the opposite of what is wanted
- [ ] T040 **NOT RUN** [US3] Verification: quickstart Scenario 4, once a real file exists

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
- [X] T047 FR-015: every read goes through a typed API module and no component calls `fetch`; all copy
      in `constants.ts`. A sweep, recorded — this is the requirement that decays silently.

      **SWEPT 2026-10-03, and recorded rather than asserted.** Four checks, with what each found:

      * **Every read through a typed API module.** 26 modules under `app/lib/api/`, each parsing its
        response with zod before the app trusts it.
      * **No component calling `fetch`.** One exists and it is not a data read:
        `app/ui/my/punch-clock.tsx` issues `fetch('/', { method: 'HEAD' })` to read the server's
        `Date` header and correct clock skew. No payload, no record, same origin, and it falls back
        to the local clock on failure. Named here rather than counted as zero — a sweep that reports
        "none" where one exists teaches the next reader to distrust it.
      * **No inline styling.** Three `style={{…}}` uses, all computed geometry that cannot be a
        class: a measured popover position, a progress bar's percentage width, and a chart bar's
        height. No static styling inline.
      * **All copy in `constants.ts`.** Checked across this feature's screens; the copy objects are
        where the strings live.

      Recorded because this is the requirement that decays silently: nothing fails when it is
      broken, and the next person to add a screen inherits whatever the last one did.
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

---

## Phase 6: The waiver becomes a submission (added 2026-10-02)

The web half of the client's waiver answer: HR proposes, the Director countersigns. **This supersedes the
screen shipped on 2026-10-01**, where the waiver control wrote immediately for anyone with write access
on Employees.

- [x] T049 [US4] The waiver control submits for approval rather than applying. Its label must say so —
      "Request waiver", not "Waive" — because a control that says it has done a thing it has only
      proposed is the kind of copy that gets an exit signed off on a waiver nobody approved.
- [x] T050 [US4] Show the pending state on the clearance row, with who proposed it and when. Until the
      Director decides, the obligation is still outstanding and the screen must not read as cleared.
- [x] T051 [US4] Show a rejected waiver as rejected and the item as still outstanding. Silence after a
      rejection reads as success.
- [x] T052 [US4] `mayWaive` becomes "may propose a waiver". The shipped `hasWrite(user, 'EMPLOYEES')` was
      my placeholder, and the client has now set the authority deliberately.
- [x] T053 [US4] Settlement stays blocked while a waiver is pending. The gate is the api's, but the screen
      must explain it — an exit that will not settle with no stated reason sends somebody to a developer.
- [ ] T054 **NOT RUN** [P] [US4] Manual pass: propose, approve, settle; and propose, reject, confirm still blocked.

### Phases 3, 4 and 6 implementation record, 2026-10-02

#### The waiver control no longer claims to waive (Phase 6)

"Request waiver", not "Waive"; "Send for approval", not "Record waiver". T049 is right about why:
**a control that says it has done a thing it has only proposed is the copy that gets an exit signed
off on a waiver nobody approved.** Somebody presses it, reads the label, and reports the obligation
cleared.

The modal says the request goes to the Director **before** the field rather than after the button —
somebody who only learns it on success has already pressed a control they believed cleared the
obligation.

`mayWaive` became `mayPropose` on `PAYROLL` at write level (T052). `hasWrite(user, 'EMPLOYEES')` was
a placeholder; the client set the authority deliberately, and the backend gates `waive()` on exactly
the same value.

**The pending state needed a backend change to exist.** `ClearanceItem.waiver` only appears once the
Director has countersigned, so there was nothing for the screen to read — it would have shown the
obligation as plainly outstanding with no sign a decision was in flight. `proposal` was added to the
api for this, and the screen renders pending in amber (not green: a reader scanning for what is done
must not find this row among it) and rejected in red with "it can be requested again".

T053's explanation distinguishes "something is outstanding" from "a request is sitting on the
Director's desk". The second is not an answer the first gives, and an exit that will not settle with
no stated reason sends somebody to a developer.

#### Delivery: two controls that must not be confused (Phase 3)

The retry **names its count** — "Retry 3 failures" — sits apart from the send, and is **absent**
rather than disabled when nothing failed. The difference between the two controls is twelve emails or
five hundred, and an unlabelled "Retry" beside a "Send" is how somebody picks the wrong one. The
server enforces it too (the retry queries `status: failed`), but a screen that invites the mistake is
still a screen that causes it.

Four tallies, not two. `undeliverable` has its own colour and its own hint saying a retry will not
help, because these need somebody to find an address. `notAttempted` is separate because "nobody has
tried yet" sends a different person to a different place than "it bounced".

A run with some failures reads as **partial**, never failed — failures are isolated by design, and a
banner saying "delivery failed" invites somebody to send everything again.

The address column shows the address **as sent**, which is what the backend stores. Showing the
current one would make an old failure read as though it went to the corrected address.

#### Reconciliation: two kinds of gap, never one number (Phase 4)

Unmatched lines and missing employees are separate sections with separate explanations. A line
matching no employee is money that moved to somebody the run does not know about; an employee with no
line is money that **did not move**. One "discrepancies" count sends both to whoever asked first.

Missing employees are deliberately **not** rows in the main table: they are not lines in the sheet,
and putting them there would make "lines in sheet" a number that did not match the file.

Differences are not coloured by sign, and the hint says why: a transfer short by an advance recovery
is correct, and a red row would have somebody chasing the bank about a deduction the company made on
purpose.

#### One thing worth recording about the upload

`fileToBase64` reads an `ArrayBuffer` and chunks it through `String.fromCharCode`, not `btoa` over a
string. `btoa` on a file read as text corrupts every byte above 0x7F — which is most of a zip
archive, and an `.xlsx` is one. The chunking is because spreading a megabyte-long array into
`fromCharCode` exceeds the argument limit and throws, on exactly the large files somebody would
upload.

#### The two fields that had no home

`bankAccountHolderName` and `payrollDebitAccountNumber` reached the api's schema with its Phase 9 and
had no DTO and no form, so the transfer sheet would have refused every row and every file — correctly,
with no way for anybody to fix it. Both are now on the employee pay tab and the company payroll tab.
The debit account is a **text** field: `z.coerce.number()` on `09310400000819` yields
`9310400000819`, zero gone, transfer rejected.

#### Verification

`npx tsc --noEmit`, `npx eslint app` (0 errors) and `npm run build` all clean.

**T035, T040 and T054 NOT RUN** — all three are browser passes against a running API with a seeded
run and a provisioned Director. No test framework here (`TODO(TESTING_STANDARD)`).

**Prettier was deliberately not run on any file in this repository.** There is no config here, so its
defaults would reformat whatever it touched — the mistake that produced a 2,400-line diff in untouched
code on 2026-10-01.
