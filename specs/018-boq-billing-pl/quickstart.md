# Quickstart: BOQ, Billing and Project P&L (web)

**Nothing here runs today.** The backend is 0 of 74 tasks and no BOQ, bill or P&L endpoint exists.
This records how the feature will be validated, and which checks are measurements rather than glances.

## Prerequisites (when the backend lands)

- A project with a BOQ of **at least 500 lines** — NFR-001's figure. If the client's template is
  larger, use that size instead and record which was used
- A work order with a retention percentage, and an outstanding advance, so an RA bill has real
  deductions
- A project with **12 months** of activity (NFR-002) and a month with several hundred daily workers
  (the per-worker edge case)
- A second signed-in user, for the concurrency check

## Running

```bash
npm run dev
npm run lint && npx tsc --noEmit && npm run build
```

---

## Scenario 1 — the derivation, before any screen (Phase 1)

`app/lib/bill-totals.ts` is testable by inspection before the API exists. Walk these by hand:

- A line billed below its contracted quantity.
- A line billed **above** it — the function must produce a figure *and* a flag, not refuse.
- An RA bill with retention and an advance recovery: gross, each deduction, net. Confirm **neither
  deduction is counted as project cost** — the distinction this feature's worst defect comes from.

## Scenario 2 — the bill sheet (Phase 2, US1)

1. Open a 500-line BOQ. **Measure** time to interactive. **Expected**: under 3 seconds (NFR-001).
2. Type a quantity. **Expected**: line and bill totals update with no save and no reload (FR-002).
3. **The measurement that matters**: type continuously down a column of 30 lines. **Expected**: no
   perceptible lag. Record it with the React Profiler — if a keystroke re-renders more than its own
   row, per-row state isolation is not actually in place, and that is the single biggest interaction
   risk in this feature.
4. Enter a quantity above the contracted one. **Expected**: flagged at the line, and the bill is
   **still submittable** (FR-003).
5. Keyboard entry down a column (FR-004), no mouse.
6. **Draft recovery** (FR-005): enter several lines, then kill the tab. Reopen. **Expected**: the
   entry is offered back. Repeat with the network offline mid-entry.
7. Submit, then reopen. **Expected**: the rates shown are the rates billed, not today's BOQ rates
   (FR-006). Change the BOQ rate and confirm the submitted bill does not move.

## Scenario 3 — the RA bill (Phase 3, US2)

Awarded lines with quantity to date and remaining (FR-007). Gross, **each** deduction with its basis,
and net payable as separate figures (FR-008) — never one net with the arithmetic hidden.

## Scenario 4 — invalidation and concurrency (Phase 4)

1. Edit a bill under approval. **Expected**: warned **before** the edit, not after (FR-009).
2. Two users open the same bill; both save. **Expected**: the second does not silently overwrite — and
   critically, their entry is **not discarded**. A conflict that loses an hour of typing is worse than
   the overwrite the requirement prevents (FR-014).
3. After an edit that invalidates approvals, do not assert the invalidation has completed the instant
   the save returns. Expect it to be eventual.

## Scenario 5 — the summary (Phase 5, US3)

1. **Measure** render for 12 months of activity. **Expected**: under 3 seconds (NFR-002).
2. Open a figure. **Expected**: the records comprising it (FR-011).
3. Open a figure whose records the viewer **may not** see. **Expected**: it says so — never an empty
   drill-down, which reads as "there is nothing there".
4. Labour for a month → per-worker view (FR-010a), **read-only** (FR-010b). Confirm no control edits a
   wage here.
5. A month with several hundred daily workers. **Expected**: still readable where the category total
   was one line.
6. A month whose labour was entirely through a contractor. **Expected**: no per-worker disbursements,
   stated rather than blank.
7. Change the month. **Expected**: every figure moves **together** — no mixed-period state at any
   point (FR-012).
8. Export the month (FR-010c). **Expected**: the same figures as the screen, and a **production date**
   on the document. Then reopen a payment sheet for that month and export again: the two must be
   distinguishable, and the date is what does it.

## Scenario 6 — the group board (Phase 6, US4)

Per-project revenue, cost and margin with a company total (FR-013). Projects the viewer may not see
appear in **neither the rows nor the total** — a total that includes them leaks their existence.

## 320px (NFR-003)

The two billing sheets must be **unbroken** at 320px: the grid scrolls inside its own container and
the totals stay reachable. The spec is explicit that this does **not** claim a phone is a sensible way
to bill, and the screens are not phone-first.

The **group board** is the exception — a director might genuinely read it on a phone, and it should be
pleasant there rather than merely unbroken.
