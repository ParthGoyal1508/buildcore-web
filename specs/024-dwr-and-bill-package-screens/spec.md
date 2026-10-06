# Feature Specification: Daily Work Report and Bill Package Screens

**Feature Branch**: the branch `buildcore-web` is on

**Created**: 2026-10-05

**Status**: Implemented alongside this spec, at the user's instruction to complete backend and
frontend in one pass

**Input**: *"can we complete it fully, without any interruption both backend and frontend"* — after
features 022 and 023 built the measurement and the bill package in `buildcore-api`, and the user
asked how a person would actually enter a day's work and produce a bill.

## Why this feature exists

Features 022 and 023 built the whole of a running-account bill in the API: a day's work can be
recorded, measured, submitted, approved and reversed; a bill package can be composed from the
approved measurement, reduced with a reason, issued, and produced as a 24-sheet workbook in either
direction. **None of it can be reached by a person.**

`app/dashboard/projects/portfolio/[id]/page.tsx` shows one line — *"Daily work reports: none"* —
and there is no form to add one, no list to read, and no button to approve. `app/lib/api/projects.ts`
says so in as many words: *"DWR, revenue, budget and P&L still have no functions here… a typed stub
against an absent endpoint is a compile-time promise the runtime cannot keep."* The endpoints are no
longer absent.

**The order matters and only one order works.** A bill package proposes its quantities from approved
measurement, so a bill composed before anybody can enter a day's work is a bill of zeros. The daily
work report screen is not the smaller half of this feature; it is the half the other half depends on.

## User Scenarios & Testing

### Story 1 — Record a day's work (Priority: P1)

A site engineer opens the project, opens Daily Work Reports, and records what happened today: the
weather, how many people and machines were on site, and a line for each BOQ item worked.

**A measured line is entered as its dimensions, never as a quantity.** Length, breadth, depth and
the three optional factors; the server computes the product and the form shows what it will be.
There is no field for a quantity, which is the stronger guarantee: a figure the UI cannot send is a
figure the UI cannot get wrong.

**A presence-paid line is entered as the day served** — `1.000` for a full day, less for a short
one, and a short one requires a remark. The two line kinds are different forms, because the factors
mean nothing on a presence line and offering them would invite a quantity that looks computed.

**Acceptance**
1. A report saves with no lines (a day with nothing measured is still a day that happened).
2. A measured line shows the quantity the server will compute, before saving.
3. A served quantity below 1 cannot be saved without a remark.
4. A work date in the future is refused; one before the project started is accepted and the
   discrepancy is shown.
5. A second report for a day already covered is accepted, and the existing one is named.

### Story 2 — Submit and approve (Priority: P1)

A report is a claim until somebody approves it, and **approval is what moves executed quantity.**

**Acceptance**
1. A draft can be submitted; a submitted report can be approved or returned with a reason.
2. **The author cannot approve their own report**, and the button says why rather than failing.
3. Approving twice is refused.
4. An approved report can be reversed with a reason, and the reversal says what it took back.
5. The list shows which state each report is in, and the quantity each line carries.

### Story 3 — Compose a bill for a period (Priority: P1)

A billing engineer opens Bills, chooses a direction and a period, and gets one proposed line per
schedule line — reviewing figures rather than entering them.

**Acceptance**
1. Composing shows every line, and the count is the schedule's own count.
2. A line with no measurement source reads **"no measurement"**, never `0.000` — the two are
   different facts and the screen must not collapse them.
3. Reducing a claim requires a reason; the field appears when the figure changes and the Save
   control is refused without it.
4. Claiming above the approved measurement is accepted with a reason and is marked as over-claimed
   on the line.
5. Returning a claim to its proposal clears the reason without being asked.

### Story 4 — The abstract, the register and the check list (Priority: P2)

**Acceptance**
1. The abstract shows four blocks and three columns, with every figure as the server rendered it —
   the screen performs no arithmetic.
