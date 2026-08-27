# Quickstart: Validating the Settings Module Frontend

## Prerequisites

- `buildcore-api`'s Settings module (`specs/002-settings-backend`) running locally with seeded
  default roles, at least one company, and a Super Admin account/session.
- `npm run dev` in `buildcore-web` with `NEXT_PUBLIC_API_URL` pointed at that backend.
- A second signed-in session (or a way to switch accounts) for a non-Super-Admin/non-HO-User role,
  to exercise access-denied paths.
- Browser dev tools' device-emulation mode (or a real phone) for the mobile-viewport checks — no
  automated test framework exists yet in this repo (constitution's known gap), so every scenario
  below is a manual check.

## Scenario 1 — Company configuration (User Story 1)

1. Navigate to `/dashboard/settings/companies` as Super Admin. **Expected**: list loads with
   existing companies; a non-admin account visiting the same URL sees `AccessDenied` instead.
2. Click "Add Company", fill all five tabs, save. **Expected**: modal closes, new row appears with
   Status "Active".
3. Enter a duplicate short code. **Expected**: inline error on the Basic Info tab; other tabs'
   entered data is not lost when re-attempting.
4. Edit an existing company's payroll rates; reopen it. **Expected**: new values shown.
5. Toggle a company to Inactive; check any company-selector dropdown elsewhere (e.g. Employee
   Setup's context switcher). **Expected**: excluded from the dropdown, still visible (marked
   Inactive) in this screen's own list.
6. Resize to a mobile viewport. **Expected**: the Company List renders as stacked cards, not a
   horizontally-scrolling table.

## Scenario 2 — Roles and permissions (User Story 2)

1. Navigate to `/dashboard/settings/roles`. **Expected**: all nine default roles listed with
   permissions and user counts; Super Admin's edit/delete controls are disabled.
2. Attempt to edit/delete Super Admin anyway (e.g. via dev tools re-enabling the control).
   **Expected**: the backend still rejects it (403) and the UI surfaces that error.
3. Create a custom role via the permission multi-select (no free-text field present). Assign it to
   a test user (Scenario 3), sign in as them, and confirm only the granted modules are reachable.
4. Delete that custom role while the test user still holds it. **Expected**: a warning about
   affected users appears before confirming; afterward, that user shows "No role assigned" in the
   Users list and loses access on their next action.

## Scenario 3 — User administration (User Story 3)

1. Navigate to `/dashboard/settings/users` as Super Admin or HO User. **Expected**: list shows
   Name/Email/Role/Status/Last Login; "Add User" link present.
2. As any other role, attempt to navigate to the same URL. **Expected**: `AccessDenied`, not a
   read-only view.
3. Edit a user's role/status; confirm the row updates immediately.
4. Attempt to deactivate/delete/reassign the only remaining active Super Admin account. **Expected**:
   rejected with an explanatory message (surfacing the backend's 409).
5. Click "Add User". **Expected**: navigates to the separate Account Creation route.

## Scenario 4 — Employee Setup (User Stories 4–7)

1. Navigate to `/dashboard/settings/employee-setup` for a company. **Expected**: five tabs
   (Code Series, Departments, Designations, Document Types, Shifts).
2. Add a Department under company A; switch the company context to company B. **Expected**: A's
   department is not listed under B.
3. In Document Types, toggle Mandatory + Needs Document Number in the Add modal, before saving.
   **Expected**: the live preview shows "MandatoryNumber" immediately, no save round-trip needed to
   see it.
4. Open Document Types for a brand-new company. **Expected**: pre-populated with all 16 default
   types and correct flags.
5. Add a Shift; attempt to delete a Department/Shift referenced by a (test-seeded) employee record.
   **Expected**: rejected with an explanatory message.
6. Open Code Series for a company. **Expected**: shows short code + next code as read-only text, no
   editable sequence field; change the company's short code on the Companies screen and reopen —
   prefix updates, sequence continues.

## Scenario 5 — Cross-cutting checks

1. Trigger a save failure (e.g., stop the backend mid-request). **Expected**: the form/modal stays
   open with entered data intact and shows a specific error, not a silent close or blank failure.
2. Tab through every screen's interactive controls using only the keyboard (no mouse). **Expected**:
   visible focus indicator throughout; all actions (open modal, switch tabs, save, cancel, confirm
   delete) reachable and operable.
3. Resize every list screen to a mobile viewport (≤428px). **Expected**: card layout throughout, no
   horizontal page scroll.
