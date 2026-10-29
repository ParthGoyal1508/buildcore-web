# Tasks (web): 047 Tender BOQ Import

API tasks live in `buildcore-api/specs/047-boq-tender-import/tasks.md` (T001–T028); these are its
T029–T033, broken down.

- [x] W01 Zod: `pricingBasis` on BOQ items, validate report (`schedules`, `excludedRows`, `blockers`, `confirmable`, nullable `batchId`, `projectQuotedPercentage`, `quotedPercentageDiffers`, `replace`, row `sheet`), confirm choices, `deleteBOQGroup`, basis on create/plan — app/lib/api/projects.ts
- [x] W02 Billing schemas: `pricingBasis` + `takesQuotedPercentage` on billable items, `pricingBasis` on bill lines, certified-copy lines — app/lib/api/billing.ts, app/lib/api/bill-packages.ts
- [x] W03 Import screen: schedules table, excluded rows, blockers, quoted choice, replace checkbox, sheet column on problems — app/ui/projects/boq-import.tsx
- [x] W04 Basis chip component — app/ui/projects/boq-basis-chip.tsx
- [x] W05 BOQ tree: chips, empty-section delete, basis in edit row, basis-aware quoted total — app/ui/projects/boq-tree.tsx, app/lib/bill-totals.ts
- [x] W06 Add line: basis select — app/ui/projects/boq-entry.tsx
- [x] W07 Pricing screens honour basis — bill-sheet.tsx, bill-line-row.tsx, award-editor.tsx, bill-lifecycle.tsx
- [x] W08 Copy — app/lib/constants.ts (BOQ_COPY)
- [x] W09 Vectors — scripts/check-bill-totals.mjs
- [x] W10 typecheck, lint, browser walk (see spec.md › Verification)
