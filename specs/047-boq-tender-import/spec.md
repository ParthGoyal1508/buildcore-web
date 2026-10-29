# Feature Specification (web): Tender BOQ Import — Every Schedule, Pricing Basis, Safe Confirm

**Feature Branch**: `047-boq-tender-import`
**Created**: 2026-10-28
**Status**: Implemented
**Source of truth**: `buildcore-api/specs/047-boq-tender-import/` — spec (with every decision in its
Clarifications section), plan, contract (`contracts/boq-import.md`) and tasks. This file records the
web half only.

## What the screens do

- **Import report** (`app/ui/projects/boq-import.tsx`): one row per schedule sheet — sheet, pricing
  basis chip, lines/sections, derived and stated totals, quoted percentage (percentage sheets only),
  quoted total, and "Adds up" / "Does not add up". Tax and total rows that were not imported are
  listed under a collapsible "rows read as totals or tax". A blocker (a sheet that does not add up,
  two sheets quoting different percentages) is shown first in red and Confirm is disabled — the API
  issues no batch.
- **Quoted-percentage choice**: when the workbook's figure differs from the project's, both are shown
  as radio options with neither pre-selected; Confirm stays disabled until one is chosen and sends
  `quotedPercentageSource`.
- **Replace**: when the project already has an untouched BOQ, a "Replace the existing BOQ with this
  workbook" checkbox must be ticked; Confirm sends `replaceExisting: true`. A BOQ with measured,
  reported, billed or awarded lines is refused by the API and its sentence (which names the lines) is
  shown as the refusal.
- **BOQ tree** (`boq-tree.tsx`): a Percentage / Item rate chip on every line (not on non-BOQ items);
  "Delete section" on a section with no lines, behind a confirm dialog; "Priced by" select in the
  line's edit row (sent only when changed — the API refuses a change on a billed line).
- **Add line** (`boq-entry.tsx`): "Priced by" select, default Percentage, with a hint per option.
- **Pricing screens** use the API's rule (no premium on item-rate lines or non-BOQ items): bill
  sheet and line row (`takesQuotedPercentage` from the billable BOQ), award editor's earned rate,
  certified-copy review, the tree's "contract total at quote" (`scheduleTotals` now basis-aware).

## Verification

- `npm run typecheck`, `npm run lint` (0 errors).
- `node --experimental-strip-types scripts/check-bill-totals.mjs ../buildcore-api/src/projects/billing/bill-totals.ts`
  — 15/15 shared vectors plus 2 new web-only `scheduleTotals` vectors for a mixed tender.
- Browser walk (Playwright, local API on the scratch database): NEWAI mixed tender report, quoted
  choice + replace gating Confirm, import → chips in tree, Plan row "Priced by" select, STMC excluded
  rows and tax note, tampered workbook blocker, add-line modal, empty-section delete dialog.
