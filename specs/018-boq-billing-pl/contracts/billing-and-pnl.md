# Contract: Billing and Project P&L (web ↔ api)

**Nothing in this contract is live.** The backend's 74 tasks are unstarted and no BOQ, bill or P&L
code exists. This records what the web will consume, so the two halves are reviewed together rather
than reconciled at Phase 5.

Authoritative shapes live in
`buildcore-api/specs/018-boq-billing-pl-backend/contracts/billing-and-pnl.md`. This file records the
**web-side obligations** that follow from them.

---

## Part 1 — money has one representation

Every amount crosses the boundary in one form and is parsed into one type. A sheet that sums hundreds
of lines is the worst place in the product for `number` and a decimal string to meet: the error is
small, silent, and lands in a figure somebody quotes to a client.

The project already has `nullableDecimal` and `decimal` zod helpers in `app/lib/api/plant.ts`. Reuse
them; do not introduce a second convention here.

## Part 2 — the bill sheet reads, and what the web derives

The server supplies per BOQ line: description, unit, contracted quantity, rate, and quantity billed
to date. The web derives the current period's values as the user types (FR-002, no save and no
reload).

**All derivation lives in one pure function** — `app/lib/bill-totals.ts`. Not in the sheet component,
for the reason in the plan: the summary (US3) reads the same concepts, and two implementations of
"net" produce two slightly different plausible figures on two screens.

### Over-quantity is a flag, not a refusal

FR-003: a quantity exceeding the contracted one is **flagged at the line on entry** and the bill may
still be submitted. So:

- The sheet must not block submission.
- Anything summing billed values **must know this can happen**. A summary that quietly totals a bill
  containing an over-quantity line is arithmetically correct and materially misleading.

### Rates are recorded, not recomputed

FR-006: a submitted bill displays **the rates at which it was billed**. The web renders the bill's own
rates, never today's BOQ rate. A rate revised after billing would otherwise silently restate history.

## Part 3 — the RA bill's three figures are three figures

FR-008: gross, **each** deduction, and net payable, as separate figures with each deduction's basis.
Never a single net with the arithmetic hidden.

### A deduction is not a cost

This is the trap the plan names and the contract exists partly to pin down:

| Figure | Is it project cost? |
| --- | --- |
| Gross certified | revenue-side |
| Retention withheld | **No** — the client's money held back |
| Advance recovery | **No** — money already paid, being settled |
| Net payable | what moves now |

A reader drilling from the summary's **cost** figure into bills can land on a deduction line and
conclude the project spent it. `bill-totals.ts` is where that distinction is defined once.

## Part 4 — approval invalidation is warned about before it happens

FR-009: editing a bill under approval **warns that approvals will be invalidated, before the edit** —
not after, and not as a toast once it is done. The warning is the requirement; the invalidation is the
backend's.

This mirrors behaviour the approval spine already has elsewhere, and feature 016's attendance work
established the pattern: the chain restarts when the correction is *applied*, not when it is asked
for. Expect the invalidation to be **eventual** rather than synchronous, so the UI must not assert it
has happened the instant the edit returns.

## Part 5 — concurrency (FR-014)

Two engineers on one bill: the second **must not silently overwrite** the first. Whatever token the
backend uses (version or timestamp), the web's obligation is that a rejected save is a **visible,
recoverable** state — the entry is not discarded, and the user is told what happened and by whom.

Losing an hour of entry to a conflict dialog that closes the sheet would be a worse failure than the
overwrite this requirement prevents.

## Part 6 — the summary opens to its records (FR-011)

Every figure opens to the records comprising it. Two consequences:

- **A figure whose records the viewer may not open** is a listed edge case. It must read as "you
  cannot open this", never as an empty drill-down, which reads as "there is nothing there".
- **The monthly labour view is read-only** (FR-010b). Wages are computed and corrected on the payment
  sheet, and a second place to change them would be a second answer to what somebody was paid.

FR-012: changing the selected month updates **every** figure together. No mixed-period state is ever
visible, which means one query per month boundary rather than a figure-by-figure refresh.

## Part 7 — the export (FR-010c)

The selected month, carrying the same figures as the screen. The spec's edge case is the one to
honour: a payment sheet reopened after a month was exported. **The export's production date is what
tells the two apart**, so it must appear on the document.
