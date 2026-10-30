# Feature Specification (web): No Reminders for Disposed Machines, Scrapped Assets or Completed Projects

**Branch**: `049-no-reminders-closed`
**Created**: 2026-10-29
**Source of truth**: `buildcore-api/specs/049-no-reminders-closed-records/spec.md`. Every decision is in its Clarifications section.

**Input** (the user, verbatim): "we need to not show the reminders for assets, machines which are scrapped or sold out. Similar for projects which are completed."

## What the web needed

Almost nothing. The Reminders page, the sidebar badge, the dashboard "Alerts & Reminders" card and the bell all render what the API computes. Once the API's rules skip disposed machines and completed projects, those surfaces follow, and so do the register pages' `expiryAlert` / `inspectionDue` flags.

The two exceptions are marks the web draws itself:

- **Equipment detail** (`app/dashboard/plant/equipment/[id]/page.tsx`). The registration papers' amber "N days" / red "lapsed" badges are computed in the browser. The document table's "Expired" / "Expiring soon" badges come from the API's `expired`, which stays true as a fact. On a scrapped or sold machine, both now show the plain date with no badge.
- **Asset detail** (`app/dashboard/assets/register/[id]/page.tsx`). Document expiry is coloured red/orange with "— expired" / "— expiring". On a scrapped asset it now shows the plain date.

## Clarifications

- Q: Do the dates still show on a disposed machine or scrapped asset? → A: Yes. Only the amber/red marks, which ask someone to renew, are dropped. (decided by implementer, 2026-10-29, the record is history and should stay readable)
- Q: Which statuses count as closed? → A: `DISPOSED_EQUIPMENT_STATUSES` (scrapped, sold) for machines, and anything outside `ACTIVE_ASSET_STATUSES` (scrapped) for assets. Both constants already exist. (decided by implementer, 2026-10-29, mirrors the API)

## Verification

- `npm run lint` and `npm run typecheck` pass.
- Visual check (headless Chromium against the 049 API on a local scratch DB, 2026-10-29). Fixtures: an active and a scrapped excavator, each with an insurance paper and an operator licence due in 5 days, and an idle and a scrapped generator, each with an AMC due in 5 days and an inspection 3 days overdue.
  - The Reminders page, the bell and the dashboard card list only the active excavator's two reminders.
  - The scrapped excavator shows plain dates in Registration papers and "—" in the document status.
  - The active excavator shows "2026-11-03 · 5 days" (amber) and "Expiring soon".
  - The scrapped generator shows plain dates and no "— due" on its next inspection.
  - The idle generator shows "— expiring" and "— due".
