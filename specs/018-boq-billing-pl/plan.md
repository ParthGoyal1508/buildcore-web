# Implementation Plan: BOQ, Billing and Project P&L (web)

**Branch**: `018-boq-billing-pl` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification at `specs/018-boq-billing-pl/spec.md`

**Backend counterpart**: `buildcore-api/specs/018-boq-billing-pl-backend` — specified, planned and
tasked across 11 phases, and **entirely unimplemented: 0 of 74 tasks.** No BOQ, bill or P&L code
exists in the API today.

## Summary

This is the largest of the four web features in this wave and the only one blocked end to end. Every
screen here reads figures that nothing computes yet.

That makes this plan a **design document to execute later**, and it should be read as one. The value
of writing it now is that the API's 74 tasks are shaped by what the screens need — particularly the
monthly roll-up and the export, which exist because of how people read a project — and reviewing both
halves together is cheaper than discovering a mismatch at Phase 5.

| Story | Priority | Backend phase | State |
| --- | --- | --- | --- |
| US1 — client bill down the BOQ | P1 | Phases 1–2 | 0 of 13 |
| US2 — subcontractor measurement | P1 | Phase 3 | 0 of 7 |
| US3 — project P&L | P1 | Phases 5, 10, 11 | 0 of 29 |
| US4 — group board | P2 | Phase 9 | 0 of 10 |

Three backend phases (6–8: variations, retention release, client certification) rest on recorded
assumptions rather than client answers. Each was deliberately chosen to be cheap to overturn, and the
web surfaces that touch them are sequenced last for the same reason.

## The sizing question, and what it does and does not block

**RESOLVED 2026-10-02 — the file arrived**: `buildcore-api/docs/BOQ_794578.xls`.

It is not a simple sheet. It is a government e-tender template (`BoQ_Ver3.0`, "Percentage BoQ", against
a PWD Integrated BSR, for an IOCL tender), macro-driven, with the usual warning that the bidder must
not modify it. Five things in it change this plan, and none was guessable:

1. **~312 line items, of which 83 are heading rows carrying no quantity.** A BOQ is a **two-level
   hierarchy** — item `12` is a heading whose children are `12.01` and `12.02` — not the flat list this
   plan assumed. NFR-001's 500-line interactivity target survives at the right order of magnitude.
2. **The bidder's percentage applies once at the grand total, not per line.** `Total in Figures` is
   29,961,506.78; `Quoted Rate in Figures` is 30,698,559.85, which is that total × 1.0246 for a 2.46%
   excess. So a BOQ has an **estimated total and a quoted total** differing by a single percentage, and
   per-line Addition/Deduction columns exist but are not in the line totals. A model that applied the
   percentage per line would produce a figure close enough to look right and wrong by rounding.
3. **26 distinct unit spellings for about 12 real units** — `Sqm`, `Sqm.`, `Sqm `, `sqm` are one unit
   written four ways; `Mtr.`, `Mtr`, `Rm`, `R. mtr`, `R Mtr.`, `R.Mtr.`, `R. Mtr.` are a worse case. A
   naive import creates 26 units, and every per-unit rate comparison and aggregate is then quietly
   wrong. Normalisation on import is mandatory, not a nicety.
4. **Columns 238–242 hold 216 rows of leftover test data** — `item1`, `item2`, `item3`, `item4`
   repeating — in the same shape as real line items (code, description, item, quantity, unit). An
   importer scanning for populated columns will find them. They must be ignored explicitly.
5. **243 columns, about 35 populated**, and most of the populated ones are pre-GST tax columns (Excise
   Duty, VAT, Cenvat, DGS&D/RITES) that are blank throughout. The template predates GST; the columns
   must be tolerated on import and not resurrected in the product.

Line totals are quantity × rate exactly (825.7287 × 251 = 207,257.9037), so the arithmetic is
confirmed. The source carries float noise (`29961506.782150004`), which is one more reason to store
decimals rather than re-derive from the file's own totals.

It does not block this plan, for two reasons.

**NFR-001 already commits to a figure**: a 500-line sheet interactive within 3 seconds, typing without
perceptible lag thereafter. That is a target to design against today, and the template will confirm
it or raise it.

