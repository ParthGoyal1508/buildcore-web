# Feature Specification (web): Client Retention, CPBG Tracking and Project Types

**Branch**: `047-boq-tender-import` (shipped with 047, PR #55)
**Created**: 2026-10-28
**Source of truth**: `buildcore-api/specs/048-retention-cpbg-project-types/spec.md`. Every decision is in its Clarifications section.

## Screens

- **Project form** (`project-form.tsx`): a "Project type" select (Government / Private). It is required on a new project; an older untyped project may be left as it is on edit. A "Client CPBG (%)" field sits beside "Client retention (%)". The free-text "Department type" is relabelled "Department" and the old free-text "Project type" becomes "Category". The documents checklist on create follows the chosen type.
- **Settings → Project documents** (`project-documents-screen.tsx`): Government / Private checkboxes on each required kind, saved with the set. Readers without SETTINGS see "all projects", "government projects" and so on.
- **Client bill** (`client-bill-receipts.tsx`, inside `client-bill-view.tsx`): the "Payments received" section.
  - It shows bill value (and its basis), settled and outstanding, plus a table of receipts with retention, CPBG, TDS and other deductions.
  - "Record payment received" opens a modal. Retention and CPBG are pre-filled from the server's suggestion, and the CPBG hint changes when a PBG is running. Save is disabled while the total settled would exceed the outstanding.
  - A receipt can be removed after a confirm dialog.
- **Project overview** (`client-holdings-panel.tsx`): the "Held by the client" panel.
  - It shows retention withheld / released / held and CPBG deducted / refunded / held, with the contract terms, the total held, running PBGs and a "refund due" note.
  - "Record release / refund" opens a modal: kind, amount, date, reason, and the PBG it is against.
  - The panel is hidden for readers without PROJECT_FINANCIALS (403).
  - The billing table's client "Settled" cell now shows received plus withheld.
- **Reports**: "Held by client (retention & CPBG)" is served by the API and appears in the existing report list.

## Verified

- `npm run typecheck`, `npm run lint` (0 errors), bill-totals vectors.
- Playwright against a local API on the scratch DB, screenshots reviewed:
  - receipts section, empty and with a receipt;
  - receipt modal: suggestions, the over-outstanding state that disables Save, filled;
  - held-by-client panel;
  - release modal for retention and CPBG, with options showing held amounts;
  - Project type select and its hint;
  - create checklist: Private (work order, insurance, BOQ, labour insurance) vs Government (adds LOI, mining permission);
  - requirements settings checkboxes;
  - report listed.