2. A draft's cumulative column is labelled **provisional**.
3. The tax basis and how it was decided are both shown.
4. The debit register groups debits under their headings and says which bill each was recovered on.
5. The check list keeps an unanswered question visibly distinct from one answered no.

### Story 5 — Issue, and download the workbook (Priority: P2)

**Acceptance**
1. Issuing reports the header fields that could not be filled and the check-list gaps, and does not
   refuse on either.
2. The workbook downloads under the name the server gave it.
3. An issued bill cannot have its lines edited, and the screen says so rather than failing on save.

### Edge Cases

- **A project with no BOQ.** Composing is refused by the API; the screen says to enter the BOQ.
- **No retention term recorded.** Composing is refused naming the rate; the screen repeats the
  message rather than showing "something went wrong".
- **A locked project.** Every write is 423, which is not a permission problem, and the screen says
  the project is locked rather than that access was denied.
- **No `DWR` permission, or no `PROJECT_FINANCIALS`.** The tab is not offered, and arriving by URL
  explains the refusal.

## Requirements

### Functional Requirements

- **FR-001**: Every API call MUST go through a module in `app/lib/api/`, parsed by a zod schema
  before the app trusts it. No component issues its own `fetch` (Constitution Principle V, IV).
- **FR-002**: The daily work report form MUST NOT contain a field for a computed quantity. A
  measured line is entered as its dimensions and a presence line as the day served.
- **FR-003**: The form MUST show the quantity the server will compute for a measured line, before
  it is saved, using the same product the server uses.
- **FR-004**: A served quantity below one full day MUST require a remark before the form can be
  submitted.
- **FR-005**: A proposal with no measurement source MUST render as *no measurement* and MUST NOT
  render as a zero.
- **FR-006**: A claim differing from its proposal MUST require a reason in the form, and the reason
  MUST be cleared when the claim returns to the proposal.
- **FR-007**: An over-claimed line MUST be visibly marked on the line, not only in a report.
- **FR-008**: A draft bill's cumulative column MUST be labelled provisional.
- **FR-009**: Every figure shown MUST come from the API as rendered. **No screen computes a total,
  applies a rate, or sums a column** — the API rounds once and a second rounding in the browser is
  how two screens come to disagree by a rupee.
- **FR-010**: A 423 MUST be reported as a locked project and never as a permission refusal; a 404
  on another company's row MUST read as not found.
- **FR-011**: The two sections MUST be registered in one place with their permissions — `DWR` for
  daily work reports, `PROJECT_FINANCIALS` for bills — so a tab can never offer a page the guard
  refuses.
- **FR-012**: The workbook MUST download under the filename the server sent.

### Key Entities

- **Daily work report**: a day, its conditions, and its measured or presence-paid lines, in one of
  draft / submitted / approved / reversed.
- **Bill package**: a period, a direction, and one claim per schedule line, in one of draft /
  issued / certified / abandoned.

## Success Criteria

- **SC-001**: A site engineer records a day's work without typing a single quantity.
- **SC-002**: A billing engineer composes a month's bill by reviewing proposed figures and typing
  only where they are reducing one.
- **SC-003**: No figure on any of these screens is computed in the browser.
- **SC-004**: A line with no measurement source is never shown as zero.
- **SC-005**: Both sections are reachable from the project shell, and neither is offered to a user
  the API would refuse.

## Out of scope

- **Any change to `buildcore-api`.** 022 and 023 are complete and their contracts are what these
  screens are written against.
- **Prettier.** This repository has no prettier configuration, and running it reformatted 2,400
  lines of untouched code on 2026-10-01. Formatting here follows the file it is in.
- **Offline entry.** The daily work report is the obvious candidate for `offline-queue.ts`, and it
  is a decision with its own consequences (a queued report is a report whose work date and whose
  submission date disagree). Named rather than quietly skipped.