**The architecture for 500 lines is not in doubt.** The decision that matters at that size is *where
the state lives*, not whether rows are virtualized:

- A single form object holding 500 lines re-renders the whole sheet on every keystroke. This is the
  failure NFR-001 describes, and it arrives at a few hundred rows on a mid-range laptop.
- **State isolated per row** — each line owning its own value, with totals derived — means a keystroke
  re-renders one row. That holds comfortably at 500 and is the plan.
- Virtualization is the answer at several thousand, and it costs something real: it fights FR-004's
  "keyboard entry down a column", because a row scrolled out of the window is unmounted and the
  focus target with it.

So the template changes **one decision**: whether to add virtualization on top. Adding it later to
per-row-isolated state is incremental; retrofitting per-row isolation into a single form object is
not. Building the cheaper, more robust half first is correct under either answer.

**If the template shows several thousand lines**, two things change and both are noted in the tasks:
virtualization, and FR-004's keyboard navigation has to survive it.

## FR-005: local draft recovery, and a precedent to follow

**Decision of 2026-10-01**: in-progress entry survives a reload, a crash or a dropped connection and
is offered back. Submitting still requires connectivity. Full offline-first — queuing bills and
syncing them — was considered and rejected for this feature: it needs conflict resolution, and
FR-014's "concurrent editing MUST NOT allow silent overwriting" becomes materially harder when one of
the editors was offline for an hour.

`app/lib/offline-queue.ts` already holds the mechanics. It is native IndexedDB with no wrapper — "one
object store and three operations, and a dependency for that would cost more than it saves" — and it
already carries **two** stores (punch and muster) sharing `openDb`, `promisify` and the drain shape,
with a comment explaining that the muster reuses the punch's mechanics rather than growing a second
implementation.

A bill-draft store is the third, following that documented precedent. Two notes:

- It stores a draft, not a queued submission. Nothing drains it to the server; it is read back when
  the sheet reopens. That is a different lifecycle from the two existing stores and should be stated
  where it is defined, so nobody wires it into a drain loop.
- **Feature 020 retires the punch store** in its Phase 2, since punching now requires connectivity.
  These two changes touch the same file and the same `DB_VERSION`. Whichever lands second must not
  treat the other's version bump as a conflict to resolve by reverting.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 15 App Router
**Primary Dependencies**: TanStack Query, react-hook-form, zod, Tailwind
**Storage**: IndexedDB for bill drafts, via `app/lib/offline-queue.ts`'s existing mechanics
**Testing**: No test framework is installed (constitution `TODO(TESTING_STANDARD)`). Verification is
lint, type-check, build and recorded manual passes. **No test-file tasks may be generated.**
**Target Platform**: Desktop-first. NFR-003 is explicit that the two billing sheets are *designed for
a desk* and must be unbroken at 320px without pretending a phone is a sensible way to bill
**Project Type**: Web frontend consuming `buildcore-api`
**Performance Goals**: NFR-001 (500 lines, 3s, lag-free typing), NFR-002 (summary in 3s over 12
months)
**Constraints**: Principle V for every read; copy in `constants.ts`; no inline styling

### What exists already

| Thing | Where | State |
| --- | --- | --- |
| IndexedDB mechanics | `app/lib/offline-queue.ts` | Reusable; see above |
| Group dashboard | `app/dashboard/group/page.tsx` | Exists; gains the P&L board |
| Project screens | `app/ui/projects/` | Exist; gain the summary and bill sheets |
| Responsive list | `app/ui/settings/responsive-list.tsx` | Useful for deduction and drill-down lists; **not** for the BOQ grid |

`responsive-list.tsx` is deliberately excluded from the BOQ grid. It renders every row and gained an
always-rendered detail row in 017 — both correct for settings-sized lists and both wrong at 500 lines
of editable inputs.

## Constitution Check

| Principle | How this plan complies |
| --- | --- |
| I Component-Based Architecture | A `BillLineRow` owning its own state is the architecture, not a detail. Totals derive in a pure function in `lib`, so the sheet and the submitted bill cannot disagree |
| II No Inline Styling | Tailwind only, including the grid |
| III Centralized Constants | Deduction labels, column headings, the over-quantity warning, export copy — all `constants.ts` |
| IV Type Safety | Money as a single typed representation end to end. Mixing `number` and a decimal string across a sheet that sums hundreds of lines is how a total goes quietly wrong |
| V API Access Boundary | `app/lib/api/billing.ts`, `app/lib/api/project-pnl.ts` |
| VI Responsive Design | NFR-003's reading: the BOQ grid scrolls inside its own `overflow-x` container with totals reachable at 320px. The **group board** is the one screen here a director might genuinely read on a phone and is built to be pleasant there |

No violations. No Complexity Tracking entries.

## Project Structure

```
app/lib/api/billing.ts            # NEW — client bills, RA bills
app/lib/api/project-pnl.ts        # NEW — summary, drill-downs, export
app/lib/bill-drafts.ts            # NEW — the IndexedDB draft store (FR-005)
app/lib/bill-totals.ts            # NEW — pure derivation, shared by sheet and review
app/ui/projects/bill-sheet.tsx    # NEW — US1
app/ui/projects/bill-line-row.tsx # NEW — per-row state (NFR-001)
app/ui/projects/ra-bill-sheet.tsx # NEW — US2
app/ui/projects/project-summary.tsx    # NEW — US3
app/ui/projects/monthly-labour.tsx     # NEW — FR-010a, FR-010b
app/ui/dashboard/pnl-board.tsx         # NEW — US4
```

## Phases

- **Phase 1 — The typed boundary and pure derivation.** Clients, money representation, `bill-totals`.
  Buildable against the contract before the API exists.
- **Phase 2 — The client bill sheet (US1).** Per-row state, live totals, the over-quantity flag,
  draft recovery.
- **Phase 3 — The RA bill sheet (US2).** Quantity to date and remaining, gross/deductions/net as
  separate figures.
- **Phase 4 — Concurrency and approval invalidation (FR-009, FR-014).**
- **Phase 5 — The project summary (US3).** Revenue and cost by category, drill-downs, the monthly
  labour view, the export.
- **Phase 6 — The group board (US4).**
- **Phase 7 — Verification**, including NFR-001 measured rather than asserted.

Phase 1 is the only phase that can start before the API, and it is worth doing early: `bill-totals`
is where FR-002's live arithmetic and the submitted bill's figures either agree or diverge.

## The one thing most likely to go wrong

**FR-008 and FR-011 disagreeing about what a figure means, without either being wrong.**

FR-008 requires an RA bill to show gross, each deduction and net payable **as separate figures**.
FR-011 requires every figure on the summary to **open to the records comprising it**. Both are
satisfiable alone; together they create a trap.

A deduction is a subtraction from a bill, but it is not a *cost* to the project — retention is the
client's money withheld, and an advance recovery is money already paid. So a reader drilling from the
summary's cost figure into bills can reasonably arrive at a deduction line and conclude the project
spent it. It did not.

The same trap, differently: FR-003's over-quantity flag is a warning at a line, not a correction, so a
bill may legitimately carry a quantity exceeding the contracted one. A summary that quietly sums
billed values without surfacing that is arithmetically right and materially misleading.

This is why `bill-totals.ts` is a Phase 1 deliverable and a pure function rather than logic inside the
sheet: there has to be **one** place that says what gross, net, revenue and cost each mean, and both
the sheet and the summary have to read it. Two implementations of "net" is the defect, and it will not
announce itself — the figures will simply be slightly different on two screens, and each will look
plausible.

## Complexity Tracking

No entries.

## Phase status

- [x] Plan written (2026-10-01)
- [ ] Phase 1 — Typed boundary and pure derivation (startable before the API)
- [ ] Phase 2 — Client bill sheet ⚠️ needs backend Phases 1–2
- [ ] Phase 3 — RA bill sheet ⚠️ needs backend Phase 3
- [ ] Phase 4 — Concurrency and approval invalidation ⚠️ needs backend Phase 4
- [ ] Phase 5 — Project summary ⚠️ needs backend Phases 5, 10, 11
- [ ] Phase 6 — Group board ⚠️ needs backend Phase 9
- [ ] Phase 7 — Verification

### Awaiting the client

- **The BOQ template**, which confirms or raises NFR-001's 500-line target and decides whether
  virtualization is added on top of per-row state. It blocks no task before Phase 2.
